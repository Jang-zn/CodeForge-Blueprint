import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import baselinesRoute from '../../src/server/routes/baselines.js';
import workflowRoute from '../../src/server/routes/workflow.js';
import { setupTestWorkspace, jsonPost, withSession, type TestWorkspace } from '../helpers.js';
import { createBaseline, addDocumentRecord } from '../../src/db/repository.js';

describe('baselinesRoute', () => {
  let tw: TestWorkspace;
  let app: Hono;

  beforeEach(() => {
    tw = setupTestWorkspace();
    app = new Hono();
    app.route('/baselines', baselinesRoute);
  });

  afterEach(() => tw.cleanup());

  // ─── GET /baselines ────────────────────────────────────────────────

  test('GET /baselines — 빈 상태에서 빈 배열 반환', async () => {
    const res = await app.request('/baselines', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json));
    assert.equal(json.length, 0);
  });

  test('GET /baselines?tab=review — 탭별 필터링', async () => {
    createBaseline(tw.db, 'review', '1.0.0', null);
    createBaseline(tw.db, 'ux', '1.0.0', null);

    const res = await app.request('/baselines?tab=review', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.length, 1);
    assert.equal(json[0].tab, 'review');
  });

  // ─── GET /baselines/active ─────────────────────────────────────────

  test('GET /baselines/active — 전체 탭 활성 baseline 맵 반환', async () => {
    const res = await app.request('/baselines/active', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok('review' in json);
    assert.ok('ux' in json);
    assert.ok('backend' in json);
    assert.ok('frontend' in json);
    assert.ok('features' in json);
  });

  test('GET /baselines/active?tab=review — 단일 탭 활성 baseline', async () => {
    createBaseline(tw.db, 'review', '1.0.0', null);
    const res = await app.request('/baselines/active?tab=review', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.version, '1.0.0');
    assert.equal(json.tab, 'review');
  });

  // ─── GET /baselines/freeze-readiness ──────────────────────────────

  test('GET /freeze-readiness — tab 미전달 시 400', async () => {
    const res = await app.request('/baselines/freeze-readiness', withSession(tw.sessionId));
    assert.equal(res.status, 400);
  });

  test('GET /freeze-readiness?tab=review — review는 항상 ready', async () => {
    const res = await app.request('/baselines/freeze-readiness?tab=review', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ready, true);
  });

  test('GET /freeze-readiness?tab=ux — review baseline 없으면 not ready', async () => {
    const res = await app.request('/baselines/freeze-readiness?tab=ux', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ready, false);
    assert.ok(json.reasons.length > 0);
  });

  // ─── POST /baselines/freeze ────────────────────────────────────────

  test('POST /freeze — tab 미전달 시 400', async () => {
    const res = await app.request('/baselines/freeze', jsonPost(tw.sessionId, {}));
    assert.equal(res.status, 400);
  });

  test('POST /freeze — review 탭 baseline 생성 성공', async () => {
    const res = await app.request('/baselines/freeze', jsonPost(tw.sessionId, { tab: 'review' }));
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.tab, 'review');
    assert.equal(json.version, '1.0.0');
  });

  test('POST /freeze — 두 번째 freeze는 버전 +1 (1.0.1)', async () => {
    await app.request('/baselines/freeze', jsonPost(tw.sessionId, { tab: 'review' }));
    const res = await app.request('/baselines/freeze', jsonPost(tw.sessionId, { tab: 'review' }));
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.version, '1.0.1');
  });

  test('POST /freeze — ux 탭: review baseline 없으면 400', async () => {
    const res = await app.request('/baselines/freeze', jsonPost(tw.sessionId, { tab: 'ux' }));
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.reasons !== undefined);
  });

  test('POST /freeze — ux 탭: review baseline 있으면 성공', async () => {
    createBaseline(tw.db, 'review', '1.0.0', null);
    const res = await app.request('/baselines/freeze', jsonPost(tw.sessionId, { tab: 'ux' }));
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.tab, 'ux');
  });

  test('POST /freeze — 문서 스냅샷이 있으면 doc_snapshot에 저장', async () => {
    // 문서 추가
    addDocumentRecord(tw.db, {
      tab: 'review',
      version: '1.0.0',
      kind: 'analysis',
      file_path: '/test/doc.md',
      source_version: null,
      source_job_id: null,
    });
    const res = await app.request('/baselines/freeze', jsonPost(tw.sessionId, { tab: 'review' }));
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.ok(json.doc_snapshot !== null);
  });
});

describe('workflowRoute', () => {
  let tw: TestWorkspace;
  let app: Hono;

  beforeEach(() => {
    tw = setupTestWorkspace();
    app = new Hono();
    app.route('/workflow', workflowRoute);
  });

  afterEach(() => tw.cleanup());

  // ─── GET /workflow/stages ─────────────────────────────────────────

  test('GET /workflow/stages — 5개 탭 순서 반환', async () => {
    const res = await app.request('/workflow/stages', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.stages));
    assert.equal(json.stages.length, 5);
    assert.equal(json.stages[0].tab, 'review');
    assert.equal(json.stages[1].tab, 'ux');
    assert.equal(json.stages[2].tab, 'backend');
    assert.equal(json.stages[3].tab, 'frontend');
    assert.equal(json.stages[4].tab, 'features');
  });

  test('GET /workflow/stages — review는 항상 unlocked', async () => {
    const res = await app.request('/workflow/stages', withSession(tw.sessionId));
    const json = await res.json();
    const review = json.stages.find((s: any) => s.tab === 'review');
    assert.equal(review.isLocked, false);
  });

  test('GET /workflow/stages — baseline 없으면 ux~features 모두 locked', async () => {
    const res = await app.request('/workflow/stages', withSession(tw.sessionId));
    const json = await res.json();
    for (const stage of json.stages) {
      if (stage.tab === 'review') continue;
      assert.equal(stage.isLocked, true, `${stage.tab} should be locked`);
    }
  });

  test('GET /workflow/stages — review baseline 생성 후 ux unlocked', async () => {
    createBaseline(tw.db, 'review', '1.0.0', null);
    const res = await app.request('/workflow/stages', withSession(tw.sessionId));
    const json = await res.json();
    const ux = json.stages.find((s: any) => s.tab === 'ux');
    assert.equal(ux.isLocked, false);
    const backend = json.stages.find((s: any) => s.tab === 'backend');
    assert.equal(backend.isLocked, true);
  });

  test('GET /workflow/stages — activeBaseline이 있으면 버전 포함', async () => {
    createBaseline(tw.db, 'review', '2.1.0', null);
    const res = await app.request('/workflow/stages', withSession(tw.sessionId));
    const json = await res.json();
    const review = json.stages.find((s: any) => s.tab === 'review');
    assert.ok(review.activeBaseline !== null);
    assert.equal(review.activeBaseline.version, '2.1.0');
  });
});
