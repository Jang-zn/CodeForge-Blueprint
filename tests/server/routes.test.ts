import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Hono } from 'hono';
import { openDb, resetDb, getDb, closeAllDbs } from '../../src/db/index.js';
import { upsertIssue, getIssue, getIssues } from '../../src/db/repository.js';
import { openWorkspace, type WorkspaceContext } from '../../src/workspace.js';
import { initAppDb, closeAppDb } from '../../src/db/app-db.js';
import applyRoute from '../../src/server/routes/apply.js';
import generateRoute from '../../src/server/routes/generate.js';
import { createWorkspaceRoute } from '../../src/server/routes/workspace.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-route-test-'));
}

function cleanDir(dir: string) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function makeIssue(id: string, title = '테스트 이슈') {
  return {
    id,
    tab: 'review' as const,
    category: 'A',
    title,
    html_content: '<p>내용</p>',
    tag: null,
    priority: 'high',
    badge: null,
    status: 'pending' as const,
    memo: '',
    sort_order: 0,
    origin_id: null,
    assignee: null,
    updated_by: null,
    applied_at: null,
    source_run_id: null,
    confidence: null,
  };
}

async function waitForJob(id: string) {
  for (let i = 0; i < 20; i++) {
    const job = getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as { status: string; error?: string | null } | undefined;
    if (job?.status === 'completed' || job?.status === 'failed') return job;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`job timeout: ${id}`);
}

describe('applyRoute', () => {
  let tmpDir: string;
  let ws: WorkspaceContext;

  beforeEach(() => {
    tmpDir = makeTempDir();
    process.env.CODEFORGE_BLUEPRINT_HOME = path.join(tmpDir, '.state');
    initAppDb();
    ws = openWorkspace(tmpDir);
    openDb(ws.dbPath);
  });

  afterEach(() => {
    resetDb();
    closeAllDbs();
    closeAppDb();
    cleanDir(tmpDir);
  });

  test('메모 없이 상태만 바꿔도 이슈 상태가 DB에 저장된다', async () => {
    upsertIssue(getDb(), makeIssue('a1'));

    const app = new Hono();
    app.route('/apply', applyRoute);

    const res = await app.request('/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-codeforge-session': ws.sessionId },
      body: JSON.stringify({ tab: 'review', issues: [{ id: 'a1', status: 'resolved', memo: '' }] }),
    });

    assert.equal(res.status, 200);
    const { jobId } = await res.json();
    const job = await waitForJob(jobId);
    assert.equal(job?.status, 'completed');
    assert.equal(getIssue(getDb(), 'a1')?.status, 'resolved');
    assert.equal(getIssue(getDb(), 'a1')?.memo, '');
  });

  test('같은 review 이슈를 다시 deferred 처리해도 features 탭에 중복 생성되지 않는다', async () => {
    upsertIssue(getDb(), makeIssue('a1', '원본 이슈'));

    const app = new Hono();
    app.route('/apply', applyRoute);

    const requestBody = { tab: 'review', issues: [{ id: 'a1', status: 'deferred', memo: '다음 버전 검토' }] };

    const res1 = await app.request('/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-codeforge-session': ws.sessionId },
      body: JSON.stringify(requestBody),
    });
    const { jobId: jobId1 } = await res1.json();
    await waitForJob(jobId1);

    const res2 = await app.request('/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-codeforge-session': ws.sessionId },
      body: JSON.stringify(requestBody),
    });
    const { jobId: jobId2 } = await res2.json();
    await waitForJob(jobId2);

    const featureIssues = getIssues(getDb(), 'features').filter(issue => issue.origin_id === 'a1');
    assert.equal(featureIssues.length, 1);
    assert.equal(featureIssues[0].tag, 'deferred');
  });
});

describe('generateRoute', () => {
  let tmpDir: string;
  let ws: WorkspaceContext;

  beforeEach(() => {
    tmpDir = makeTempDir();
    process.env.CODEFORGE_BLUEPRINT_HOME = path.join(tmpDir, '.state');
    initAppDb();
    ws = openWorkspace(tmpDir);
    openDb(ws.dbPath);
    fs.mkdirSync(ws.docsPath, { recursive: true });
    fs.writeFileSync(path.join(ws.docsPath, 'review-1.0.0.md'), '# test', 'utf-8');
  });

  afterEach(() => {
    resetDb();
    closeAllDbs();
    closeAppDb();
    cleanDir(tmpDir);
  });

  test('다운로드 라우트는 경로 탐색 요청을 차단한다', async () => {
    const app = new Hono();
    app.route('/generate', generateRoute);

    const res = await app.request('/generate/download/../package.json', { headers: { 'x-codeforge-session': ws.sessionId } });
    assert.equal(res.status, 404);
  });
});

describe('workspaceRoute', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    process.env.CODEFORGE_BLUEPRINT_HOME = path.join(tmpDir, '.state');
    initAppDb();
  });

  afterEach(() => {
    resetDb();
    closeAllDbs();
    closeAppDb();
    cleanDir(tmpDir);
  });

  test('파일 경로는 워크스페이스로 열 수 없다', async () => {
    const filePath = path.join(tmpDir, 'note.txt');
    fs.writeFileSync(filePath, 'x', 'utf-8');

    const app = new Hono();
    app.route('/workspace', createWorkspaceRoute({ available: false }, { available: false }));

    const res = await app.request('/workspace/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /폴더 경로만 열 수 있습니다/);
  });
});
