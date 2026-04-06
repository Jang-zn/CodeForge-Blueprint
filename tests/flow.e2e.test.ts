import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Hono } from 'hono';
import { closeAllDbs, getDb } from '../src/db/index.js';
import { createWorkspaceRoute } from '../src/server/routes/workspace.js';
import initRoute from '../src/server/routes/init.js';
import analyzeRoute from '../src/server/routes/analyze.js';
import applyRoute from '../src/server/routes/apply.js';
import generateRoute from '../src/server/routes/generate.js';
import issuesRoute from '../src/server/routes/issues.js';
import { getJob } from '../src/db/repository.js';
import { getRequestContext } from '../src/server/context.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-e2e-'));
}

async function waitForJob(sessionId: string, jobId: string) {
  for (let i = 0; i < 40; i++) {
    const job = getJob(getDb(), jobId);
    if (job?.status === 'completed' || job?.status === 'failed') return job;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`job timeout: ${jobId}`);
}

describe('end-to-end flow', () => {
  let tmpDir: string;
  let app: Hono;

  beforeEach(() => {
    tmpDir = makeTempDir();
    process.env.CODEFORGE_BLUEPRINT_HOME = path.join(tmpDir, '.state');
    process.env.CODEFORGE_MOCK_PROVIDER = '1';

    app = new Hono();
    app.route('/workspace', createWorkspaceRoute({ available: true, version: 'mock' }, { available: true, version: 'mock' }));
    app.get('/jobs/:id', (c) => {
      const reqCtx = getRequestContext(c);
      if (!reqCtx) return c.json({ error: 'Not found' }, 404);
      const job = getJob(reqCtx.db, c.req.param('id'));
      return job ? c.json(job) : c.json({ error: 'Not found' }, 404);
    });
    app.route('/init', initRoute);
    app.route('/analyze', analyzeRoute);
    app.route('/apply', applyRoute);
    app.route('/generate', generateRoute);
    app.route('/issues', issuesRoute);
  });

  afterEach(() => {
    delete process.env.CODEFORGE_MOCK_PROVIDER;
    closeAllDbs();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('workspace open -> init -> analyze -> apply -> features -> generate', async () => {
    const openRes = await app.request('/workspace/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: tmpDir }),
    });
    assert.equal(openRes.status, 200);
    const opened = await openRes.json();
    const sessionId = opened.sessionId as string;
    const headers = { 'Content-Type': 'application/json', 'x-codeforge-session': sessionId };

    const initRes = await app.request('/init', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectName: 'Mock Project',
        tagline: 'Mock tagline',
        serviceType: 'web-fullstack',
        deployTargets: ['web-browser'],
        targets: ['b2c'],
        revenues: ['freemium'],
        features: ['ai'],
        feTech: ['react'],
        beTech: ['nodejs'],
        storageTech: ['postgresql'],
        detail: '사용자가 아이디어를 입력하면 문서와 설계를 생성합니다.',
      }),
    });
    const { jobId: initJobId } = await initRes.json();
    assert.equal((await waitForJob(sessionId, initJobId))?.status, 'completed');

    const reviewRes = await app.request('/analyze', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tab: 'review' }),
    });
    const { jobId: reviewJobId } = await reviewRes.json();
    assert.equal((await waitForJob(sessionId, reviewJobId))?.status, 'completed');

    const issuesRes = await app.request('/issues?tab=review', { headers: { 'x-codeforge-session': sessionId } });
    const issuesJson = await issuesRes.json();
    assert.ok(issuesJson.issues.length >= 1);

    const applyRes = await app.request('/apply', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tab: 'review', issues: issuesJson.issues.map((issue: any, index: number) => ({ id: issue.id, status: index === 0 ? 'resolved' : 'deferred', memo: '' })) }),
    });
    const { jobId: applyJobId } = await applyRes.json();
    assert.equal((await waitForJob(sessionId, applyJobId))?.status, 'completed');

    const featuresRes = await app.request('/analyze', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tab: 'features' }),
    });
    const { jobId: featuresJobId } = await featuresRes.json();
    assert.equal((await waitForJob(sessionId, featuresJobId))?.status, 'completed');

    const generateRes = await app.request('/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tab: 'review' }),
    });
    const generated = await generateRes.json();
    assert.equal((await waitForJob(sessionId, generated.jobId))?.status, 'completed');
    assert.ok(fs.existsSync(path.join(tmpDir, 'docs', generated.filename)));
  });
});
