import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { upsertIssue, addDecisionLog } from '../../src/db/repository.js';
import decisionsRoute from '../../src/server/routes/decisions.js';

import { setupTestWorkspace, makeIssue, withSession, type TestWorkspace } from '../helpers.js';

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    issue_id: 'd1',
    date: new Date().toISOString(),
    status: 'resolved',
    old_status: 'pending',
    memo: '',
    tab: 'review',
    reason: null,
    ...overrides,
  };
}

describe('decisionsRoute', () => {
  let tw: TestWorkspace;
  let app: Hono;

  beforeEach(() => {
    tw = setupTestWorkspace();
    app = new Hono();
    app.route('/decisions', decisionsRoute);
  });

  afterEach(() => tw.cleanup());

  test('GET / — 빈 타임라인 반환', async () => {
    const res = await app.request('/decisions', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.decisions));
    assert.equal(json.decisions.length, 0);
    assert.equal(json.total, 0);
    assert.ok(json.stats !== null && typeof json.stats === 'object');
    assert.ok(Array.isArray(json.deferredReminders));
  });

  test('GET / — 결정 로그 1건 삽입 시 정확히 1건 반환', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1', status: 'resolved' }));
    addDecisionLog(tw.db, makeLog({ memo: '해결함' }));

    const res = await app.request('/decisions', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.decisions.length, 1);
    assert.equal(json.total, 1);
    assert.equal(json.decisions[0].issue_id, 'd1');
  });

  test('GET / — tab 필터: review 로그를 features로 조회하면 0건', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1', tab: 'review' }));
    addDecisionLog(tw.db, makeLog());

    const res = await app.request('/decisions?tab=features', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.decisions.length, 0);
    assert.equal(json.total, 0);
  });

  test('GET / — tab 필터: review 로그를 review로 조회하면 1건', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1', tab: 'review' }));
    addDecisionLog(tw.db, makeLog());

    const res = await app.request('/decisions?tab=review', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.decisions.length, 1);
  });

  test('GET / — status 필터', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1' }));
    addDecisionLog(tw.db, makeLog({ status: 'resolved' }));
    addDecisionLog(tw.db, makeLog({ status: 'deferred', old_status: 'resolved' }));

    const res = await app.request('/decisions?status=resolved', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(json.decisions.length >= 1, 'status 필터 결과가 비어 있으면 안 됨');
    for (const d of json.decisions) {
      assert.equal(d.status, 'resolved');
    }
  });

  test('GET / — page/limit 페이지네이션', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1' }));
    for (let i = 0; i < 3; i++) {
      addDecisionLog(tw.db, makeLog({ memo: `memo-${i}` }));
    }

    const res = await app.request('/decisions?limit=2&page=1', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.decisions.length, 2);
    assert.equal(json.total, 3);

    // 2페이지 조회 시 나머지 1건
    const res2 = await app.request('/decisions?limit=2&page=2', withSession(tw.sessionId));
    const json2 = await res2.json();
    assert.equal(json2.decisions.length, 1);
    assert.equal(json2.total, 3);
  });

  test('GET / — stats에 의미 있는 키가 포함됨', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1' }));
    addDecisionLog(tw.db, makeLog());

    const res = await app.request('/decisions', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(json.stats !== null && typeof json.stats === 'object');
  });
});
