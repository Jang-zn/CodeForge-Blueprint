import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import path from 'path';
import { fileURLToPath } from 'url';
import type { WorkspaceContext } from '../workspace.js';
import { openDb } from '../db/index.js';
import { getWorkspaceMeta, getJob, getProviderModel, setProviderModel, type ProviderType } from '../db/repository.js';
import { checkClaude, checkCodex } from '../claude/finder.js';
import workspaceRoute from './routes/workspace.js';
import issuesRoute from './routes/issues.js';
import initRoute from './routes/init.js';
import analyzeRoute from './routes/analyze.js';
import applyRoute from './routes/apply.js';
import generateRoute from './routes/generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startServer(workspace: WorkspaceContext, port: number): Promise<number> {
  // DB 초기화
  const db = openDb(workspace.dbPath);

  // AI 바이너리 연결 확인
  const [claudeStatus, codexStatus] = await Promise.all([checkClaude(), checkCodex()]);

  const app = new Hono();

  // API 라우트
  const api = new Hono();

  // 워크스페이스 정보 (대시보드 초기 로드용)
  api.get('/workspace', (c) => {
    const meta = getWorkspaceMeta(db);
    return c.json({
      name: workspace.name,
      rootPath: workspace.rootPath,
      docsPath: workspace.docsPath,
      prd_path: meta?.prd_path ?? null,
      claudeAvailable: claudeStatus.available,
      claudeVersion: claudeStatus.version,
      codexAvailable: codexStatus.available,
      codexVersion: codexStatus.version,
      providerModel: getProviderModel(db),
    });
  });

  // provider 선택 변경
  api.put('/workspace/provider', async (c) => {
    const body = await c.req.json<{ provider: ProviderType; model: string }>().catch(() => null);
    if (!body?.provider || !body?.model) return c.json({ error: 'provider와 model이 필요합니다.' }, 400);
    if (body.provider !== 'claude' && body.provider !== 'codex') return c.json({ error: '유효하지 않은 provider입니다.' }, 400);
    setProviderModel(db, body.provider, body.model);
    return c.json({ ok: true });
  });

  // Job 폴링
  api.get('/jobs/:id', (c) => {
    const job = getJob(db, c.req.param('id'));
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

  // 정적 파일 서빙 (dev: src/server → src/dashboard, prod: dist/server → dist/dashboard)
  const dashboardRoot = path.resolve(__dirname, '../dashboard');
  app.use('/*', serveStatic({ root: dashboardRoot }));

  return new Promise((resolve, reject) => {
    const tryListen = (p: number) => {
      const server = serve({ fetch: app.fetch, port: p }, () => {
        console.log(`\n🚀 CodeForge Blueprint`);
        console.log(`📂 Workspace: ${workspace.rootPath}`);
        console.log(`🌐 http://localhost:${p}`);
        if (claudeStatus.available) {
          console.log(`🤖 Claude CLI: ✓ ${claudeStatus.version ?? claudeStatus.path}`);
        } else {
          console.log(`🤖 Claude CLI: ✗ 미설치 → npm install -g @anthropic-ai/claude-code`);
        }
        if (codexStatus.available) {
          console.log(`🤖 Codex CLI:  ✓ ${codexStatus.version ?? codexStatus.path}`);
        }
        console.log('');
        resolve(p);
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          tryListen(p + 1);
        } else {
          reject(err);
        }
      });

      process.on('SIGINT', () => { server.close(); process.exit(0); });
      process.on('SIGTERM', () => { server.close(); process.exit(0); });
    };

    tryListen(port);
  });
}
