import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import glossaryRoute from '../../src/server/routes/glossary.js';

import { setupTestWorkspace, jsonPost, jsonPut, withSession, type TestWorkspace } from '../helpers.js';

describe('glossaryRoute', () => {
  let tw: TestWorkspace;
  let app: Hono;

  beforeEach(() => {
    tw = setupTestWorkspace();
    app = new Hono();
    app.route('/glossary', glossaryRoute);
  });

  afterEach(() => tw.cleanup());

  test('GET / — 빈 목록 반환', async () => {
    const res = await app.request('/glossary', withSession(tw.sessionId));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json));
    assert.equal(json.length, 0);
  });

  test('POST / — 용어 생성', async () => {
    const res = await app.request(
      '/glossary',
      jsonPost(tw.sessionId, { term: 'API', definition: 'Application Programming Interface' }),
    );
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.term, 'API');
    assert.equal(json.definition, 'Application Programming Interface');
    assert.ok(json.id);
  });

  test('POST / — term 누락 시 400', async () => {
    const res = await app.request(
      '/glossary',
      jsonPost(tw.sessionId, { definition: 'def' }),
    );
    assert.equal(res.status, 400);
  });

  test('POST / — definition 누락 시 400', async () => {
    const res = await app.request(
      '/glossary',
      jsonPost(tw.sessionId, { term: 'test' }),
    );
    assert.equal(res.status, 400);
  });

  test('GET / — 생성한 용어가 목록에 포함', async () => {
    await app.request('/glossary', jsonPost(tw.sessionId, { term: 'REST', definition: 'Representational State Transfer', category: 'web' }));

    const res = await app.request('/glossary', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.length, 1);
    assert.equal(json[0].term, 'REST');
  });

  test('GET / — category 필터링', async () => {
    await app.request('/glossary', jsonPost(tw.sessionId, { term: 'REST', definition: 'def', category: 'web' }));
    await app.request('/glossary', jsonPost(tw.sessionId, { term: 'ORM', definition: 'def', category: 'db' }));

    const res = await app.request('/glossary?category=db', withSession(tw.sessionId));
    const json = await res.json();
    assert.equal(json.length, 1);
    assert.equal(json[0].term, 'ORM');
  });

  test('PUT /:id — 용어 수정', async () => {
    const createRes = await app.request('/glossary', jsonPost(tw.sessionId, { term: 'API', definition: 'old' }));
    const { id } = await createRes.json();

    const res = await app.request(
      `/glossary/${id}`,
      jsonPut(tw.sessionId, { term: 'API', definition: 'updated definition' }),
    );
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.definition, 'updated definition');
  });

  test('PUT /:id — term/definition 누락 시 400', async () => {
    const createRes = await app.request('/glossary', jsonPost(tw.sessionId, { term: 'API', definition: 'old' }));
    const { id } = await createRes.json();

    const res = await app.request(`/glossary/${id}`, jsonPut(tw.sessionId, { term: '' }));
    assert.equal(res.status, 400);
  });

  test('DELETE /:id — 용어 삭제', async () => {
    const createRes = await app.request('/glossary', jsonPost(tw.sessionId, { term: 'API', definition: 'def' }));
    const { id } = await createRes.json();

    const delRes = await app.request(`/glossary/${id}`, {
      method: 'DELETE',
      ...withSession(tw.sessionId),
    });
    assert.equal(delRes.status, 200);

    const listRes = await app.request('/glossary', withSession(tw.sessionId));
    const json = await listRes.json();
    assert.equal(json.length, 0);
  });
});
