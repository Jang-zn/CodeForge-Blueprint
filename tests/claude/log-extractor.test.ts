import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractCodexLogText, chunkToLogText } from '../../src/claude/log-extractor.js';

describe('extractCodexLogText', () => {
  it('task_started 이벤트 → [시작] 라인', () => {
    const chunk = JSON.stringify({ type: 'task_started', id: 'abc' });
    assert.equal(extractCodexLogText(chunk), '[시작] 작업 시작\n');
  });

  it('tool_call 이벤트 → [도구] 라인', () => {
    const chunk = JSON.stringify({ type: 'tool_call', name: 'bash', input: 'ls -la' });
    assert.equal(extractCodexLogText(chunk), '[도구] bash: ls -la\n');
  });

  it('tool_call.input 200자 초과 시 절삭', () => {
    const longInput = 'x'.repeat(300);
    const chunk = JSON.stringify({ type: 'tool_call', name: 'bash', input: longInput });
    const result = extractCodexLogText(chunk);
    assert.ok(result.includes('…'));
    assert.ok(result.length < 300);
  });

  it('tool_call.input이 객체일 때 JSON 직렬화', () => {
    const chunk = JSON.stringify({ type: 'tool_call', name: 'readFile', input: { path: '/foo' } });
    const result = extractCodexLogText(chunk);
    assert.ok(result.includes('[도구] readFile:'));
  });

  it('task_complete 이벤트 → [완료] 라인', () => {
    const chunk = JSON.stringify({ type: 'task_complete', output: '완료됨' });
    assert.equal(extractCodexLogText(chunk), '[완료] 완료됨\n');
  });

  it('task_complete output 없으면 기본 메시지', () => {
    const chunk = JSON.stringify({ type: 'task_complete' });
    assert.equal(extractCodexLogText(chunk), '[완료] 작업 완료\n');
  });

  it('message assistant → 텍스트 내용 추출', () => {
    const chunk = JSON.stringify({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '안녕하세요' }],
    });
    assert.equal(extractCodexLogText(chunk), '안녕하세요');
  });

  it('message user → null (무시)', () => {
    const chunk = JSON.stringify({
      type: 'message',
      role: 'user',
      content: [{ type: 'text', text: '유저 메시지' }],
    });
    assert.equal(extractCodexLogText(chunk), '');
  });

  it('알 수 없는 이벤트 타입 → 빈 문자열', () => {
    const chunk = JSON.stringify({ type: 'unknown_event', data: 'foo' });
    assert.equal(extractCodexLogText(chunk), '');
  });

  it('불완전 JSON 라인 무시', () => {
    const chunk = '{"type":"task_started","id":"abc"}\n{"type":"tool_call","na'; // 잘린 라인
    const result = extractCodexLogText(chunk);
    assert.equal(result, '[시작] 작업 시작\n'); // 완전한 라인만 처리
  });

  it('빈 문자열 → 빈 문자열', () => {
    assert.equal(extractCodexLogText(''), '');
  });

  it('여러 이벤트 혼합 처리', () => {
    const lines = [
      JSON.stringify({ type: 'task_started', id: 'x' }),
      JSON.stringify({ type: 'tool_call', name: 'bash', input: 'echo hi' }),
      JSON.stringify({ type: 'task_complete', output: '완료' }),
    ].join('\n');
    const result = extractCodexLogText(lines);
    assert.ok(result.includes('[시작]'));
    assert.ok(result.includes('[도구] bash: echo hi'));
    assert.ok(result.includes('[완료] 완료'));
  });

  it('thread.started 이벤트 → [시작] 라인 (v0.118.0+)', () => {
    const chunk = JSON.stringify({ type: 'thread.started', thread_id: 'abc' });
    assert.equal(extractCodexLogText(chunk), '[시작] 작업 시작\n');
  });

  it('turn.started 이벤트 → [생성 중...] 라인', () => {
    const chunk = JSON.stringify({ type: 'turn.started' });
    assert.equal(extractCodexLogText(chunk), '[생성 중...]\n');
  });

  it('turn.completed 이벤트 → [완료] 라인', () => {
    const chunk = JSON.stringify({ type: 'turn.completed' });
    assert.equal(extractCodexLogText(chunk), '[완료] 작업 완료\n');
  });

  it('delta 이벤트 — text 필드 직접 추출', () => {
    const chunk = JSON.stringify({ type: 'response.output_text.delta', text: '안녕' });
    assert.equal(extractCodexLogText(chunk), '안녕');
  });
});

describe('chunkToLogText', () => {
  it('codex provider → extractCodexLogText 위임', () => {
    const chunk = JSON.stringify({ type: 'thread.started' });
    assert.equal(chunkToLogText(chunk, 'codex'), '[시작] 작업 시작\n');
  });

  it('claude provider → raw chunk 그대로 반환', () => {
    const chunk = '스트리밍 텍스트';
    assert.equal(chunkToLogText(chunk, 'claude'), '스트리밍 텍스트');
  });
});
