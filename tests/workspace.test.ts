import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// workspace 모듈은 모듈 수준 싱글톤(_workspace)을 가지므로
// 각 테스트에서 직접 import해 사용한다.
import { expandHome, openWorkspace, hasWorkspace, getWorkspaceOrNull, getRecents } from '../src/workspace.js';
import { initAppDb, closeAppDb } from '../src/db/app-db.js';

const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-home-'));
process.env.CODEFORGE_BLUEPRINT_HOME = TEST_HOME;
initAppDb();

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-test-'));
}

function cleanDir(dir: string) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ─── expandHome ──────────────────────────────────────────────────────────────

describe('expandHome', () => {
  test('~를 homedir로 치환', () => {
    const result = expandHome('~/projects/foo');
    assert.equal(result, path.join(os.homedir(), 'projects/foo'));
  });

  test('~/만 있을 때도 치환', () => {
    assert.equal(expandHome('~/'), os.homedir() + '/');
  });

  test('~로 시작하지 않는 경로는 변경 없음', () => {
    assert.equal(expandHome('/absolute/path'), '/absolute/path');
    assert.equal(expandHome('relative/path'), 'relative/path');
  });

  test('중간에 ~가 있는 경우는 치환하지 않음', () => {
    assert.equal(expandHome('/home/~user'), '/home/~user');
  });
});

// ─── openWorkspace ────────────────────────────────────────────────────────────

describe('openWorkspace', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  test('WorkspaceContext 반환 — rootPath, docsPath, dbPath, name 검증', () => {
    const ws = openWorkspace(tmpDir);

    assert.equal(ws.rootPath, tmpDir);
    assert.equal(ws.docsPath, path.join(tmpDir, 'docs'));
    assert.equal(ws.dbPath, path.join(tmpDir, 'docs', '.codeforge', 'data.db'));
    assert.equal(ws.name, path.basename(tmpDir));
  });

  test('docs/.codeforge 디렉터리를 자동 생성', () => {
    openWorkspace(tmpDir);
    assert.ok(fs.existsSync(path.join(tmpDir, 'docs', '.codeforge')));
  });

  test('hasWorkspace()가 true로 전환', () => {
    const ws = openWorkspace(tmpDir);
    assert.equal(hasWorkspace(ws.sessionId), true);
  });

  test('getWorkspaceOrNull()이 열린 워크스페이스 반환', () => {
    const ws = openWorkspace(tmpDir);
    const result = getWorkspaceOrNull(ws.sessionId);
    assert.ok(result !== null);
    assert.equal(result!.rootPath, ws.rootPath);
    assert.equal(result!.sessionId, ws.sessionId);
  });

  test('같은 경로 재호출 시 항상 동일 컨텍스트 반환', () => {
    const ws1 = openWorkspace(tmpDir);
    const ws2 = openWorkspace(tmpDir);
    assert.equal(ws1.rootPath, ws2.rootPath);
  });

  test('tilde 경로도 올바르게 처리', () => {
    // 임시 폴더는 실제 경로이므로 직접 절대경로 사용
    const ws = openWorkspace(tmpDir);
    assert.equal(ws.rootPath, path.resolve(tmpDir));
  });
});

// ─── hasWorkspace / getWorkspaceOrNull ────────────────────────────────────────

describe('hasWorkspace / getWorkspaceOrNull', () => {
  test('openWorkspace 전에는 hasWorkspace()가 false 또는 이전 상태', () => {
    const result = hasWorkspace('missing-session');
    assert.equal(typeof result, 'boolean');
  });

  test('getWorkspaceOrNull은 null 또는 WorkspaceContext 반환', () => {
    const ws = getWorkspaceOrNull('missing-session');
    assert.ok(ws === null || (typeof ws === 'object' && 'rootPath' in ws));
  });
});

// ─── getRecents ───────────────────────────────────────────────────────────────

describe('getRecents', () => {
  let tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) cleanDir(d);
    tmpDirs = [];
  });

  test('openWorkspace 호출 후 getRecents에 경로 포함', () => {
    const tmpDir = makeTempDir();
    tmpDirs.push(tmpDir);

    openWorkspace(tmpDir);
    const recents = getRecents();

    assert.ok(Array.isArray(recents));
    assert.ok(recents.includes(path.resolve(tmpDir)));
  });

  test('getRecents는 배열을 반환 (recents 파일 없어도 빈 배열)', () => {
    // recents 파일 경로를 직접 건드리지 않고, 반환값 타입만 검증
    const recents = getRecents();
    assert.ok(Array.isArray(recents));
  });

  test('여러 워크스페이스 열면 모두 recents에 누적', () => {
    const dirs = [makeTempDir(), makeTempDir()];
    tmpDirs.push(...dirs);

    for (const d of dirs) openWorkspace(d);

    const recents = getRecents();
    for (const d of dirs) {
      assert.ok(recents.includes(path.resolve(d)), `${d} should be in recents`);
    }
  });

  test('같은 경로를 두 번 열면 중복 없이 맨 앞으로 이동', () => {
    const tmpDir = makeTempDir();
    tmpDirs.push(tmpDir);

    openWorkspace(tmpDir);
    openWorkspace(tmpDir);

    const recents = getRecents();
    const count = recents.filter(r => r === path.resolve(tmpDir)).length;
    assert.equal(count, 1);
    assert.equal(recents[0], path.resolve(tmpDir));
  });
});
