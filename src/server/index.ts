import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import path from 'path';
import { fileURLToPath } from 'url';
import { closeAllDbs } from '../db/index.js';
import { initAppDb, closeAppDb } from '../db/app-db.js';
import { cancelJob, getJob } from '../db/repository.js';
import { checkClaude, checkCodex } from '../claude/finder.js';
import { killProcess, killAllProcesses } from '../claude/process-registry.js';
import { createWorkspaceRoute } from './routes/workspace.js';
import issuesRoute from './routes/issues.js';
import initRoute from './routes/init.js';
import analyzeRoute from './routes/analyze.js';
import applyRoute from './routes/apply.js';
import generateRoute from './routes/generate.js';
import decisionsRoute from './routes/decisions.js';
import documentsRoute from './routes/documents.js';
import glossaryRoute from './routes/glossary.js';
import perspectivesRoute from './routes/perspectives.js';
import { getRequestContext } from './context.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _shutdownFn: (() => void) | null = null;

/** Electron main process에서 호출하는 graceful shutdown */
export function shutdownServer(): void {
  if (_shutdownFn) _shutdownFn();
}

export async function startServer(port: number): Promise<number> {
  initAppDb();
  const [claudeStatus, codexStatus] = await Promise.all([checkClaude(), checkCodex()]);

  const app = new Hono();
  const api = new Hono();

  api.route('/workspace', createWorkspaceRoute(claudeStatus, codexStatus));

  api.get('/jobs/:id', (c) => {
    const reqCtx = getRequestContext(c);
    if (!reqCtx) return c.json({ error: 'Not found' }, 404);
    const job = getJob(reqCtx.db, c.req.param('id'));
    if (!job) return c.json({ error: 'Not found' }, 404);
    return c.json(job);
  });

  api.post('/jobs/:id/cancel', (c) => {
    const reqCtx = getRequestContext(c);
    if (!reqCtx) return c.json({ error: 'Not found' }, 404);
    cancelJob(reqCtx.db, c.req.param('id'));
    killProcess(c.req.param('id'));
    return c.json({ ok: true });
  });

  api.route('/issues', issuesRoute);
  api.route('/init', initRoute);
  api.route('/analyze', analyzeRoute);
  api.route('/apply', applyRoute);
  api.route('/generate', generateRoute);
  api.route('/decisions', decisionsRoute);
  api.route('/documents', documentsRoute);
  api.route('/glossary', glossaryRoute);
  api.route('/perspectives', perspectivesRoute);

  app.route('/api', api);

  const dashboardRoot = path.resolve(__dirname, '../dashboard');
  app.use('/*', serveStatic({ root: dashboardRoot }));

  return new Promise((resolve, reject) => {
    const tryListen = (p: number) => {
      const server = serve({ fetch: app.fetch, port: p }, () => {
        // port 0이면 OS가 할당한 실제 포트를 가져옴
        const addr = server.address();
        const actualPort = (typeof addr === 'object' && addr !== null) ? addr.port : p;

        console.log(`\n🚀 CodeForge Blueprint`);
        console.log(`🌐 http://localhost:${actualPort}`);
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
        resolve(actualPort);
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') tryListen(p + 1);
        else reject(err);
      });

      const shutdown = () => {
        server.close();
        killAllProcesses();
        closeAppDb();
        closeAllDbs();
        // Electron 모드에서는 process.exit을 Electron이 제어
        if (!process.env.CODEFORGE_ELECTRON) process.exit(0);
      };

      _shutdownFn = shutdown;

      // CLI 모드에서만 시그널 핸들러 등록 (Windows GUI 앱에서는 비신뢰적)
      if (!process.env.CODEFORGE_ELECTRON) {
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      }
    };

    tryListen(port);
  });
}
