import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { getDb } from '../../db/index.js';
import { upsertWorkspaceMeta, createJob, updateJob, getProviderModel } from '../../db/repository.js';
import { getWorkspace } from '../../workspace.js';
import { spawnProvider } from '../../claude/provider.js';
import { buildInitPrompt, type InitFormData } from '../../claude/prompts/init.js';

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

// POST /api/init — 선택지 폼 데이터 → PRD 초안 생성
initRoute.post('/', async (c) => {
  const db = getDb();
  const workspace = getWorkspace();
  const body = await c.req.json<InitFormData>();

  if (!body.detail?.trim()) {
    return c.json({ error: '상세 기획은 필수 입력입니다.' }, 400);
  }

  const jobId = crypto.randomUUID();
  createJob(db, jobId, 'generate-prd');

  // 비동기로 Claude CLI 실행
  (async () => {
    try {
      const prompt = buildInitPrompt(body);
      const result = await spawnProvider(prompt, getProviderModel(db));

      if (!result.success) {
        updateJob(db, jobId, 'failed', result.error);
        return;
      }

      // PRD 파일 저장
      const prdPath = path.join(workspace.docsPath, 'prd-v0.1.0.md');
      fs.writeFileSync(prdPath, result.result, 'utf-8');

      // workspace에 prd_path 업데이트
      upsertWorkspaceMeta(db, {
        name: body.projectName || workspace.name,
        prd_path: prdPath,
      });

      updateJob(db, jobId, 'completed');
    } catch (e) {
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

// POST /api/init/import-file — OS 파일 피커로 기존 기획서 불러오기
initRoute.post('/import-file', async (c) => {
  const filePath = await pickFileNative();
  if (!filePath) return c.json({ cancelled: true });

  if (!fs.existsSync(filePath)) return c.json({ error: '파일을 찾을 수 없습니다.' }, 400);

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.txt') {
    return c.json({ error: '.md 또는 .txt 파일만 지원합니다.' }, 400);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const workspace = getWorkspace();
  const db = getDb();

  const destName = `prd-imported${ext}`;
  const destPath = path.join(workspace.docsPath, destName);
  fs.mkdirSync(workspace.docsPath, { recursive: true });
  fs.copyFileSync(filePath, destPath);

  upsertWorkspaceMeta(db, { prd_path: destPath });

  return c.json({ content, path: destPath, originalName: path.basename(filePath) });
});

// GET /api/init/prd — 생성된 PRD 내용 반환
initRoute.get('/prd', (c) => {
  const workspace = getWorkspace();
  const prdPath = path.join(workspace.docsPath, 'prd-v0.1.0.md');

  if (!fs.existsSync(prdPath)) {
    return c.json({ error: 'PRD 파일이 없습니다.' }, 404);
  }

  const content = fs.readFileSync(prdPath, 'utf-8');
  return c.json({ content, path: prdPath });
});

export default initRoute;
