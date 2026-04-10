import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import {
  listPerspectives,
  getPerspective,
  addCustomPerspective,
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

  test('GET / — 시드 관점 전체 반환', async () => {
    const res = await app.request('/perspectives', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.perspectives));
    assert.ok(json.perspectives.length >= 20);
  });

  test('GET /?tab=review — review 탭 관점만 반환', async () => {
    const res = await app.request('/perspectives?tab=review', withSession(tw.sessionId));
    const json = await res.json();
    assert.ok(json.perspectives.every((p: any) => p.tab === 'review'));
    assert.ok(json.perspectives.length >= 6);
  });

  // ─── GET /active ───────────────────────────────────────────────

  test('GET /active?tab=review — 활성 관점만 반환', async () => {
    const res = await app.request('/perspectives/active?tab=review', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.perspectives));
    assert.equal(json.perspectives.length, 6); // 기본 6개 locked
  });

  test('GET /active — tab 누락 시 400', async () => {
    const res = await app.request('/perspectives/active', withSession(tw.sessionId));
    assert.equal(res.status, 400);
  });

  // ─── GET /:id ──────────────────────────────────────────────────

  test('GET /:id — 특정 perspective 반환', async () => {
    const res = await app.request('/perspectives/review-planning-consistency', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.perspective.id, 'review-planning-consistency');
    assert.equal(json.perspective.tab, 'review');
  });

  test('GET /:id — 존재하지 않는 ID는 404', async () => {
    const res = await app.request('/perspectives/nonexistent-id', withSession(tw.sessionId));
    assert.equal(res.status, 404);
  });

  // ─── POST / ────────────────────────────────────────────────────

  test('POST / — 커스텀 관점 생성', async () => {
    const res = await app.request(
      '/perspectives',
      jsonPost(tw.sessionId, { tab: 'review', name: '테스트 관점', description: '설명', prompt_instruction: '지시문', id_prefix: 'test' }),
    );
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.ok(json.perspective.id.startsWith('custom-review-'));
    assert.equal(json.perspective.tab, 'review');
    assert.equal(json.perspective.category, 'custom');
    assert.equal(json.perspective.is_locked, 0);
  });

  test('POST / — 필수 필드 누락 시 400', async () => {
    const res = await app.request(
      '/perspectives',
      jsonPost(tw.sessionId, { tab: 'review', name: '불완전' }),
    );
    assert.equal(res.status, 400);
  });

  // ─── PUT /:id ──────────────────────────────────────────────────

  test('PUT /:id — 커스텀 관점 수정', async () => {
    const p = addCustomPerspective(tw.db, { tab: 'review', name: '구버전', description: '설명', prompt_instruction: '지시문', id_prefix: 'old' });

    const res = await app.request(
      `/perspectives/${p.id}`,
      jsonPut(tw.sessionId, { name: '신버전', description: '새 설명' }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.perspective.name, '신버전');
  });

  test('PUT /:id — locked 관점 수정 불가 (409)', async () => {
    const locked = listPerspectives(tw.db, 'review').find(p => p.is_locked === 1)!;

    const res = await app.request(
      `/perspectives/${locked.id}`,
      jsonPut(tw.sessionId, { name: 'New' }),
    );
    assert.equal(res.status, 409);
  });

  test('PUT /:id — 존재하지 않는 ID는 404', async () => {
    const res = await app.request(
      '/perspectives/nonexistent',
      jsonPut(tw.sessionId, { name: 'New' }),
    );
    assert.equal(res.status, 404);
  });

  // ─── DELETE /:id ───────────────────────────────────────────────

  test('DELETE /:id — 커스텀 관점 삭제', async () => {
    const p = addCustomPerspective(tw.db, { tab: 'backend', name: '삭제대상', description: '설명', prompt_instruction: '지시문', id_prefix: 'del' });

    const res = await app.request(`/perspectives/${p.id}`, {
      ...withSession(tw.sessionId),
      method: 'DELETE',
    });
    assert.equal(res.status, 204);
    assert.equal(getPerspective(tw.db, p.id), null);
  });

  test('DELETE /:id — locked 관점 삭제 불가 (409)', async () => {
    const locked = listPerspectives(tw.db, 'review').find(p => p.is_locked === 1)!;

    const res = await app.request(`/perspectives/${locked.id}`, {
      ...withSession(tw.sessionId),
      method: 'DELETE',
    });
    assert.equal(res.status, 409);
  });

  test('DELETE /:id — 존재하지 않는 ID는 404', async () => {
    const res = await app.request('/perspectives/nonexistent', {
      ...withSession(tw.sessionId),
      method: 'DELETE',
    });
    assert.equal(res.status, 404);
  });

  // ─── PUT /:id/toggle ───────────────────────────────────────────

  test('PUT /:id/toggle — optional 관점 활성화', async () => {
    const optional = listPerspectives(tw.db, 'review').find(p => p.category === 'optional')!;

    const res = await app.request(
      `/perspectives/${optional.id}/toggle`,
      jsonPut(tw.sessionId, { active: true }),
    );
    assert.equal(res.status, 200);
  });

  test('PUT /:id/toggle — locked 관점 비활성화 시 409', async () => {
    const locked = listPerspectives(tw.db, 'review').find(p => p.is_locked === 1)!;

    const res = await app.request(
      `/perspectives/${locked.id}/toggle`,
      jsonPut(tw.sessionId, { active: false }),
    );
    assert.equal(res.status, 409);
  });

  test('PUT /:id/toggle — active 필드 누락 시 400', async () => {
    const res = await app.request(
      '/perspectives/review-planning-consistency/toggle',
      jsonPut(tw.sessionId, {}),
    );
    assert.equal(res.status, 400);
  });
});
