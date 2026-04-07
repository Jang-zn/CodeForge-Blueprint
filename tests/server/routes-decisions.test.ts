import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { upsertIssue, addDecisionLog } from '../../src/db/repository.js';
import decisionsRoute from '../../src/server/routes/decisions.js';

import { setupTestWorkspace, makeIssue, withSession, type TestWorkspace } from '../helpers.js';

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
    assert.ok('total' in json);
    assert.ok('stats' in json);
  });

  test('GET / — 결정 로그가 있으면 타임라인에 포함', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1', status: 'resolved' }));
    addDecisionLog(tw.db, {
      issue_id: 'd1',
      date: new Date().toISOString(),
      status: 'resolved',
      old_status: 'pending',
      memo: '해결함',
      tab: 'review',
      reason: null,
    });

    const res = await app.request('/decisions', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(json.decisions.length >= 1);
    assert.ok(json.total >= 1);
  });

  test('GET / — tab 필터', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1', tab: 'review' }));
    addDecisionLog(tw.db, {
      issue_id: 'd1', date: new Date().toISOString(), status: 'resolved',
      old_status: 'pending', memo: '', tab: 'review', reason: null,
    });

    const res = await app.request('/decisions?tab=features', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.decisions.length, 0);
  });

  test('GET / — status 필터', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1' }));
    addDecisionLog(tw.db, {
      issue_id: 'd1', date: new Date().toISOString(), status: 'resolved',
      old_status: 'pending', memo: '', tab: 'review', reason: null,
    });

    const res = await app.request('/decisions?status=resolved', withSession(tw.sessionId));
    const json = await res.json();
    // resolved 결정만 포함되어야 함
    for (const d of json.decisions) {
      assert.equal(d.status, 'resolved');
    }
  });

  test('GET / — page/limit 페이지네이션', async () => {
    upsertIssue(tw.db, makeIssue({ id: 'd1' }));
    for (let i = 0; i < 3; i++) {
      addDecisionLog(tw.db, {
        issue_id: 'd1', date: new Date().toISOString(), status: 'resolved',
        old_status: 'pending', memo: `memo-${i}`, tab: 'review', reason: null,
      });
    }

    const res = await app.request('/decisions?limit=2&page=1', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(json.decisions.length <= 2);
    assert.ok(json.total >= 3);
  });

  test('GET / — stats 객체 포함', async () => {
    const res = await app.request('/decisions', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(typeof json.stats === 'object');
  });

  test('GET / — deferredReminders 배열 포함', async () => {
    const res = await app.request('/decisions', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(Array.isArray(json.deferredReminders));
  });
});
