import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import documentsRoute from '../../src/server/routes/documents.js';

import { setupTestWorkspace, jsonPost, jsonPut, withSession, type TestWorkspace } from '../helpers.js';

/** 첫 번째 문서 타입의 slug와 첫 번째 섹션 key를 가져오는 헬퍼 */
async function getFirstDocType(app: Hono, sessionId: string) {
  const res = await app.request('/documents/types', withSession(sessionId));
  const types = await res.json();
  assert.ok(types.length > 0, '문서 타입이 1개 이상 존재해야 함');
  const docType = types[0].slug;
  const sectionKey = types[0].sections?.[0]?.key ?? null;
  return { docType, sectionKey, types };
}

/** 문서를 생성하고 ID를 반환하는 헬퍼 */
async function createDoc(app: Hono, sessionId: string, docType: string) {
  const res = await app.request('/documents', jsonPost(sessionId, { doc_type: docType }));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(typeof json.id, 'number');
  return json.id as number;
}

describe('documentsRoute', () => {
  let tw: TestWorkspace;
  let app: Hono;

  beforeEach(() => {
    tw = setupTestWorkspace();
    app = new Hono();
    app.route('/documents', documentsRoute);
    fs.mkdirSync(path.join(tw.tmpDir, 'docs'), { recursive: true });
  });

  afterEach(() => tw.cleanup());

  // ─── GET /types ────────────────────────────────────────────────

  test('GET /types — 문서 타입 목록: slug/label 문자열 검증', async () => {
    const res = await app.request('/documents/types', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json));
    assert.ok(json.length > 0);
    assert.equal(typeof json[0].slug, 'string');
    assert.equal(typeof json[0].label, 'string');
    assert.ok(json[0].slug.length > 0);
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

  test('POST / — 문서 생성 후 GET으로 확인', async () => {
    const { docType } = await getFirstDocType(app, tw.sessionId);
    const id = await createDoc(app, tw.sessionId, docType);

    // GET으로 생성된 문서 확인
    const getRes = await app.request(`/documents/${id}`, withSession(tw.sessionId));
    assert.equal(getRes.status, 200);
    const doc = await getRes.json();
    assert.equal(doc.id, id);
    assert.equal(doc.doc_type, docType);
  });

  test('POST / — 같은 타입 재생성 시 created: false (싱글톤)', async () => {
    const { docType } = await getFirstDocType(app, tw.sessionId);

    const res1 = await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const json1 = await res1.json();
    assert.equal(json1.created, true);

    const res2 = await app.request('/documents', jsonPost(tw.sessionId, { doc_type: docType }));
    const json2 = await res2.json();
    assert.equal(json2.created, false);
    assert.equal(json2.id, json1.id, '싱글톤: 같은 ID 반환');
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

  test('GET /:id — 생성한 문서의 sections 포함 확인', async () => {
    const { docType } = await getFirstDocType(app, tw.sessionId);
    const id = await createDoc(app, tw.sessionId, docType);

    const res = await app.request(`/documents/${id}`, withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.id, id);
    assert.ok(Array.isArray(json.sections));
  });

  test('GET /:id — 존재하지 않는 ID는 404', async () => {
    const res = await app.request('/documents/99999', withSession(tw.sessionId));
    assert.equal(res.status, 404);
  });

  // ─── GET /by-type/:type ────────────────────────────────────────

  test('GET /by-type/:type — 타입으로 문서 조회', async () => {
    const { docType } = await getFirstDocType(app, tw.sessionId);
    const id = await createDoc(app, tw.sessionId, docType);

    const res = await app.request(`/documents/by-type/${docType}`, withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.id, id);
  });

  test('GET /by-type/:type — 없는 타입은 404', async () => {
    const res = await app.request('/documents/by-type/nonexistent', withSession(tw.sessionId));
    assert.equal(res.status, 404);
  });

  // ─── PUT /:id/sections/:key ────────────────────────────────────

  test('PUT /:id/sections/:key — 섹션 수정 후 GET으로 반영 확인', async () => {
    const { docType, sectionKey } = await getFirstDocType(app, tw.sessionId);
    assert.ok(sectionKey, '첫 번째 문서 타입에 섹션이 존재해야 함');

    const id = await createDoc(app, tw.sessionId, docType);

    const res = await app.request(
      `/documents/${id}/sections/${sectionKey}`,
      jsonPut(tw.sessionId, { content: '# Updated Section Content' }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);

    // GET으로 수정된 내용 확인
    const getRes = await app.request(`/documents/${id}`, withSession(tw.sessionId));
    const doc = await getRes.json();
    const section = doc.sections.find((s: any) => s.section_key === sectionKey);
    assert.ok(section, `섹션 ${sectionKey}가 응답에 포함되어야 함`);
    assert.equal(section.content, '# Updated Section Content');
  });

  test('PUT /:id/sections/:key — content 누락 시 400', async () => {
    const { docType, sectionKey } = await getFirstDocType(app, tw.sessionId);
    assert.ok(sectionKey);

    const id = await createDoc(app, tw.sessionId, docType);

    const res = await app.request(
      `/documents/${id}/sections/${sectionKey}`,
      jsonPut(tw.sessionId, {}),
    );
    assert.equal(res.status, 400);
  });

  // ─── PUT /:id/summary ──────────────────────────────────────────

  test('PUT /:id/summary — 요약 수정 후 GET으로 반영 확인', async () => {
    const { docType } = await getFirstDocType(app, tw.sessionId);
    const id = await createDoc(app, tw.sessionId, docType);

    const res = await app.request(
      `/documents/${id}/summary`,
      jsonPut(tw.sessionId, { summary: '프로젝트 요약입니다.' }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);

    // GET으로 반영 확인
    const getRes = await app.request(`/documents/${id}`, withSession(tw.sessionId));
    const doc = await getRes.json();
    assert.equal(doc.summary, '프로젝트 요약입니다.');
  });

  test('PUT /:id/summary — summary 누락 시 400', async () => {
    const { docType } = await getFirstDocType(app, tw.sessionId);
    const id = await createDoc(app, tw.sessionId, docType);

    const res = await app.request(
      `/documents/${id}/summary`,
      jsonPut(tw.sessionId, {}),
    );
    assert.equal(res.status, 400);
  });

  // ─── GET /context-package ──────────────────────────────────────

  test('GET /context-package — 객체 반환 (null 아님)', async () => {
    const res = await app.request('/documents/context-package', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json !== null && typeof json === 'object');
  });
});
