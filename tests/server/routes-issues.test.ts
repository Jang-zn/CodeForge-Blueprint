import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { upsertIssue, addDecisionLog, getIssue, getIssuePreview } from '../../src/db/repository.js';
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

  test('PUT /:id — 이슈 상태/메모 업데이트 후 draft(issue_preview)에 저장 확인', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'i1', status: 'pending', memo: '' }));

    const res = await app.request(
      '/issues/i1',
      jsonPut(tw.sessionId, { status: 'resolved', memo: '해결 완료' }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);

    // issues 테이블은 applied 상태 유지 (draft는 issue_preview에 저장)
    const applied = getIssue(tw.db, 'i1');
    assert.equal(applied?.status, 'pending');

    // draft가 issue_preview에 저장됨
    const draft = getIssuePreview(tw.db, 'i1');
    assert.equal(draft?.preview_status, 'resolved');
    assert.equal(draft?.preview_memo, '해결 완료');
  });

  test('PUT /:id — 존재하지 않는 이슈 업데이트는 에러 없이 완료', async () => {
    const res = await app.request(
      '/issues/nonexistent',
      jsonPut(tw.sessionId, { status: 'resolved', memo: '' }),
    );
    // 에러가 발생하지 않아야 함 (200 또는 404)
    assert.ok([200, 404].includes(res.status));
  });

  // ─── PUT /:id — tab-aware status validation ──────────────────

  test('PUT /:id — features 탭에서 candidate 상태 허용', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'ft-1', tab: 'features', status: 'pending' }));
    const res = await app.request(
      '/issues/ft-1',
      jsonPut(tw.sessionId, { status: 'candidate', memo: 'Build 후보' }),
    );
    assert.equal(res.status, 200);
    const draft = getIssuePreview(tw.db, 'ft-1');
    assert.equal(draft?.preview_status, 'candidate');
  });

  test('PUT /:id — review 탭에서 candidate 상태 거부 (400)', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'rv-1', tab: 'review', status: 'pending' }));
    const res = await app.request(
      '/issues/rv-1',
      jsonPut(tw.sessionId, { status: 'candidate', memo: '' }),
    );
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error.includes('features'));
  });

  test('PUT /:id — backend 탭에서 promoted 상태 거부 (400)', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'be-1', tab: 'backend', status: 'pending' }));
    const res = await app.request(
      '/issues/be-1',
      jsonPut(tw.sessionId, { status: 'promoted', memo: '' }),
    );
    assert.equal(res.status, 400);
  });

  test('PUT /:id — frontend 탭에서 archived 상태 거부 (400)', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'fe-1', tab: 'frontend', status: 'pending' }));
    const res = await app.request(
      '/issues/fe-1',
      jsonPut(tw.sessionId, { status: 'archived', memo: '' }),
    );
    assert.equal(res.status, 400);
  });

  test('PUT /:id — 존재하지 않는 이슈는 404', async () => {
    const res = await app.request(
      '/issues/nonexistent-xyz',
      jsonPut(tw.sessionId, { status: 'candidate', memo: '' }),
    );
    assert.equal(res.status, 404);
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
