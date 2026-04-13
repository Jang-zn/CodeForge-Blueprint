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
  getDocuments,
  getLastDecisionLogsBulk,
  hasPendingDrafts,
  getCurrentCycle,
  updateCycleStatus,
  type Tab,
} from '../../db/repository.js';
import { spawnProviderWithHandle } from '../../claude/provider.js';
import { registerProcess, unregisterProcess } from '../../claude/process-registry.js';
import { createLogExtractor } from '../../claude/log-extractor.js';
import { requireRequestContext } from '../context.js';

const generateRoute = new Hono();

/* ── Tab-specific section structures ── */

const TAB_SECTIONS: Record<Tab, { filename: string; title: string }[]> = {
  review: [
    { filename: '01-service-overview.md', title: '서비스 개요 (비전, 문제 정의, 핵심 가치)' },
    { filename: '02-target-users.md', title: '타겟 사용자 (페르소나, 시나리오)' },
    { filename: '03-service-scope.md', title: '서비스 범위 (MVP 포함/제외)' },
    { filename: '04-feature-spec.md', title: '기능 명세' },
    { filename: '05-revenue-model.md', title: '수익 모델' },
    { filename: '06-tech-stack.md', title: '기술 스택' },
    { filename: '07-deployment.md', title: '배포 및 운영 환경' },
    { filename: '08-constraints.md', title: '제약/리스크' },
    { filename: '09-kpi.md', title: '성공 지표' },
    { filename: '10-deferred.md', title: '향후 검토 사항 (보류 항목)' },
  ],
  backend: [
    { filename: '01-api-design.md', title: 'API 설계' },
    { filename: '02-db-schema.md', title: 'DB 스키마 + ERD (Mermaid)' },
    { filename: '03-infra.md', title: '인프라' },
    { filename: '04-libraries.md', title: '라이브러리' },
    { filename: '05-service-layer.md', title: '서비스 레이어' },
    { filename: '06-needs-review.md', title: '검토 필요 항목' },
    { filename: '07-deferred.md', title: '다음 Phase 이관' },
  ],
  frontend: [
    { filename: '01-components.md', title: '화면/컴포넌트 계층' },
    { filename: '02-state-management.md', title: '상태 관리' },
    { filename: '03-routing.md', title: '네비게이션/라우팅' },
    { filename: '04-api-integration.md', title: 'API 연동 레이어' },
    { filename: '05-design-system.md', title: '디자인 시스템' },
    { filename: '06-needs-review.md', title: '검토 필요 항목' },
    { filename: '07-deferred.md', title: '다음 Phase 이관' },
  ],
  features: [
    { filename: '01-marketing.md', title: '마케팅 관점' },
    { filename: '02-operations.md', title: '운영 관점' },
    { filename: '03-service.md', title: '서비스 관점' },
    { filename: '04-technical.md', title: '기술 관점' },
    { filename: '05-deferred.md', title: 'Phase N+2 이관 후보' },
  ],
};

/* ── Parse <<<FILE: xxx>>> delimited output ── */

interface ParsedSection {
  filename: string;
  content: string;
}

function parseFileDelimitedOutput(raw: string): ParsedSection[] {
  const delimiter = /<<<FILE:\s*(.+?)>>>/g;
  const parts = raw.split(delimiter);
  // parts: [preamble, filename1, content1, filename2, content2, ...]
  const sections: ParsedSection[] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const rawName = parts[i].trim();
    // Security: force basename to prevent path traversal
    const filename = path.basename(rawName);
    const content = parts[i + 1].trim();
    if (filename && content) {
      sections.push({ filename, content });
    }
  }
  return sections;
}

/* ── Prompt builder ── */

