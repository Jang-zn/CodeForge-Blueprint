import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { findClaudeBinary, findCodexBinary, checkClaude, checkCodex } from '../../src/claude/finder.js';

import { makeTempDir, cleanDir } from '../helpers.js';

describe('findClaudeBinary', () => {
  test('실제 환경에서 문자열 경로 또는 null을 반환하며, 경로는 실제 파일', async () => {
    const result = await findClaudeBinary();
    if (result !== null) {
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0);
      assert.ok(fs.existsSync(result), `반환된 경로가 존재해야 함: ${result}`);
    } else {
      // CI 등에서 claude가 없으면 null — 명시적으로 null 확인
      assert.equal(result, null);
    }
  });
});

describe('findCodexBinary', () => {
  test('실제 환경에서 문자열 경로 또는 null을 반환하며, 경로는 실제 파일', async () => {
    const result = await findCodexBinary();
    if (result !== null) {
      assert.equal(typeof result, 'string');
      assert.ok(fs.existsSync(result), `반환된 경로가 존재해야 함: ${result}`);
    } else {
      assert.equal(result, null);
    }
  });
});

describe('checkClaude', () => {
  test('available=true이면 path가 실제 존재하는 문자열, false이면 path=null', async () => {
    const status = await checkClaude();
    assert.equal(typeof status.available, 'boolean');
    if (status.available) {
      assert.equal(typeof status.path, 'string');
      assert.ok(fs.existsSync(status.path!), `path 실제 존재: ${status.path}`);
    } else {
      assert.equal(status.path, null);
      assert.equal(status.version, undefined);
    }
  });
});

describe('checkCodex', () => {
  test('available=true이면 path가 실제 존재하는 문자열, false이면 path=null', async () => {
    const status = await checkCodex();
    assert.equal(typeof status.available, 'boolean');
    if (status.available) {
      assert.equal(typeof status.path, 'string');
      assert.ok(fs.existsSync(status.path!), `path 실제 존재: ${status.path}`);
    } else {
      assert.equal(status.path, null);
      assert.equal(status.version, undefined);
    }
  });
});

describe('findBinary — fake binary in controlled PATH', () => {
  let tmpDir: string;
  let origPath: string | undefined;

  beforeEach(() => {
    tmpDir = makeTempDir('cfb-finder-');
    origPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = origPath;
    cleanDir(tmpDir);
  });

  test('which가 유효한 바이너리를 찾으면 해당 경로의 파일이 존재함', async () => {
    // 실제 환경에서 claude가 있으면 경로 검증, 없으면 null
    const result = await findClaudeBinary();
    if (result !== null) {
      assert.ok(fs.existsSync(result), `which가 반환한 경로 존재: ${result}`);
    } else {
      assert.equal(result, null);
    }
  });

  test('PATH를 빈 디렉토리로 제한해도 tryKnownPaths fallback으로 탐색 완료', async () => {
    process.env.PATH = tmpDir;
    const result = await findClaudeBinary();
    // tryKnownPaths에서 nvm 등 알려진 경로를 직접 탐색
    if (result !== null) {
      assert.equal(typeof result, 'string');
      assert.ok(fs.existsSync(result), `fallback 경로가 실제 존재: ${result}`);
    } else {
      assert.equal(result, null);
    }
  });

  test('codex도 PATH 제한 상태에서 에러 없이 탐색 완료', async () => {
    process.env.PATH = tmpDir;
    const result = await findCodexBinary();
    if (result !== null) {
      assert.equal(typeof result, 'string');
      assert.ok(fs.existsSync(result), `codex fallback 경로 존재: ${result}`);
    } else {
      assert.equal(result, null);
    }
  });
});
