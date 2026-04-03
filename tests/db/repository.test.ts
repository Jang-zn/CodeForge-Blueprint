import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import { SCHEMA_SQL, MIGRATION_V2_SQL } from '../../src/db/schema.js';
import {
  getProviderModel,
  setProviderModel,
  upsertWorkspaceMeta,
} from '../../src/db/repository.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BetterSqlite3 = require('better-sqlite3') as any;

function createTestDb() {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  try { db.exec(MIGRATION_V2_SQL); } catch { /* ignore */ }
  return db;
}

describe('getProviderModel', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  test('workspace가 없으면 기본값(claude:claude-sonnet-4-6) 반환', () => {
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-sonnet-4-6' });
  });

  test('workspace 생성 후 기본값 반환', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-sonnet-4-6' });
  });

  test('setProviderModel 후 저장된 값 반환', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    setProviderModel(db, 'codex', 'o4-mini');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'codex', model: 'o4-mini' });
  });

  test('claude provider 저장/읽기', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    setProviderModel(db, 'claude', 'claude-opus-4-6');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-opus-4-6' });
  });

  test('모델명에 콜론이 포함되어도 올바르게 파싱', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    setProviderModel(db, 'claude', 'claude-haiku-4-5-20251001');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-haiku-4-5-20251001' });
  });

  test('setProviderModel 연속 호출 시 마지막 값 유지', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    setProviderModel(db, 'claude', 'claude-sonnet-4-6');
    setProviderModel(db, 'codex', 'o3');
    setProviderModel(db, 'codex', 'gpt-4.1');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'codex', model: 'gpt-4.1' });
  });

  test('손상된 provider_model은 기본값으로 fallback', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    // 직접 잘못된 값 삽입
    db.prepare("UPDATE workspace SET provider_model = 'invalid-no-colon' WHERE id = 1").run();
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-sonnet-4-6' });
  });

  test('알 수 없는 provider는 기본값으로 fallback', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    db.prepare("UPDATE workspace SET provider_model = 'unknown:some-model' WHERE id = 1").run();
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-sonnet-4-6' });
  });
});