function buildWriteDocPrompt(
  tab: Tab,
  issues: ReturnType<typeof getIssues>,
  prdContent: string,
  version: string,
  lastLogs: Record<string, { memo: string; status: string }>,
): string {
  const resolvedIssues = issues.filter(issue => issue.status === 'resolved' || issue.status === 'candidate' || issue.status === 'promoted');
  const deferredIssues = issues.filter(issue => issue.status === 'deferred');
  const dismissedIssues = issues.filter(issue => issue.status === 'dismissed' || issue.status === 'archived');
  const reviewingIssues = issues.filter(issue => issue.status === 'reviewing');

  const getMemo = (issue: (typeof issues)[0], fallback: string) =>
    lastLogs[issue.id]?.memo?.trim() || issue.memo?.trim() || fallback;

  const issuesSummary = resolvedIssues.map(issue =>
    `- [${issue.id}] ${issue.title}: ${getMemo(issue, '확정')}`
  ).join('\n');

  const deferredSummary = deferredIssues.map(issue =>
    `- [${issue.id}] ${issue.title}: ${getMemo(issue, '보류')}`
  ).join('\n');

  const dismissedSummary = dismissedIssues.map(issue =>
    `- [${issue.id}] ${issue.title}: ${getMemo(issue, '삭제')}`
  ).join('\n');

  const reviewingSummary = reviewingIssues.map(issue =>
    `- [${issue.id}] ${issue.title}: ${getMemo(issue, '검토중')}`
  ).join('\n');

  const docType = {
    review: 'PRD (기획 리뷰 반영본)',
    backend: '백엔드 설계서',
    frontend: '프론트엔드 설계서',
    features: '다음 버전 기능 제안서',
  }[tab];

  const sections = TAB_SECTIONS[tab];
  const sectionList = sections.map(s => `  - ${s.filename}: ${s.title}`).join('\n');

  return `당신은 시니어 프로덕트 매니저입니다. 아래 정보를 바탕으로 최종 ${docType}를 **섹션별로 분리된 마크다운 파일**로 작성하세요.

## 원본 PRD
${prdContent}

## 리뷰에서 확정된 항목 (${resolvedIssues.length}건)
${issuesSummary || '없음'}

## 보류된 항목 (${deferredIssues.length}건, 다음 버전 검토)
${deferredSummary || '없음'}

## 삭제된 항목 (${dismissedIssues.length}건, 문서에 포함하지 마세요)
${dismissedSummary || '없음'}

## 검토중 항목 (${reviewingIssues.length}건, 메모의 방향을 참고하세요)
${reviewingSummary || '없음'}

## 출력 형식 지시사항

각 파일은 \`<<<FILE: 파일명.md>>>\` 구분자로 시작합니다. 반드시 이 형식을 따르세요.

**기대하는 섹션 구조:**
  - index.md: 목차 + 버전 정보 + 개요
${sectionList}

**규칙:**
- 첫 번째 파일은 반드시 \`<<<FILE: index.md>>>\`로 시작하세요
- index.md에는 모든 섹션 파일로의 상대 링크(\`./파일명.md\`) 목차를 포함하세요
- 각 섹션 파일 마지막에 \`[← 목차로](./index.md)\` 네비게이션 링크를 추가하세요
- 각 파일은 독립적으로 읽을 수 있어야 합니다
- 해당 섹션에 내용이 없으면(예: 보류 항목이 0건) 해당 파일을 생성하지 마세요
- 확정된 항목들을 PRD에 반영해서 수정된 최종 문서를 작성하세요
- 보류 항목은 "향후 검토 사항" 또는 "보류" 섹션에 추가하세요
- 버전: ${version}
- 오늘 날짜: ${new Date().toISOString().slice(0, 10)}
- 구분자와 마크다운 내용만 출력하세요 (다른 설명 없이)`;
}

/* ── POST / — generate docs ── */

