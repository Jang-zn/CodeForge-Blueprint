import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseCodexJsonl } from '../../src/claude/codex-spawner.js';

describe('parseCodexJsonl', () => {
  test('빈 문자열 → null 반환', () => {
    assert.equal(parseCodexJsonl(''), null);
  });

  test('유효한 JSONL이 없으면 null 반환', () => {
    assert.equal(parseCodexJsonl('not json at all\nstill not json'), null);
  });

  test('type=message + role=assistant 이벤트에서 텍스트 추출', () => {
    const line = JSON.stringify({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello from Codex' }],
    });
    assert.equal(parseCodexJsonl(line), 'Hello from Codex');
  });

  test('content가 문자열인 경우도 처리', () => {
    const line = JSON.stringify({
      type: 'message',
      role: 'assistant',
      content: 'Plain string content',
    });
    assert.equal(parseCodexJsonl(line), 'Plain string content');
  });

  test('여러 메시지 중 마지막 메시지만 반환', () => {
    const lines = [
      JSON.stringify({ type: 'task_started' }),
      JSON.stringify({ type: 'message', role: 'assistant', content: [{ type: 'text', text: 'First' }] }),
      JSON.stringify({ type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Last' }] }),
      JSON.stringify({ type: 'task_complete' }),
    ].join('\n');
    assert.equal(parseCodexJsonl(lines), 'Last');
  });

  test('role이 user인 메시지는 무시', () => {
    const lines = [
      JSON.stringify({ type: 'message', role: 'user', content: [{ type: 'text', text: 'User msg' }] }),
      JSON.stringify({ type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Assistant msg' }] }),
    ].join('\n');
    assert.equal(parseCodexJsonl(lines), 'Assistant msg');
  });

  test('파싱 불가 라인이 섞여 있어도 나머지 처리', () => {
    const lines = [
      'NOT JSON',
      JSON.stringify({ type: 'message', role: 'assistant', content: [{ type: 'text', text: 'Valid' }] }),
      '{broken json',
    ].join('\n');
    assert.equal(parseCodexJsonl(lines), 'Valid');
  });

  test('빈 content 배열 → null 반환', () => {
    const line = JSON.stringify({
      type: 'message',
      role: 'assistant',
      content: [],
    });
    assert.equal(parseCodexJsonl(line), null);
  });

  test('text가 아닌 content part는 무시', () => {
    const lines = [
      JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'image', url: 'http://example.com/img.png' },
          { type: 'text', text: 'Text after image' },
        ],
      }),
    ].join('\n');
    assert.equal(parseCodexJsonl(lines), 'Text after image');
  });

  test('결과 텍스트 앞뒤 공백 제거', () => {
    const line = JSON.stringify({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '  trimmed  ' }],
    });
    assert.equal(parseCodexJsonl(line), 'trimmed');
  });

  test('task_started, task_complete 등 다른 이벤트는 무시', () => {
    const lines = [
      JSON.stringify({ type: 'task_started', id: 'abc' }),
      JSON.stringify({ type: 'tool_call', name: 'bash', input: 'ls' }),
      JSON.stringify({ type: 'task_complete', output: 'some output' }),
    ].join('\n');
    assert.equal(parseCodexJsonl(lines), null);
  });
});
