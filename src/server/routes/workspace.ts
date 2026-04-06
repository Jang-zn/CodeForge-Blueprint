import { Hono } from 'hono';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { openWorkspace, expandHome, getRecents, closeWorkspaceSession } from '../../workspace.js';
import { openDb } from '../../db/index.js';
import { getProviderModel, setProviderModel, upsertWorkspaceMeta, getDocuments, getIssues, getRunningJobs, cancelJob, getWorkspaceMeta, getLastApplyAtByTab, getDirtyCountByTab, getLastCompletedJobAtByPrefix, type ProviderType } from '../../db/repository.js';
import { getRequestContext, getSessionIdFromRequest } from '../context.js';
import { getProviderCapabilities } from '../../claude/provider.js';
import { killProcess } from '../../claude/process-registry.js';

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

function buildStageSummary(db: any) {
  const reviewIssues = getIssues(db, 'review');
  const documents = getDocuments(db);
  const hasPrd = !!reviewIssues.length || documents.some(doc => doc.kind === 'source-prd' || doc.kind === 'generated-prd');
  const stage = hasPrd ? (reviewIssues.length > 0 ? 'review' : 'prd_ready') : 'init';

  // 탭별 dirty 계산
  const lastApplyAt = getLastApplyAtByTab(db);
  const TABS = ['review', 'backend', 'frontend', 'features'] as const;
  const dirtyCountByTab: Record<string, number> = {};
  for (const tab of TABS) {
    dirtyCountByTab[tab] = getDirtyCountByTab(db, tab, lastApplyAt[tab]);
  }

  // 탭별 마지막 analyze/generate 시각
  const lastAnalyzeAtByTab = getLastCompletedJobAtByPrefix(db, 'analyze-');
  const lastGeneratedDocAtByTab = getLastCompletedJobAtByPrefix(db, 'generate-');

  return {
    stage,
    counts: {
      review: reviewIssues.length,
      backend: getIssues(db, 'backend').length,
      frontend: getIssues(db, 'frontend').length,
      features: getIssues(db, 'features').length,
    },
    runningJobs: getRunningJobs(db).map(job => ({
      id: job.id,
      type: job.type,
      tab: job.tab,
      started_at: job.started_at,
      capability: job.capability,
    })),
    documents: documents.slice(0, 8),
    dirtyCountByTab,
    lastAnalyzeAtByTab,
    lastGeneratedDocAtByTab,
  };
}

function buildWorkspaceResponse(
  reqCtx: ReturnType<typeof getRequestContext> extends infer T ? Exclude<T, null> : never,
  claudeStatus: CliStatus,
  codexStatus: CliStatus,
) {
  const { workspace, db } = reqCtx;
  const meta = getWorkspaceMeta(db);
  return {
    hasWorkspace: true,
    sessionId: workspace.sessionId,
    name: workspace.name,
    rootPath: workspace.rootPath,
    docsPath: workspace.docsPath,
    recents: getRecents(),
    prd_path: meta?.prd_path ?? null,
    source_prd_path: meta?.source_prd_path ?? null,
    claudeAvailable: claudeStatus.available,
    claudeVersion: claudeStatus.version,
    codexAvailable: codexStatus.available,
    codexVersion: codexStatus.version,
    providerModel: getProviderModel(db),
    providerCapabilities: getProviderCapabilities(),
    workflow: buildStageSummary(db),
  };
}

export function createWorkspaceRoute(claudeStatus: CliStatus, codexStatus: CliStatus) {
  const router = new Hono();

  router.get('/', (c) => {
    const reqCtx = getRequestContext(c);
    if (!reqCtx) {
      return c.json({ hasWorkspace: false, recents: getRecents(), sessionId: getSessionIdFromRequest(c) });
    }
    return c.json(buildWorkspaceResponse(reqCtx, claudeStatus, codexStatus));
  });

  router.post('/pick-folder', async (c) => {
    const folderPath = await pickFolderNative();
    if (!folderPath) return c.json({ cancelled: true, path: null });
    return c.json({ cancelled: false, path: folderPath });
  });

  router.post('/open', async (c) => {
    const body = await c.req.json<{ path: string }>().catch(() => null);
    if (!body?.path?.trim()) return c.json({ error: 'path가 필요합니다.', recovery: '프로젝트 폴더 경로를 입력하세요.' }, 400);

    const absPath = path.resolve(expandHome(body.path));
    if (!fs.existsSync(absPath)) return c.json({ error: '폴더가 존재하지 않습니다.', recovery: '올바른 프로젝트 폴더를 선택하세요.' }, 400);
    if (!fs.statSync(absPath).isDirectory()) return c.json({ error: '폴더 경로만 열 수 있습니다.', recovery: '파일이 아닌 폴더를 선택하세요.' }, 400);

    const workspace = openWorkspace(absPath);
    const reqCtx = { sessionId: workspace.sessionId, workspace, db: openDb(workspace.dbPath) };
    return c.json(buildWorkspaceResponse(reqCtx, claudeStatus, codexStatus));
  });

  router.put('/provider', async (c) => {
    const reqCtx = getRequestContext(c);
    if (!reqCtx) return c.json({ error: '워크스페이스가 열려있지 않습니다.', recovery: '워크스페이스를 먼저 여세요.' }, 400);
    const body = await c.req.json<{ provider: ProviderType; model: string }>().catch(() => null);
    if (!body?.provider || !body?.model) return c.json({ error: 'provider와 model이 필요합니다.' }, 400);
    if (body.provider !== 'claude' && body.provider !== 'codex') return c.json({ error: '유효하지 않은 provider입니다.' }, 400);
    setProviderModel(reqCtx.db, body.provider, body.model);
    return c.json({ ok: true });
  });

  router.patch('/', async (c) => {
    const reqCtx = getRequestContext(c);
    if (!reqCtx) return c.json({ error: '워크스페이스가 열려있지 않습니다.', recovery: '워크스페이스를 먼저 여세요.' }, 400);
    const body = await c.req.json<{ prd_path?: string; tech_stack_path?: string; name?: string }>();
    upsertWorkspaceMeta(reqCtx.db, body);
    return c.json({ ok: true });
  });

  router.post('/close', async (c) => {
    // body에서도 sessionId를 받을 수 있도록 (beforeunload sendBeacon용)
    let sessionId: string | undefined;
    const reqCtx = getRequestContext(c);
    if (reqCtx) {
      sessionId = reqCtx.sessionId;
      // 해당 세션의 실행 중 job만 cancel + kill
      const runningJobs = getRunningJobs(reqCtx.db);
      for (const job of runningJobs) {
        if (job.session_id === sessionId) {
          cancelJob(reqCtx.db, job.id);
          killProcess(job.id);
        }
      }
    } else {
      // header에 세션 없으면 body에서 시도
      try {
        const body = await c.req.json<{ sessionId?: string } | Record<string, never>>().catch(() => ({}));
        sessionId = 'sessionId' in body ? body.sessionId : undefined;
      } catch { /* ignore */ }
    }
    if (sessionId) {
      closeWorkspaceSession(sessionId);
    }
    return c.json({ ok: true });
  });

  return router;
}
