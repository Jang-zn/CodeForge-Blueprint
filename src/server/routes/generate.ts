import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import {
  getIssues,
  getWorkspaceMeta,
  getTabVersion,
  createJob,
  updateJob,
  getProviderModel,
  type Tab,
} from '../../db/repository.js';
import { getWorkspace } from '../../workspace.js';
import { spawnProvider } from '../../claude/provider.js';

const generateRoute = new Hono();

function buildWriteDocPrompt(tab: Tab, issues: ReturnType<typeof getIssues>, prdContent: string, version: string): string {
  const resolvedIssues = issues.filter(i => i.status === 'resolved');
  const deferredIssues = issues.filter(i => i.status === 'deferred');

  const issuesSummary = resolvedIssues.map(i =>
    `- [${i.id}] ${i.title}: ${i.memo || '확정'}`
  ).join('\n');

  const deferredSummary = deferredIssues.map(i =>
    `- [${i.id}] ${i.title}: ${i.memo || '보류'}`
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

// POST /api/generate
generateRoute.post('/', async (c) => {
  const db = getDb();
  const workspace = getWorkspace();
  const body = await c.req.json<{ tab: Tab }>().catch(() => ({ tab: 'review' as Tab }));
  const tab: Tab = body.tab ?? 'review';

  const meta = getWorkspaceMeta(db);
  if (!meta?.prd_path) {
    return c.json({ error: 'PRD 경로가 설정되지 않았습니다.' }, 400);
  }

  const jobId = crypto.randomUUID();
  createJob(db, jobId, `generate-doc-${tab}`);

  (async () => {
    try {
      const issues = getIssues(db, tab);
      const prdContent = fs.readFileSync(meta.prd_path!, 'utf-8');
      const version = getTabVersion(db, tab);

      const prompt = buildWriteDocPrompt(tab, issues, prdContent, version);
      const result = await spawnProvider(prompt, getProviderModel(db));

      if (!result.success) {
        updateJob(db, jobId, 'failed', result.error);
        return;
      }

      // 파일명: {tab}-{version}.md
      const filename = `${tab}-${version}.md`;
      const outputPath = path.join(workspace.docsPath, filename);
      fs.writeFileSync(outputPath, result.result, 'utf-8');

      updateJob(db, jobId, 'completed');
    } catch (e) {
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

// GET /api/generate/download/:filename — 생성된 문서 다운로드
generateRoute.get('/download/:filename', (c) => {
  const workspace = getWorkspace();
  const filename = c.req.param('filename');
  const filePath = path.join(workspace.docsPath, filename);

  if (!fs.existsSync(filePath) || !filename.endsWith('.md')) {
    return c.json({ error: '파일을 찾을 수 없습니다.' }, 404);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  c.header('Content-Type', 'text/markdown; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);
  return c.body(content);
});

export default generateRoute;
