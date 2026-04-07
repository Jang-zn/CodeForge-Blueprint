import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import documentsRoute from '../../src/server/routes/documents.js';

import { setupTestWorkspace, jsonPost, jsonPut, withSession, type TestWorkspace } from '../helpers.js';

describe('documentsRoute', () => {
  let tw: TestWorkspace;
  let app: Hono;

  beforeEach(() => {
    tw = setupTestWorkspace();
    app = new Hono();
    app.route('/documents', documentsRoute);
    // docs 디렉토리 생성
    fs.mkdirSync(path.join(tw.tmpDir, 'docs'), { recursive: true });
  });

  afterEach(() => tw.cleanup());

  // ─── GET /types ────────────────────────────────────────────────

  test('GET /types — 문서 타입 목록 반환', async () => {
    const res = await app.request('/documents/types', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json));
    assert.ok(json.length > 0);
    assert.ok(json[0].slug);
    assert.ok(json[0].label);
  });

  // ─── GET / ─────────────────────────────────────────────────────

  test('GET / — 빈 문서 목록 반환', async () => {
    const res = await app.request('/documents', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json));
    assert.equal(json.length, 0);
  });

  // ─── POST / ────────────────────────────────────────────────────

  test('POST / — 문서 생성', async () => {
    // 먼저 사용 가능한 타입을 확인
    const typesRes = await app.request('/documents/types', withSession(tw.sessionId));
    const types = await typesRes.json();
    const docType = types[0].slug;

    const res = await app.request(
      '/documents',
      jsonPost(tw.sessionId, { doc_type: docType }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.id);
    assert.equal(json.created, true);
  });

  test('POST / — 같은 타입 재생성 시 created: false (싱글톤)', async () => {
    const typesRes = await app.request('/documents/types', withSession(tw.sessionId));
    const types = await typesRes.json();
    const docType = types[0].slug;

    await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const res = await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const json = await res.json();
    assert.equal(json.created, false);
  });

  test('POST / — doc_type 누락 시 400', async () => {
    const res = await app.request('/documents', jsonPost(tw.sessionId, {}));
    assert.equal(res.status, 400);
  });

  test('POST / — 알 수 없는 doc_type 시 400', async () => {
    const res = await app.request(
      '/documents',
      jsonPost(tw.sessionId, { doc_type: 'nonexistent-type-xyz' }),
    );
    assert.equal(res.status, 400);
  });

  // ─── GET /:id ──────────────────────────────────────────────────

  test('GET /:id — 생성한 문서 조회', async () => {
    const typesRes = await app.request('/documents/types', withSession(tw.sessionId));
    const types = await typesRes.json();
    const docType = types[0].slug;

    const createRes = await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const { id } = await createRes.json();

    const res = await app.request(`/documents/${id}`, withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.id, id);
    assert.ok('sections' in json);
  });

  test('GET /:id — 존재하지 않는 ID는 404', async () => {
    const res = await app.request('/documents/99999', withSession(tw.sessionId));
    assert.equal(res.status, 404);
  });

  // ─── GET /by-type/:type ────────────────────────────────────────

  test('GET /by-type/:type — 타입으로 문서 조회', async () => {
    const typesRes = await app.request('/documents/types', withSession(tw.sessionId));
    const types = await typesRes.json();
    const docType = types[0].slug;

    await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));

    const res = await app.request(`/documents/by-type/${docType}`, withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.id);
  });

  test('GET /by-type/:type — 없는 타입은 404', async () => {
    const res = await app.request('/documents/by-type/nonexistent', withSession(tw.sessionId));
    assert.equal(res.status, 404);
  });

  // ─── PUT /:id/sections/:key ────────────────────────────────────

  test('PUT /:id/sections/:key — 섹션 내용 수정', async () => {
    const typesRes = await app.request('/documents/types', withSession(tw.sessionId));
    const types = await typesRes.json();
    const docType = types[0].slug;
    const sectionKey = types[0].sections?.[0]?.key;

    if (!sectionKey) return; // 섹션 없는 타입이면 스킵

    const createRes = await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const { id } = await createRes.json();

    const res = await app.request(
      `/documents/${id}/sections/${sectionKey}`,
      jsonPut(tw.sessionId, { content: '# Updated Section' }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
  });

  test('PUT /:id/sections/:key — content 누락 시 400', async () => {
    const typesRes = await app.request('/documents/types', withSession(tw.sessionId));
    const types = await typesRes.json();
    const docType = types[0].slug;
    const sectionKey = types[0].sections?.[0]?.key;

    if (!sectionKey) return;

    const createRes = await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const { id } = await createRes.json();

    const res = await app.request(
      `/documents/${id}/sections/${sectionKey}`,
      jsonPut(tw.sessionId, {}),
    );
    assert.equal(res.status, 400);
  });

  // ─── PUT /:id/summary ──────────────────────────────────────────

  test('PUT /:id/summary — 요약 수정', async () => {
    const typesRes = await app.request('/documents/types', withSession(tw.sessionId));
    const types = await typesRes.json();
    const docType = types[0].slug;

    const createRes = await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const { id } = await createRes.json();

    const res = await app.request(
      `/documents/${id}/summary`,
      jsonPut(tw.sessionId, { summary: '프로젝트 요약입니다.' }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
  });

  test('PUT /:id/summary — summary 누락 시 400', async () => {
    const typesRes = await app.request('/documents/types', withSession(tw.sessionId));
    const types = await typesRes.json();
    const docType = types[0].slug;

    const createRes = await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const { id } = await createRes.json();

    const res = await app.request(
      `/documents/${id}/summary`,
      jsonPut(tw.sessionId, {}),
    );
    assert.equal(res.status, 400);
  });

  // ─── GET /context-package ──────────────────────────────────────

  test('GET /context-package — 기본 프로필로 컨텍스트 패키지 반환', async () => {
    const res = await app.request('/documents/context-package', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(typeof json === 'object');
  });
});
