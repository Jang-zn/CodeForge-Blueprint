import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Hono } from 'hono';
import { openDb, resetDb, getDb, closeAllDbs } from '../../src/db/index.js';
import { upsertIssue, getIssue, getIssues, createIssuePreview } from '../../src/db/repository.js';
import { openWorkspace, type WorkspaceContext } from '../../src/workspace.js';
import { initAppDb, closeAppDb } from '../../src/db/app-db.js';
import applyRoute from '../../src/server/routes/apply.js';
import generateRoute from '../../src/server/routes/generate.js';
import { createWorkspaceRoute } from '../../src/server/routes/workspace.js';

import { makeTempDir, cleanDir, makeIssue, waitForJob } from '../helpers.js';

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
    upsertIssue(getDb(), makeIssue({ id: 'a1' }));
    // draft를 issue_preview에 미리 저장 (PUT /issues/:id 동작과 동일)
    createIssuePreview(getDb(), 'a1', 'resolved', '');

    const app = new Hono();
    app.route('/apply', applyRoute);

    const res = await app.request('/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-codeforge-session': ws.sessionId },
      body: JSON.stringify({ tab: 'review' }),
    });

    assert.equal(res.status, 200);
    const { jobId } = await res.json();
    const job = await waitForJob(getDb(), jobId);
    assert.equal(job?.status, 'completed');
    assert.equal(getIssue(getDb(), 'a1')?.status, 'resolved');
    assert.equal(getIssue(getDb(), 'a1')?.memo, '');
  });

  test('같은 review 이슈를 다시 deferred 처리해도 features 탭에 중복 생성되지 않는다', async () => {
    upsertIssue(getDb(), makeIssue({ id: 'a1', title: '원본 이슈' }));

    const app = new Hono();
    app.route('/apply', applyRoute);

    // 첫 번째 apply: draft 세팅 후 apply
    createIssuePreview(getDb(), 'a1', 'deferred', '다음 버전 검토');
    const res1 = await app.request('/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-codeforge-session': ws.sessionId },
      body: JSON.stringify({ tab: 'review' }),
    });
    const { jobId: jobId1 } = await res1.json();
    await waitForJob(getDb(), jobId1);

    // 두 번째 apply: 동일한 draft 재세팅 후 apply
    createIssuePreview(getDb(), 'a1', 'deferred', '다음 버전 검토');
    const res2 = await app.request('/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-codeforge-session': ws.sessionId },
      body: JSON.stringify({ tab: 'review' }),
    });
    const { jobId: jobId2 } = await res2.json();
    await waitForJob(getDb(), jobId2);

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
