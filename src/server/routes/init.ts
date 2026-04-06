import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
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
import { spawnProvider } from '../../claude/provider.js';
import { chunkToLogText } from '../../claude/log-extractor.js';
import { buildInitPrompt, type InitFormData } from '../../claude/prompts/init.js';
import { requireRequestContext } from '../context.js';

function pickFileNative(): Promise<string | null> {
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

const initRoute = new Hono();

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

      const prdPath = path.join(workspace.docsPath, 'prd-v0.1.0.md');
      fs.writeFileSync(prdPath, result.result, 'utf-8');

      upsertWorkspaceMeta(db, {
        name: body.projectName || workspace.name,
        prd_path: prdPath,
        source_prd_path: prdPath,
      });
      addDocumentRecord(db, { tab: 'review', version: '0.1.0', kind: 'generated-prd', file_path: prdPath, source_version: 'input-form', source_job_id: jobId });

      updateJob(db, jobId, 'completed');
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

export default initRoute;
