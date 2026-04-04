import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openWorkspace, expandHome, getWorkspaceOrNull, hasWorkspace, getRecents } from '../workspace.js';
import { openDb, getDb, resetDb } from '../db/index.js';
import { getWorkspaceMeta, getJob, getProviderModel, setProviderModel, type ProviderType } from '../db/repository.js';
import { checkClaude, checkCodex } from '../claude/finder.js';
import workspaceRoute from './routes/workspace.js';
import issuesRoute from './routes/issues.js';
import initRoute from './routes/init.js';
import analyzeRoute from './routes/analyze.js';
import applyRoute from './routes/apply.js';
import generateRoute from './routes/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildWorkspaceResponse(
  ws: { name: string; rootPath: string; docsPath: string },
  db: any,
  claudeStatus: { available: boolean; version?: string },
  codexStatus: { available: boolean; version?: string },
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

export async function startServer(port: number): Promise<number> {
  const [claudeStatus, codexStatus] = await Promise.all([checkClaude(), checkCodex()]);

  const app = new Hono();
  const api = new Hono();

  // 워크스페이스 정보 (대시보드 초기 로드용)
  api.get('/workspace', (c) => {
    if (!hasWorkspace()) {
      return c.json({ hasWorkspace: false, recents: getRecents() });
    }
    const workspace = getWorkspaceOrNull()!;
    return c.json(buildWorkspaceResponse(workspace, getDb(), claudeStatus, codexStatus));
  });

  // 워크스페이스 열기
  api.post('/workspace/open', async (c) => {
    const body = await c.req.json<{ path: string }>().catch(() => null);
    if (!body?.path?.trim()) return c.json({ error: 'path가 필요합니다.' }, 400);

    const absPath = path.resolve(expandHome(body.path));
    if (!fs.existsSync(absPath)) return c.json({ error: '폴더가 존재하지 않습니다.' }, 400);

    resetDb();
    const ws = openWorkspace(absPath);
    const db = openDb(ws.dbPath);
    return c.json(buildWorkspaceResponse(ws, db, claudeStatus, codexStatus));
  });

  // provider 선택 변경
  api.put('/workspace/provider', async (c) => {
    if (!hasWorkspace()) return c.json({ error: '워크스페이스가 열려있지 않습니다.' }, 400);
    const body = await c.req.json<{ provider: ProviderType; model: string }>().catch(() => null);
    if (!body?.provider || !body?.model) return c.json({ error: 'provider와 model이 필요합니다.' }, 400);
    if (body.provider !== 'claude' && body.provider !== 'codex') return c.json({ error: '유효하지 않은 provider입니다.' }, 400);
    setProviderModel(getDb(), body.provider, body.model);
    return c.json({ ok: true });
  });

  // Job 폴링
  api.get('/jobs/:id', (c) => {
    if (!hasWorkspace()) return c.json({ error: 'Not found' }, 404);
    const job = getJob(getDb(), c.req.param('id'));
    if (!job) return c.json({ error: 'Not found' }, 404);
    return c.json(job);
  });

  api.route('/workspace', workspaceRoute);
  api.route('/issues', issuesRoute);
  api.route('/init', initRoute);
  api.route('/analyze', analyzeRoute);
  api.route('/apply', applyRoute);
  api.route('/generate', generateRoute);

  app.route('/api', api);

  const dashboardRoot = path.resolve(__dirname, '../dashboard');
  app.use('/*', serveStatic({ root: dashboardRoot }));

  return new Promise((resolve, reject) => {
    const tryListen = (p: number) => {
      const server = serve({ fetch: app.fetch, port: p }, () => {
        console.log(`\n🚀 CodeForge Blueprint`);
        console.log(`🌐 http://localhost:${p}`);
        const ws = getWorkspaceOrNull();
        if (ws) console.log(`📂 Workspace: ${ws.rootPath}`);
        if (claudeStatus.available) {
          console.log(`🤖 Claude CLI: ✓ ${claudeStatus.version ?? claudeStatus.path}`);
        } else {
          console.log(`🤖 Claude CLI: ✗ 미설치 → npm install -g @anthropic-ai/claude-code`);
        }
        if (codexStatus.available) {
          console.log(`🤖 Codex CLI:  ✓ ${codexStatus.version ?? codexStatus.path}`);
        } else {
          console.log(`🤖 Codex CLI:  ✗ 미설치 → npm install -g @openai/codex`);
        }
        console.log('');
        resolve(p);
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') tryListen(p + 1);
        else reject(err);
      });

      process.on('SIGINT', () => { server.close(); process.exit(0); });
      process.on('SIGTERM', () => { server.close(); process.exit(0); });
    };

    tryListen(port);
  });
}
