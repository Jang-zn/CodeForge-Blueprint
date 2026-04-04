import { Hono } from 'hono';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { openWorkspace, expandHome, getWorkspaceOrNull, hasWorkspace, getRecents } from '../../workspace.js';
import { openDb, getDb, resetDb } from '../../db/index.js';
import { getWorkspaceMeta, getProviderModel, setProviderModel, upsertWorkspaceMeta, type ProviderType } from '../../db/repository.js';

type CliStatus = { available: boolean; version?: string; path?: string | null };

function pickFolderNative(): Promise<string | null> {
  return new Promise((resolve) => {
    const platform = process.platform;
    if (platform === 'darwin') {
      execFile('osascript', ['-e', 'POSIX path of (choose folder)'], { timeout: 120_000 }, (err, stdout) => {
        resolve(err ? null : stdout.trim().replace(/\/$/, '') || null);
      });
    } else if (platform === 'linux') {
      execFile('zenity', ['--file-selection', '--directory', '--title=폴더 선택'], { timeout: 120_000 }, (err, stdout) => {
        resolve(err ? null : stdout.trim() || null);
      });
    } else if (platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Windows.Forms;$f=New-Object System.Windows.Forms.FolderBrowserDialog;if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}`;
      execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 120_000 }, (err, stdout) => {
        resolve(err ? null : stdout.trim() || null);
      });
    } else {
      resolve(null);
    }
  });
}

function buildWorkspaceResponse(
  ws: { name: string; rootPath: string; docsPath: string },
  db: any,
  claudeStatus: CliStatus,
  codexStatus: CliStatus,
) {
  const meta = getWorkspaceMeta(db);
  return {
    hasWorkspace: true,
    name: ws.name,
    rootPath: ws.rootPath,
    docsPath: ws.docsPath,
    prd_path: meta?.prd_path ?? null,
    claudeAvailable: claudeStatus.available,
    claudeVersion: claudeStatus.version,
    codexAvailable: codexStatus.available,
    codexVersion: codexStatus.version,
    providerModel: getProviderModel(db),
  };
}

export function createWorkspaceRoute(claudeStatus: CliStatus, codexStatus: CliStatus) {
  const router = new Hono();

  router.get('/', (c) => {
    if (!hasWorkspace()) {
      return c.json({ hasWorkspace: false, recents: getRecents() });
    }
    const workspace = getWorkspaceOrNull()!;
    return c.json(buildWorkspaceResponse(workspace, getDb(), claudeStatus, codexStatus));
  });

  router.post('/pick-folder', async (c) => {
    const folderPath = await pickFolderNative();
    if (!folderPath) return c.json({ cancelled: true, path: null });
    return c.json({ cancelled: false, path: folderPath });
  });

  router.post('/open', async (c) => {
    const body = await c.req.json<{ path: string }>().catch(() => null);
    if (!body?.path?.trim()) return c.json({ error: 'path가 필요합니다.' }, 400);

    const absPath = path.resolve(expandHome(body.path));
    if (!fs.existsSync(absPath)) return c.json({ error: '폴더가 존재하지 않습니다.' }, 400);

    resetDb();
    const ws = openWorkspace(absPath);
    const db = openDb(ws.dbPath);
    return c.json(buildWorkspaceResponse(ws, db, claudeStatus, codexStatus));
  });

  router.put('/provider', async (c) => {
    if (!hasWorkspace()) return c.json({ error: '워크스페이스가 열려있지 않습니다.' }, 400);
    const body = await c.req.json<{ provider: ProviderType; model: string }>().catch(() => null);
    if (!body?.provider || !body?.model) return c.json({ error: 'provider와 model이 필요합니다.' }, 400);
    if (body.provider !== 'claude' && body.provider !== 'codex') return c.json({ error: '유효하지 않은 provider입니다.' }, 400);
    setProviderModel(getDb(), body.provider, body.model);
    return c.json({ ok: true });
  });

  router.patch('/', async (c) => {
    if (!hasWorkspace()) return c.json({ error: '워크스페이스가 열려있지 않습니다.' }, 400);
    const body = await c.req.json<{ prd_path?: string; tech_stack_path?: string; name?: string }>();
    upsertWorkspaceMeta(getDb(), body);
    return c.json({ ok: true });
  });

  return router;
}
