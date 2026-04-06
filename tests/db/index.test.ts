import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openDb, getDb, resetDb, closeAllDbs } from '../../src/db/index.js';

function makeTempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-db-test-'));
  return path.join(dir, 'test.db');
}

function cleanDb(dbPath: string) {
  try { fs.rmSync(path.dirname(dbPath), { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('openDb / getDb / resetDb', () => {
  let dbPath: string;

  afterEach(() => {
    closeAllDbs();
    cleanDb(dbPath);
  });

  test('openDb — DB 파일 생성 및 객체 반환', () => {
    dbPath = makeTempDb();
    const db = openDb(dbPath);
    assert.ok(db, 'DB 객체 반환');
    assert.ok(fs.existsSync(dbPath), 'DB 파일 생성');
  });

  test('openDb 두 번 호출해도 동일 인스턴스 반환 (싱글톤)', () => {
    dbPath = makeTempDb();
    const db1 = openDb(dbPath);
    const db2 = openDb(dbPath);
    assert.equal(db1, db2);
  });

  test('getDb — openDb 후 같은 인스턴스 반환', () => {
    dbPath = makeTempDb();
    const opened = openDb(dbPath);
    const fetched = getDb();
    assert.equal(opened, fetched);
  });

  test('getDb — DB 열기 전 호출 시 에러 throw', () => {
    dbPath = makeTempDb(); // afterEach용 더미 경로
    assert.throws(() => getDb(), /Database not opened/);
  });

  test('resetDb — active DB를 해제한다', () => {
    dbPath = makeTempDb();
    openDb(dbPath);
    resetDb();
    assert.throws(() => getDb(), /Database not opened/);
  });

  test('resetDb — DB 없는 상태에서 호출해도 에러 없음', () => {
    dbPath = makeTempDb();
    assert.doesNotThrow(() => resetDb());
  });

  test('resetDb 후 재오픈 가능', () => {
    dbPath = makeTempDb();
    openDb(dbPath);
    resetDb();
    const db = openDb(dbPath);
    assert.ok(db, '재오픈 성공');
  });

  test('다른 DB를 열어도 기존 핸들은 유지된다', () => {
    dbPath = makeTempDb();
    const otherDbPath = makeTempDb();

    const db1 = openDb(dbPath);
    db1.prepare('CREATE TABLE IF NOT EXISTS keepalive (id INTEGER)').run();

    const db2 = openDb(otherDbPath);
    assert.notEqual(db1, db2);

    assert.doesNotThrow(() => {
      db1.prepare('INSERT INTO keepalive (id) VALUES (1)').run();
    });

    cleanDb(otherDbPath);
  });
});
