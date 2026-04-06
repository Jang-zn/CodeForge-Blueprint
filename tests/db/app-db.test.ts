import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initAppDb, closeAppDb, getAppDb, cleanupStaleData } from '../../src/db/app-db.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-appdb-test-'));
}

function cleanDir(dir: string) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('cleanupStaleData', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    process.env.CODEFORGE_BLUEPRINT_HOME = path.join(tmpDir, '.state');
    initAppDb();
  });

  afterEach(() => {
    closeAppDb();
    cleanDir(tmpDir);
  });

  test('8일 전 비활성 세션은 삭제됨', () => {
    const db = getAppDb();
    const wsDir = path.join(tmpDir, 'ws');
    fs.mkdirSync(wsDir, { recursive: true });

    db.prepare(`
      INSERT INTO sessions (id, workspace_root, workspace_name, docs_path, db_path, last_active_at)
      VALUES ('stale-1', ?, 'ws', '/docs', '/db', datetime('now', '-8 days'))
    `).run(wsDir);

    cleanupStaleData();

    const row = db.prepare('SELECT id FROM sessions WHERE id = ?').get('stale-1');
    assert.equal(row, undefined);
  });

  test('존재하지 않는 workspace_root를 가진 세션은 삭제됨', () => {
    const db = getAppDb();
    const nonExistentPath = path.join(tmpDir, 'no-such-dir');

    db.prepare(`
      INSERT INTO sessions (id, workspace_root, workspace_name, docs_path, db_path)
      VALUES ('stale-2', ?, 'ws', '/docs', '/db')
    `).run(nonExistentPath);

    cleanupStaleData();

    const row = db.prepare('SELECT id FROM sessions WHERE id = ?').get('stale-2');
    assert.equal(row, undefined);
  });

  test('존재하지 않는 경로를 가진 recents 항목은 삭제됨', () => {
    const db = getAppDb();
    const nonExistentPath = path.join(tmpDir, 'no-such-recent');

    db.prepare(`
      INSERT INTO recents (workspace_root) VALUES (?)
    `).run(nonExistentPath);

    cleanupStaleData();

    const row = db.prepare('SELECT workspace_root FROM recents WHERE workspace_root = ?').get(nonExistentPath);
    assert.equal(row, undefined);
  });

  test('유효한 세션과 recents는 삭제되지 않고 생존', () => {
    const db = getAppDb();
    const wsDir = path.join(tmpDir, 'valid-ws');
    fs.mkdirSync(wsDir, { recursive: true });

    db.prepare(`
      INSERT INTO sessions (id, workspace_root, workspace_name, docs_path, db_path)
      VALUES ('valid-1', ?, 'ws', '/docs', '/db')
    `).run(wsDir);

    db.prepare(`
      INSERT INTO recents (workspace_root) VALUES (?)
    `).run(wsDir);

    cleanupStaleData();

    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get('valid-1');
    assert.ok(session, '유효한 세션은 살아있어야 함');

    const recent = db.prepare('SELECT workspace_root FROM recents WHERE workspace_root = ?').get(wsDir);
    assert.ok(recent, '유효한 recents는 살아있어야 함');
  });
});
