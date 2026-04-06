import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  getIssues,
  getWorkspaceMeta,
  getTabVersion,
  createJob,
  updateJob,
  appendJobLog,
  getProviderModel,
  markSupersededJobs,
  isJobRunnable,
  addDocumentRecord,
  type Tab,
} from '../../db/repository.js';
import { spawnProvider } from '../../claude/provider.js';
import { chunkToLogText } from '../../claude/log-extractor.js';
import { requireRequestContext } from '../context.js';

const generateRoute = new Hono();

function buildWriteDocPrompt(tab: Tab, issues: ReturnType<typeof getIssues>, prdContent: string, version: string): string {
  const resolvedIssues = issues.filter(issue => issue.status === 'resolved');
  const deferredIssues = issues.filter(issue => issue.status === 'deferred');

  const issuesSummary = resolvedIssues.map(issue =>
    `- [${issue.id}] ${issue.title}: ${issue.memo || '확정'}`
  ).join('\n');

  const deferredSummary = deferredIssues.map(issue =>
    `- [${issue.id}] ${issue.title}: ${issue.memo || '보류'}`
  ).join('\n');

  const docType = {
    review: 'PRD (기획 리뷰 반영본)',
    backend: '백엔드 설계서',
    frontend: '프론트엔드 설계서',
    features: '다음 버전 기능 제안서',
  }[tab];

  return `당신은 시니어 프로덕트 매니저입니다. 아래 정보를 바탕으로 최종 ${docType} 마크다운 문서를 작성하세요.

## 원본 PRD
${prdContent}

## 리뷰에서 확정된 항목 (${resolvedIssues.length}건)
${issuesSummary || '없음'}

## 보류된 항목 (${deferredIssues.length}건, 다음 버전 검토)
${deferredSummary || '없음'}

## 지시사항
- 확정된 항목들을 PRD에 반영해서 수정된 최종 문서를 작성하세요
- 보류 항목은 "향후 검토 사항" 섹션으로 추가하세요
- 버전: ${version}
- 오늘 날짜: ${new Date().toISOString().slice(0, 10)}
- 마크다운 문서만 출력하세요 (다른 설명 없이)`;
}

generateRoute.post('/', async (c) => {
  const { db, workspace, sessionId } = requireRequestContext(c);
  const body = await c.req.json<{ tab: Tab }>().catch(() => ({ tab: 'review' as Tab }));
  const tab: Tab = body.tab ?? 'review';

  const meta = getWorkspaceMeta(db);
  if (!meta?.prd_path) {
    return c.json({ error: 'PRD 경로가 설정되지 않았습니다.', recovery: '먼저 PRD를 생성하거나 불러오세요.' }, 400);
  }
  const prdPath = meta.prd_path;

  const jobId = crypto.randomUUID();
  const providerModel = getProviderModel(db);
  const version = getTabVersion(db, tab);
  const filename = `${tab}-${version}.md`;
  markSupersededJobs(db, { session_id: sessionId, type: `generate-${tab}`, tab, run_key: tab }, jobId);
  createJob(db, jobId, `generate-${tab}`, {
    tab,
    session_id: sessionId,
    capability: 'generation',
    run_key: tab,
    source_version: version,
    workspace_root: workspace.rootPath,
  });
  appendJobLog(db, jobId, `[${providerModel.provider}:${providerModel.model}] 문서 생성 시작...\n`);

  (async () => {
    try {
      const issues = getIssues(db, tab);
      const prdContent = fs.readFileSync(prdPath, 'utf-8');

      const prompt = buildWriteDocPrompt(tab, issues, prdContent, version);
      const result = await spawnProvider(prompt, providerModel, {
        onChunk: (chunk) => {
          if (!isJobRunnable(db, jobId)) return;
          const text = chunkToLogText(chunk, providerModel.provider);
          if (text) appendJobLog(db, jobId, text);
        },
      });

      if (!isJobRunnable(db, jobId)) return;
      if (!result.success) {
        updateJob(db, jobId, 'failed', result.error);
        return;
      }

      const outputPath = path.join(workspace.docsPath, filename);
      fs.writeFileSync(outputPath, result.result, 'utf-8');
      addDocumentRecord(db, { tab, version, kind: 'generated-doc', file_path: outputPath, source_version: version, source_job_id: jobId });

      updateJob(db, jobId, 'completed', undefined, { result_path: outputPath });
    } catch (e) {
      if (!isJobRunnable(db, jobId)) return;
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId, filename, downloadUrl: `/api/generate/download/${filename}` });
});

generateRoute.get('/download/:filename', (c) => {
  const { workspace } = requireRequestContext(c);
  const filename = c.req.param('filename');
  if (path.basename(filename) !== filename || !filename.endsWith('.md')) {
    return c.json({ error: '파일을 찾을 수 없습니다.' }, 404);
  }
  const filePath = path.join(workspace.docsPath, filename);

  if (!fs.existsSync(filePath)) {
    return c.json({ error: '파일을 찾을 수 없습니다.' }, 404);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  c.header('Content-Type', 'text/markdown; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);
  return c.body(content);
});

export default generateRoute;
