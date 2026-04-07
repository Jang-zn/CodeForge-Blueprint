import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { upsertIssue, addDecisionLog, getIssue } from '../../src/db/repository.js';
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

  // ─── GET / ─────────────────────────────────────────────────────

  test('GET / — 이슈 목록 반환 (정확한 개수)', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', tab: 'review' }));
    upsertIssue(tw.db, makeIssue({ id: 'i2', tab: 'review' }));

    const res = await app.request('/issues?tab=review', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.issues));
    assert.equal(json.issues.length, 2);
  });

  test('GET / — tab 필터링: features 이슈만 반환', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', tab: 'review' }));
    upsertIssue(tw.db, makeIssue({ id: 'i2', tab: 'features' }));

    const res = await app.request('/issues?tab=features', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.issues.length, 1);
    assert.equal(json.issues[0].id, 'i2');
  });

  test('GET / — 이슈에 decision logs 배열이 포함되고, 빈 배열이어야 함', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1' }));
    const res = await app.request('/issues?tab=review', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(Array.isArray(json.issues[0].logs));
    assert.equal(json.issues[0].logs.length, 0);
  });

  test('GET / — decision log 추가 후 이슈에 포함되어 반환', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1' }));
    addDecisionLog(tw.db, {
      issue_id: 'i1', date: new Date().toISOString(), status: 'resolved',
      old_status: 'pending', memo: '처리함', tab: 'review', reason: null,
    });

    const res = await app.request('/issues?tab=review', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.issues[0].logs.length, 1);
    assert.equal(json.issues[0].logs[0].memo, '처리함');
  });

  // ─── GET /:id/logs ─────────────────────────────────────────────

  test('GET /:id/logs — 특정 이슈의 로그 반환', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1' }));

    const res = await app.request('/issues/i1/logs', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.logs));
    assert.equal(json.logs.length, 0);
  });

  // ─── PUT /:id ──────────────────────────────────────────────────

  test('PUT /:id — 이슈 상태/메모 업데이트 후 DB에 반영 확인', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', status: 'pending', memo: '' }));

    const res = await app.request(
      '/issues/i1',
      jsonPut(tw.sessionId, { status: 'resolved', memo: '해결 완료' }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);

    // DB에서 직접 읽어 실제 반영 확인
    const updated = getIssue(tw.db, 'i1');
    assert.equal(updated?.status, 'resolved');
    assert.equal(updated?.memo, '해결 완료');
  });

  test('PUT /:id — 존재하지 않는 이슈 업데이트는 에러 없이 완료', async () => {
    const res = await app.request(
      '/issues/nonexistent',
      jsonPut(tw.sessionId, { status: 'resolved', memo: '' }),
    );
    // 에러가 발생하지 않아야 함 (200 또는 404)
    assert.ok([200, 404].includes(res.status));
  });

  // ─── GET /recommendations ──────────────────────────────────────

  test('GET /recommendations — tab 파라미터 누락 시 400', async () => {
    const res = await app.request('/issues/recommendations', withSession(tw.sessionId));
    assert.equal(res.status, 400);
  });

  test('GET /recommendations — 유효한 tab으로 객체 반환', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', tab: 'review' }));

    const res = await app.request('/issues/recommendations?tab=review', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json !== null && typeof json === 'object');
  });
});
