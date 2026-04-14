import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execFile } from 'child_process';
import {
  upsertWorkspaceMeta,
  createJob,
  updateJob,
  appendJobLog,
  getProviderModel,
  getWorkspaceMeta,
  addDocumentRecord,
  isJobRunnable,
  markSupersededJobs,
} from '../../db/repository.js';
import { spawnProviderWithHandle } from '../../claude/provider.js';
import { registerProcess, unregisterProcess } from '../../claude/process-registry.js';
import { createLogExtractor } from '../../claude/log-extractor.js';
import { buildInitPrompt, buildCodebasePrdPrompt, type InitFormData, getInterviewBlock, getInterviewBlocks } from '../../claude/prompts/init.js';
import { scanCodebase, buildScanContext } from '../../codebase-scanner.js';
import { requireRequestContext } from '../context.js';

function pickFileNative(): Promise<string | null> {
  // Electron 모드: dialog.showOpenDialog 사용
  if (process.env.CODEFORGE_ELECTRON) {
    return _pickFileViaElectron();
  }

  return new Promise((resolve) => {
    const platform = process.platform;
    if (platform === 'darwin') {
      execFile(
        'osascript',
        ['-e', 'POSIX path of (choose file with prompt "기획서 파일 선택 (.md, .txt)" of type {"public.plain-text", "net.daringfireball.markdown", "public.text"})'],
        { timeout: 120_000 },
        (err, stdout) => resolve(err ? null : stdout.trim().replace(/\/$/, '') || null),
      );
    } else if (platform === 'linux') {
      execFile(
        'zenity',
        ['--file-selection', '--title=기획서 파일 선택', '--file-filter=텍스트/마크다운 | *.md *.txt'],
        { timeout: 120_000 },
        (err, stdout) => resolve(err ? null : stdout.trim() || null),
      );
    } else if (platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Windows.Forms;$f=New-Object System.Windows.Forms.OpenFileDialog;$f.Filter='Markdown/Text|*.md;*.txt';if($f.ShowDialog() -eq 'OK'){$f.FileName}`;
      execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 120_000 }, (err, stdout) => {
        resolve(err ? null : stdout.trim() || null);
      });
    } else {
      resolve(null);
    }
  });
}

async function _pickFileViaElectron(): Promise<string | null> {
  try {
    const { dialog, BrowserWindow } = await import('electron');
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const opts = { properties: ['openFile' as const], title: '기획서 파일 선택', filters: [{ name: 'Markdown/Text', extensions: ['md', 'txt'] }] };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  } catch {
    return null;
  }
}

const initRoute = new Hono();

// ===== Interview Flow (Phase 4) =====

initRoute.get('/interview', (c) => {
  // GET /api/init/interview — 모든 블록 목록 반환
  const blocks = getInterviewBlocks();
  const list = blocks.map(block => ({
    blockIndex: block.blockIndex,
    title: block.title,
    questionCount: block.questions.length,
  }));
  return c.json({ blocks: list, totalBlocks: blocks.length });
});

initRoute.get('/interview/:blockIndex', (c) => {
  // GET /api/init/interview/:blockIndex — 특정 블록의 질문 목록 반환
  const blockIndex = parseInt(c.req.param('blockIndex'), 10);
  if (isNaN(blockIndex) || blockIndex < 0 || blockIndex > 6) {
    return c.json({ error: '유효하지 않은 블록 인덱스입니다.' }, 400);
  }

  const block = getInterviewBlock(blockIndex);
  if (!block) {
    return c.json({ error: '블록을 찾을 수 없습니다.' }, 404);
  }

  return c.json({
    blockIndex: block.blockIndex,
    totalBlocks: 7,
    title: block.title,
    description: block.description,
    questions: block.questions,
    hint: block.hint,
  });
});

initRoute.post('/interview/:blockIndex', async (c) => {
  // POST /api/init/interview/:blockIndex — 블록 답변 수신
  // body: { answers: Record<questionId, string | string[]> }
  // 마지막 블록(6)에 도달하면 전체 답변을 취합하여 PRD 생성 (선택적)

  const blockIndex = parseInt(c.req.param('blockIndex'), 10);
  if (isNaN(blockIndex) || blockIndex < 0 || blockIndex > 6) {
    return c.json({ error: '유효하지 않은 블록 인덱스입니다.' }, 400);
  }

  const block = getInterviewBlock(blockIndex);
  if (!block) {
    return c.json({ error: '블록을 찾을 수 없습니다.' }, 404);
  }

  const body = await c.req.json<{ answers?: Record<string, string | string[]> }>().catch(() => ({ answers: {} as Record<string, string | string[]> }));
  const answers: Record<string, string | string[]> = body.answers ?? {};

  // 검증: 필수 항목 확인
  const missingRequired = block.questions
    .filter(q => q.required && !answers[q.id]?.toString().trim())
    .map(q => q.id);

  if (missingRequired.length > 0) {
    return c.json(
      { error: '필수 답변이 누락되었습니다.', missing: missingRequired },
      400,
    );
  }

  // 다음 블록이 있으면 다음 블록의 첫 질문 정보 반환
  const nextBlockIndex = blockIndex + 1;
  const nextBlock = nextBlockIndex <= 6 ? getInterviewBlock(nextBlockIndex) : null;

  return c.json({
    blockIndex,
    totalBlocks: 7,
    answered: true,
    answers,
    nextBlockIndex: nextBlock ? nextBlockIndex : null,
    nextUrl: nextBlock ? `/api/init/interview/${nextBlockIndex}` : null,
    message: nextBlock
      ? `Block ${blockIndex + 1} 완료. 다음 단계로 진행합니다.`
      : `모든 인터뷰 블록 완료! PRD 생성 준비가 되었습니다.`,
  });
});

// ===== Original Init Flow (유지) =====

initRoute.post('/', async (c) => {
  const { db, workspace, sessionId } = requireRequestContext(c);
  const body = await c.req.json<InitFormData>();

  if (!body.detail?.trim()) {
    return c.json({ error: '상세 기획은 필수 입력입니다.', recovery: '상세 기획을 입력한 뒤 다시 시도하세요.' }, 400);
  }

  const jobId = crypto.randomUUID();
  const providerModel = getProviderModel(db);
  markSupersededJobs(db, { session_id: sessionId, type: 'generate-prd', run_key: 'init' }, jobId);
  createJob(db, jobId, 'generate-prd', {
    session_id: sessionId,
    capability: 'generation',
    run_key: 'init',
    source_version: 'input-form',
    workspace_root: workspace.rootPath,
  });
  appendJobLog(db, jobId, `[${providerModel.provider}:${providerModel.model}] PRD 초안 생성 시작...\n`);

  (async () => {
    try {
      const prompt = buildInitPrompt(body);
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

      const prdPath = path.join(workspace.docsPath, 'prd-v0.1.0.md');
      fs.writeFileSync(prdPath, result.result, 'utf-8');

      upsertWorkspaceMeta(db, {
        name: body.projectName || workspace.name,
        prd_path: prdPath,
        source_prd_path: prdPath,
      });
      addDocumentRecord(db, { tab: 'review', version: '0.1.0', kind: 'generated-prd', file_path: prdPath, source_version: 'input-form', source_job_id: jobId });

      updateJob(db, jobId, 'completed', undefined, { usage: result.usage });
    } catch (e) {
      if (!isJobRunnable(db, jobId)) return;
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

initRoute.post('/import-file', async (c) => {
  const { db, workspace } = requireRequestContext(c);

  const filePath = await pickFileNative();
  if (!filePath) return c.json({ cancelled: true });

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.txt') {
    return c.json({ error: '.md 또는 .txt 파일만 지원합니다.', recovery: 'Markdown 또는 text 파일을 선택하세요.' }, 400);
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return c.json({ error: '파일을 읽을 수 없습니다.', recovery: '파일 권한과 인코딩을 확인하세요.' }, 400);
  }
  const destName = `prd-imported${ext}`;
  const destPath = path.join(workspace.docsPath, destName);
  fs.mkdirSync(workspace.docsPath, { recursive: true });
  fs.copyFileSync(filePath, destPath);

  upsertWorkspaceMeta(db, { prd_path: destPath, source_prd_path: destPath });
  addDocumentRecord(db, { tab: 'review', version: '0.1.0', kind: 'source-prd', file_path: destPath, source_version: 'import', source_job_id: null });

  return c.json({ content, path: destPath, originalName: path.basename(filePath) });
});

initRoute.get('/prd', (c) => {
  const { db } = requireRequestContext(c);
  const meta = getWorkspaceMeta(db);
  const prdPath = meta?.prd_path;

  if (!prdPath || !fs.existsSync(prdPath)) {
    return c.json({ error: 'PRD 파일이 없습니다.', recovery: 'PRD를 생성하거나 불러오세요.' }, 404);
  }

  const content = fs.readFileSync(prdPath, 'utf-8');
  return c.json({ content, path: prdPath, sourcePath: meta?.source_prd_path ?? null });
});

const TEMPLATE_LABELS: Record<string, string> = {
  saas: 'SaaS / 웹 서비스',
  ecommerce: '커머스 / 마켓플레이스',
  content: '콘텐츠 플랫폼',
  'internal-tool': '내부 도구 / CLI',
  'side-project': '사이드 프로젝트',
};

// NOTE: 소스 기준 경로 → src/templates/
// 빌드 후 dist/server/routes/init.js 기준으로 ../../templates는 dist/templates/를 가리킴.
// 빌드 시 src/templates/를 dist/templates/로 복사하는 작업이 별도로 필요합니다.
const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../templates');

initRoute.get('/templates', (c) => {
  const list = Object.entries(TEMPLATE_LABELS).map(([type, label]) => ({ type, label }));
  return c.json(list);
});

initRoute.get('/templates/:type', (c) => {
  const type = c.req.param('type');
  const label = TEMPLATE_LABELS[type];
  if (!label) return c.json({ error: '템플릿을 찾을 수 없습니다.' }, 404);

  const filePath = path.join(TEMPLATES_DIR, `${type}.md`);
  if (!fs.existsSync(filePath)) return c.json({ error: '템플릿 파일이 없습니다.' }, 404);

  const raw = fs.readFileSync(filePath, 'utf-8');
  // "## 예시"와 "## 골격" 섹션으로 분리
  const [, exampleAndRest = ''] = raw.split(/^## 예시/m);
  const [exampleRaw = '', skeletonRaw = ''] = exampleAndRest.split(/^## 골격/m);

  return c.json({
    type,
    label,
    example: exampleRaw.trim(),
    skeleton: skeletonRaw.trim(),
  });
});

initRoute.post('/scan-codebase', (c) => {
  const { workspace } = requireRequestContext(c);
  try {
    const summary = scanCodebase(workspace.rootPath);
    return c.json(summary);
  } catch (e) {
    return c.json({ error: '코드베이스 스캔 실패', recovery: String(e) }, 500);
  }
});

initRoute.post('/from-codebase', async (c) => {
  const { db, workspace, sessionId } = requireRequestContext(c);
  const body = await c.req.json<{ userNotes?: string }>().catch(() => ({} as { userNotes?: string }));

  const jobId = crypto.randomUUID();
  const providerModel = getProviderModel(db);
  markSupersededJobs(db, { session_id: sessionId, type: 'generate-prd', run_key: 'init' }, jobId);
  createJob(db, jobId, 'generate-prd', {
    session_id: sessionId,
    capability: 'generation',
    run_key: 'init',
    source_version: 'codebase-scan',
    workspace_root: workspace.rootPath,
  });
  appendJobLog(db, jobId, `[${providerModel.provider}:${providerModel.model}] 코드베이스 분석 후 PRD 생성 시작...\n`);

  (async () => {
    try {
      appendJobLog(db, jobId, '코드베이스 스캔 중...\n');
      const summary = scanCodebase(workspace.rootPath);
      appendJobLog(db, jobId, `감지된 프로젝트 타입: ${summary.detectedType}, 예상 LOC: ${summary.stats.estimatedLoc}\n`);

      const scanContext = buildScanContext(summary, body.userNotes);
      appendJobLog(db, jobId, `스캔 컨텍스트 준비 완료 (${scanContext.length}자). PRD 생성 중...\n`);

      const prompt = buildCodebasePrdPrompt(scanContext);
      const codebaseExtractor = createLogExtractor(providerModel.provider);
      const handle = spawnProviderWithHandle(prompt, providerModel, {
        cwd: workspace.rootPath,
        idleTimeout: 600_000,  // 10분 — 코드베이스 PRD는 프롬프트가 크므로 여유 확보
        allowedTools: ['Read', 'Glob', 'Grep', 'Agent'],
        onChunk: (chunk) => {
          if (!isJobRunnable(db, jobId)) return;
          const text = codebaseExtractor.processChunk(chunk);
          if (text) appendJobLog(db, jobId, text);
        },
      });
      handle.childReady.then(child => { if (child) registerProcess(jobId, child); });
      let result: Awaited<typeof handle.promise>;
      try { result = await handle.promise; } finally { unregisterProcess(jobId); }

      if (!isJobRunnable(db, jobId)) return;
      if (!result.success) { updateJob(db, jobId, 'failed', result.error); return; }

      const prdPath = path.join(workspace.docsPath, 'prd-v0.1.0.md');
      fs.writeFileSync(prdPath, result.result, 'utf-8');

      upsertWorkspaceMeta(db, {
        name: summary.projectName || workspace.name,
        prd_path: prdPath,
        source_prd_path: prdPath,
      });
      addDocumentRecord(db, { tab: 'review', version: '0.1.0', kind: 'generated-prd', file_path: prdPath, source_version: 'codebase-scan', source_job_id: jobId });
      updateJob(db, jobId, 'completed', undefined, { usage: result.usage });
    } catch (e) {
      if (!isJobRunnable(db, jobId)) return;
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

export default initRoute;
