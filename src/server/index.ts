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
import { getRequestContext } from './context.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  app.route('/api', api);

  const dashboardRoot = path.resolve(__dirname, '../dashboard');
  app.use('/*', serveStatic({ root: dashboardRoot }));

  return new Promise((resolve, reject) => {
    const tryListen = (p: number) => {
      const server = serve({ fetch: app.fetch, port: p }, () => {
        console.log(`\n🚀 CodeForge Blueprint`);
        console.log(`🌐 http://localhost:${p}`);
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

      const shutdown = () => {
        server.close();
        killAllProcesses();
        closeAppDb();
        closeAllDbs();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    };

    tryListen(port);
  });
}
