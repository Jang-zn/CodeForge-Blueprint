import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { getDb } from '../../src/db/index.js';
import { upsertIssue, updateIssueUserAction } from '../../src/db/repository.js';
import issuesRoute from '../../src/server/routes/issues.js';

import { setupTestWorkspace, makeIssue, withSession, jsonPut, type TestWorkspace } from '../helpers.js';

describe('issuesRoute', () => {
  let tw: TestWorkspace;
  let app: Hono;

  beforeEach(() => {
    tw = setupTestWorkspace();
    app = new Hono();
    app.route('/issues', issuesRoute);
  });

  afterEach(() => tw.cleanup());

  test('GET / — 이슈 목록 반환', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', tab: 'review' }));
    upsertIssue(tw.db, makeIssue({ id: 'i2', tab: 'review' }));

    const res = await app.request('/issues?tab=review', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.issues));
    assert.equal(json.issues.length, 2);
  });

  test('GET / — tab 필터링', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', tab: 'review' }));
    upsertIssue(tw.db, makeIssue({ id: 'i2', tab: 'features' }));

    const res = await app.request('/issues?tab=features', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.issues.length, 1);
    assert.equal(json.issues[0].id, 'i2');
  });

  test('GET / — 이슈에 decision logs가 포함된다', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1' }));
    // logs는 빈 배열이라도 항상 포함되어야 함
    const res = await app.request('/issues?tab=review', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok('logs' in json.issues[0]);
  });

  test('GET /:id/logs — 특정 이슈의 로그 반환', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1' }));

    const res = await app.request('/issues/i1/logs', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.logs));
  });

  test('PUT /:id — 이슈 상태/메모 업데이트', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', status: 'pending' }));

    const res = await app.request(
      '/issues/i1',
      jsonPut(tw.sessionId, { status: 'resolved', memo: '해결 완료' }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
  });

  test('GET /recommendations — tab 파라미터 필수', async () => {
    const res = await app.request('/issues/recommendations', withSession(tw.sessionId));
    assert.equal(res.status, 400);
  });

  test('GET /recommendations — 유효한 tab으로 200 반환', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', tab: 'review' }));

    const res = await app.request('/issues/recommendations?tab=review', withSession(tw.sessionId));
    assert.equal(res.status, 200);
  });
});