generateRoute.post('/', async (c) => {
  const { db, workspace, sessionId } = requireRequestContext(c);
  const body = await c.req.json<{ tab: Tab }>().catch(() => ({ tab: 'review' as Tab }));
  const tab: Tab = body.tab ?? 'review';

  const meta = getWorkspaceMeta(db);
  if (!meta?.prd_path) {
    return c.json({ error: 'PRD 경로가 설정되지 않았습니다.', recovery: '먼저 PRD를 생성하거나 불러오세요.' }, 400);
  }
  const prdPath = meta.prd_path;

  // pending draft가 있으면 반영하기를 먼저 실행해야 함
  if (hasPendingDrafts(db, tab)) {
    return c.json(
      {
        error: '반영하지 않은 변경사항이 있습니다. "반영하기"를 먼저 실행하세요.',
        recovery: '"반영하기" 버튼을 클릭하여 변경사항을 반영한 후 다시 시도하세요.',
      },
      400
    );
  }

  const jobId = crypto.randomUUID();
  const providerModel = getProviderModel(db);
  const version = getTabVersion(db, tab);
  const folderName = `${tab}-v${version}`;
  markSupersededJobs(db, { session_id: sessionId, type: `generate-${tab}`, tab, run_key: tab }, jobId);
  createJob(db, jobId, `generate-${tab}`, {
    tab,
    session_id: sessionId,
    capability: 'generation',
    run_key: tab,
    source_version: version,
    workspace_root: workspace.rootPath,
  });
  // Capture cycle at job creation time to avoid race with concurrent analyses
  const cycle = getCurrentCycle(db, tab);
  const cycleId = cycle?.id ?? null;

  appendJobLog(db, jobId, `[${providerModel.provider}:${providerModel.model}] 문서 생성 시작...\n`);

  (async () => {
    try {
      const issues = getIssues(db, tab);
      const lastLogs = getLastDecisionLogsBulk(db, issues.map(i => i.id));
      const prdContent = fs.readFileSync(prdPath, 'utf-8');

      const prompt = buildWriteDocPrompt(tab, issues, prdContent, version, lastLogs);
      const extractor = createLogExtractor(providerModel.provider);
      const handle = spawnProviderWithHandle(prompt, providerModel, {
        onChunk: (chunk) => {
          if (!isJobRunnable(db, jobId)) return;
          const text = extractor.processChunk(chunk);
          if (text) appendJobLog(db, jobId, text);
        },
      });
      handle.childReady.then(child => {
        if (child) registerProcess(jobId, child);
      });
      let result: Awaited<typeof handle.promise>;
      try {
        result = await handle.promise;
      } finally {
        unregisterProcess(jobId);
      }

      if (!isJobRunnable(db, jobId)) return;
      if (!result.success) {
        updateJob(db, jobId, 'failed', result.error);
        return;
      }

      const outputDir = path.join(workspace.docsPath, folderName);
      fs.mkdirSync(outputDir, { recursive: true });

      const sections = parseFileDelimitedOutput(result.result);

      if (sections.length > 0) {
        // Folder-based output
        for (const section of sections) {
          fs.writeFileSync(path.join(outputDir, section.filename), section.content, 'utf-8');
        }
      } else {
        // Fallback: no delimiters found — save entire output as index.md
        fs.writeFileSync(path.join(outputDir, 'index.md'), result.result, 'utf-8');
      }

      const indexPath = path.join(outputDir, 'index.md');
      const docId = addDocumentRecord(db, { tab, version, kind: 'generated-doc', file_path: indexPath, source_version: version, source_job_id: jobId });

      if (cycleId) {
        updateCycleStatus(db, cycleId, 'completed', docId);
      }

      updateJob(db, jobId, 'completed', undefined, { result_path: indexPath, usage: result.usage });
    } catch (e) {
      if (!isJobRunnable(db, jobId)) return;
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId, folderName, downloadUrl: `/api/generate/download/${folderName}/index.md` });
});

/* ── GET /versions ── */

generateRoute.get('/versions', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab');
  if (!tab) return c.json({ error: 'tab 파라미터가 필요합니다.' }, 400);
  const versions = getDocuments(db, tab as Tab);
  return c.json({ versions });
});

/* ── GET /content/:id — read doc content (folder-aware) ── */

generateRoute.get('/content/:id', (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: '유효하지 않은 id입니다.' }, 400);
  const docs = getDocuments(db);
  const doc = docs.find(d => d.id === id);
  if (!doc) return c.json({ error: '문서를 찾을 수 없습니다.' }, 404);

  const filePath = doc.file_path;

  // Folder-based document (file_path points to index.md)
  if (filePath.endsWith('index.md')) {
    const folderPath = path.dirname(filePath);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      const mdFiles = fs.readdirSync(folderPath)
        .filter(f => f.endsWith('.md'))
        .sort();
      const files = mdFiles.map(f => ({
        name: f,
        content: fs.readFileSync(path.join(folderPath, f), 'utf-8'),
      }));
      // Assembled full content for diff compatibility
      const content = files.map(f => f.content).join('\n\n---\n\n');
      return c.json({ id, tab: doc.tab, version: doc.version, content, files, created_at: doc.created_at });
    }
  }

  // Legacy single-file document
  if (!fs.existsSync(filePath)) {
    return c.json({ id, tab: doc.tab, version: doc.version, content: null, error: 'file_not_found', created_at: doc.created_at });
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return c.json({ id, tab: doc.tab, version: doc.version, content, created_at: doc.created_at });
});

/* ── GET /download/* — wildcard download (folder + file support) ── */

generateRoute.get('/download/*', (c) => {
  const { workspace } = requireRequestContext(c);
  const relativePath = c.req.path.replace(/^\/api\/generate\/download\//, '');

  if (!relativePath) {
    return c.json({ error: '경로가 지정되지 않았습니다.' }, 400);
  }

  // Security: prevent path traversal
  const resolved = path.resolve(workspace.docsPath, relativePath);
  if (!resolved.startsWith(path.resolve(workspace.docsPath))) {
    return c.json({ error: '접근할 수 없는 경로입니다.' }, 403);
  }

  if (!fs.existsSync(resolved)) {
    return c.json({ error: '파일을 찾을 수 없습니다.' }, 404);
  }

  // Directory: return file listing
  if (fs.statSync(resolved).isDirectory()) {
    const files = fs.readdirSync(resolved).filter(f => f.endsWith('.md')).sort();
    return c.json({ folder: relativePath, files });
  }

  // File: download
  const content = fs.readFileSync(resolved, 'utf-8');
  c.header('Content-Type', 'text/markdown; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${path.basename(resolved)}"`);
  return c.body(content);
});

export default generateRoute;
