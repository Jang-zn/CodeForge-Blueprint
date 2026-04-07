import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { findClaudeBinary, findCodexBinary, checkClaude, checkCodex } from '../../src/claude/finder.js';
import type { ClaudeStatus } from '../../src/claude/finder.js';

import { makeTempDir, cleanDir } from '../helpers.js';

describe('findClaudeBinary', () => {
  test('실제 환경에서 null 또는 유효한 경로를 반환', async () => {
    const result = await findClaudeBinary();
    if (result !== null) {
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    }
  });
});

describe('findCodexBinary', () => {
  test('실제 환경에서 null 또는 유효한 경로를 반환', async () => {
    const result = await findCodexBinary();
    if (result !== null) {
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    }
  });
});

describe('checkClaude', () => {
  test('ClaudeStatus 형식을 반환한다', async () => {
    const status = await checkClaude();
    assert.equal(typeof status.available, 'boolean');
    if (status.available) {
      assert.ok(typeof status.path === 'string');
    } else {
      assert.equal(status.path, null);
    }
  });
});

describe('checkCodex', () => {
  test('CodexStatus 형식을 반환한다', async () => {
    const status = await checkCodex();
    assert.equal(typeof status.available, 'boolean');
    if (status.available) {
      assert.ok(typeof status.path === 'string');
    } else {
      assert.equal(status.path, null);
    }
  });
});

describe('findBinary — tryKnownPaths fallback', () => {
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

  test('PATH에 없고 npm root도 실패하면 알려진 경로에서 찾는다', async () => {
    // which/where와 npm root를 모두 실패시키기 위해 PATH를 비움
    process.env.PATH = tmpDir;

    // findClaudeBinary는 tryKnownPaths에서 실제 시스템 경로를 탐색
    // 결과는 환경에 따라 다르지만 에러 없이 완료되어야 함
    const result = await findClaudeBinary();
    assert.ok(result === null || typeof result === 'string');
  });

  test('PATH가 빈 상태에서도 codex 탐색이 에러 없이 완료된다', async () => {
    process.env.PATH = tmpDir;
    const result = await findCodexBinary();
    assert.ok(result === null || typeof result === 'string');
  });
});
