import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  createPerspective,
  getPerspectives,
  getPerspective,
  lockPerspective,
} from '../../src/db/repository.js';
import perspectivesRoute from '../../src/server/routes/perspectives.js';
import { setupTestWorkspace, withSession, jsonPost, jsonPut, type TestWorkspace } from '../helpers.js';

describe('perspectivesRoute', () => {
  let tw: TestWorkspace;
  let app: Hono;

  beforeEach(() => {
    tw = setupTestWorkspace();
    app = new Hono();
    app.route('/perspectives', perspectivesRoute);
  });

  afterEach(() => tw.cleanup());

  // ─── GET / ─────────────────────────────────────────────────────

  test('GET / — 전체 perspectives 반환', async () => {
    createPerspective(tw.db, { type: 'review', name: 'Product' });
    createPerspective(tw.db, { type: 'review', name: 'Ops' });

    const res = await app.request('/perspectives', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.perspectives));
    assert.equal(json.perspectives.length, 2);
  });

  test('GET / — type 파라미터로 필터링', async () => {
    createPerspective(tw.db, { type: 'review', name: 'Product' });
    createPerspective(tw.db, { type: 'features', name: 'Marketing' });

    const res = await app.request('/perspectives?type=review', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.perspectives.length, 1);
    assert.equal(json.perspectives[0].type, 'review');
  });

  // ─── GET /:id ──────────────────────────────────────────────────

  test('GET /:id — 특정 perspective 반환', async () => {
    const p = createPerspective(tw.db, { type: 'review', name: 'PM' });

    const res = await app.request(`/perspectives/${p.id}`, withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.perspective.id, p.id);
    assert.equal(json.perspective.name, 'PM');
  });

  test('GET /:id — 존재하지 않는 ID는 404', async () => {
    const res = await app.request('/perspectives/999', withSession(tw.sessionId));
    assert.equal(res.status, 404);
  });

  // ─── POST / ────────────────────────────────────────────────────

  test('POST / — 새로운 perspective 생성', async () => {
    const res = await app.request(
      '/perspectives',
      jsonPost(tw.sessionId, { type: 'review', name: 'PM', description: '제품 관리자 관점' }),
    );
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.ok(json.perspective.id);
    assert.equal(json.perspective.type, 'review');
    assert.equal(json.perspective.name, 'PM');
    assert.equal(json.perspective.description, '제품 관리자 관점');
    assert.equal(json.perspective.is_locked, 0);
  });

  test('POST / — description 생략 가능', async () => {
    const res = await app.request(
      '/perspectives',
      jsonPost(tw.sessionId, { type: 'review', name: 'PM' }),
    );
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.perspective.description, null);
  });

  test('POST / — type 누락 시 400', async () => {
    const res = await app.request(
      '/perspectives',
      jsonPost(tw.sessionId, { name: 'PM' }),
    );
    assert.equal(res.status, 400);
  });

  test('POST / — name 누락 시 400', async () => {
    const res = await app.request(
      '/perspectives',
      jsonPost(tw.sessionId, { type: 'review' }),
    );
    assert.equal(res.status, 400);
  });

  // ─── PUT /:id ──────────────────────────────────────────────────

  test('PUT /:id — perspective 수정', async () => {
    const p = createPerspective(tw.db, { type: 'review', name: 'Old' });

    const res = await app.request(
      `/perspectives/${p.id}`,
      jsonPut(tw.sessionId, { name: 'New', description: '새 설명' }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.perspective.name, 'New');
    assert.equal(json.perspective.description, '새 설명');
  });

  test('PUT /:id — locked 상태에서는 수정 불가 (409)', async () => {
    const p = createPerspective(tw.db, { type: 'review', name: 'PM' });
    lockPerspective(tw.db, p.id);

    const res = await app.request(
      `/perspectives/${p.id}`,
      jsonPut(tw.sessionId, { name: 'New' }),
    );
    assert.equal(res.status, 409);
  });

  test('PUT /:id — 존재하지 않는 ID는 404', async () => {
    const res = await app.request(
      '/perspectives/999',
      jsonPut(tw.sessionId, { name: 'New' }),
    );
    assert.equal(res.status, 404);
  });

  // ─── DELETE /:id ───────────────────────────────────────────────

  test('DELETE /:id — perspective 삭제', async () => {
    const p = createPerspective(tw.db, { type: 'review', name: 'PM' });

    const res = await app.request(`/perspectives/${p.id}`, {
      ...withSession(tw.sessionId),
      method: 'DELETE',
    });
    assert.equal(res.status, 204);

    // DB에서 삭제 확인
    assert.equal(getPerspective(tw.db, p.id), null);
  });

  test('DELETE /:id — locked 상태에서는 삭제 불가 (409)', async () => {
    const p = createPerspective(tw.db, { type: 'review', name: 'PM' });
    lockPerspective(tw.db, p.id);

    const res = await app.request(`/perspectives/${p.id}`, {
      ...withSession(tw.sessionId),
      method: 'DELETE',
    });
    assert.equal(res.status, 409);
  });

  test('DELETE /:id — 존재하지 않는 ID는 404', async () => {
    const res = await app.request(`/perspectives/999`, {
      ...withSession(tw.sessionId),
      method: 'DELETE',
    });
    assert.equal(res.status, 404);
  });

  // ─── POST /:id/lock ────────────────────────────────────────────

  test('POST /:id/lock — perspective lock', async () => {
    const p = createPerspective(tw.db, { type: 'review', name: 'PM' });

    const res = await app.request(`/perspectives/${p.id}/lock`, jsonPost(tw.sessionId, {}));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.perspective.is_locked, 1);

    // 수정 불가 확인
    const updateRes = await app.request(
      `/perspectives/${p.id}`,
      jsonPut(tw.sessionId, { name: 'New' }),
    );
    assert.equal(updateRes.status, 409);
  });

  test('POST /:id/lock — 존재하지 않는 ID는 404', async () => {
    const res = await app.request('/perspectives/999/lock', jsonPost(tw.sessionId, {}));
    assert.equal(res.status, 404);
  });

  // ─── POST /:id/unlock ──────────────────────────────────────────

  test('POST /:id/unlock — perspective unlock', async () => {
    const p = createPerspective(tw.db, { type: 'review', name: 'PM' });
    lockPerspective(tw.db, p.id);

    const res = await app.request(`/perspectives/${p.id}/unlock`, jsonPost(tw.sessionId, {}));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.perspective.is_locked, 0);

    // 수정 가능 확인
    const updateRes = await app.request(
      `/perspectives/${p.id}`,
      jsonPut(tw.sessionId, { name: 'New' }),
    );
    assert.equal(updateRes.status, 200);
  });

  test('POST /:id/unlock — 존재하지 않는 ID는 404', async () => {
    const res = await app.request('/perspectives/999/unlock', jsonPost(tw.sessionId, {}));
    assert.equal(res.status, 404);
  });

  // ─── GET /export/json ──────────────────────────────────────────

  test('GET /export/json — 모든 perspectives를 JSON으로 내보내기', async () => {
    createPerspective(tw.db, { type: 'review', name: 'PM', description: '제품' });
    createPerspective(tw.db, { type: 'review', name: 'Ops', description: '운영' });
    lockPerspective(tw.db, getPerspectives(tw.db)[0].id);

    const res = await app.request('/perspectives/export/json', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json');
    const json = await res.json();
    assert.ok(Array.isArray(json));
    assert.equal(json.length, 2);
    assert.ok(json[0].id);
    assert.ok(json[0].created_at);
    assert.ok(json[0].updated_at);
  });

  test('GET /export/json — type으로 필터링', async () => {
    createPerspective(tw.db, { type: 'review', name: 'PM' });
    createPerspective(tw.db, { type: 'features', name: 'Marketing' });

    const res = await app.request('/perspectives/export/json?type=review', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.length, 1);
    assert.equal(json[0].type, 'review');
  });

  test('GET /export/json — 빈 배열 (perspectives 없음)', async () => {
    const res = await app.request('/perspectives/export/json', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(Array.isArray(json));
    assert.equal(json.length, 0);
  });
});
