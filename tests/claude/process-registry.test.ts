import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { ChildProcess } from 'child_process';
import {
  registerProcess,
  unregisterProcess,
  killProcess,
  killAllProcesses,
} from '../../src/claude/process-registry.js';

function mockChild(opts: { killThrows?: boolean } = {}): ChildProcess {
  const kills: string[] = [];
  return {
    kill(signal?: string) {
      if (opts.killThrows) throw new Error('Process already exited');
      kills.push(signal ?? 'default');
    },
    get _kills() { return kills; },
    pid: Math.floor(Math.random() * 100000),
  } as any;
}

describe('registerProcess / unregisterProcess', () => {
  afterEach(() => killAllProcesses());

  test('registerProcess 후 killProcess로 종료 가능', () => {
    const child = mockChild();
    registerProcess('job-1', child);
    assert.equal(killProcess('job-1'), true);
  });

  test('unregisterProcess 후 killProcess는 false 반환', () => {
    const child = mockChild();
    registerProcess('job-2', child);
    unregisterProcess('job-2');
    assert.equal(killProcess('job-2'), false);
  });

  test('같은 jobId로 여러 프로세스 등록 시 모두 kill됨', () => {
    const child1 = mockChild();
    const child2 = mockChild();
    registerProcess('job-3', child1);
    registerProcess('job-3', child2);
    killProcess('job-3');
    assert.equal((child1 as any)._kills.length, 1, 'child1도 kill되어야 함');
    assert.equal((child2 as any)._kills.length, 1, 'child2도 kill되어야 함');
  });
});

describe('killProcess', () => {
  afterEach(() => killAllProcesses());

  test('미등록 jobId에 대해 false 반환', () => {
    assert.equal(killProcess('unknown'), false);
  });

  test('SIGTERM을 전송하고 레지스트리에서 제거', () => {
    const child = mockChild();
    registerProcess('job-4', child);
    const result = killProcess('job-4');
    assert.equal(result, true);
    assert.equal((child as any)._kills[0], 'SIGTERM');
    assert.equal(killProcess('job-4'), false);
  });

  test('이미 종료된 프로세스에 kill해도 에러 없음', () => {
    const child = mockChild({ killThrows: true });
    registerProcess('job-5', child);
    assert.doesNotThrow(() => killProcess('job-5'));
  });
});

describe('killAllProcesses', () => {
  test('등록된 모든 프로세스에 SIGTERM 전송', () => {
    const child1 = mockChild();
    const child2 = mockChild();
    registerProcess('all-1', child1);
    registerProcess('all-2', child2);
    killAllProcesses();
    assert.equal((child1 as any)._kills.length, 1);
    assert.equal((child2 as any)._kills.length, 1);
    assert.equal(killProcess('all-1'), false);
    assert.equal(killProcess('all-2'), false);
  });

  test('빈 레지스트리에서 호출해도 에러 없음', () => {
    assert.doesNotThrow(() => killAllProcesses());
  });
});
