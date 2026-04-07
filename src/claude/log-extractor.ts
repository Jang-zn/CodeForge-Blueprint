const INPUT_TRUNCATE = 200;

export function pickText(event: Record<string, unknown>): string | null {
  if (typeof event.text === 'string' && event.text) return event.text;
  if (typeof event.delta === 'string' && event.delta) return event.delta;
  const delta = event.delta as Record<string, unknown> | undefined;
  if (delta && typeof delta === 'object' && typeof delta.text === 'string') return delta.text;
  return null;
}

function formatCodexEvent(event: Record<string, unknown>): string | null {
  const type = String(event.type ?? '');

  switch (type) {
    case 'task_started':
    case 'thread.started':
      return `[시작] 작업 시작\n`;

    case 'turn.started':
      return `[생성 중...]\n`;

    case 'tool_call': {
      const name = event.name ?? 'unknown';
      const raw = typeof event.input === 'string' ? event.input : JSON.stringify(event.input ?? '');
      const input = raw.length > INPUT_TRUNCATE ? raw.slice(0, INPUT_TRUNCATE) + '…' : raw;
      return `[도구] ${name}: ${input}\n`;
    }

    case 'task_complete': {
      const raw = typeof event.output === 'string' ? event.output : '';
      const output = raw.length > INPUT_TRUNCATE ? raw.slice(0, INPUT_TRUNCATE) + '…' : raw;
      return output ? `[완료] ${output}\n` : '[완료] 작업 완료\n';
    }

    case 'turn.completed':
      return `[완료] 작업 완료\n`;

    case 'item.completed': {
      const item = event.item as Record<string, unknown> | undefined;
      if (item?.type === 'agent_message') return `[응답 수신]\n`;
      return null;
    }

    case 'message': {
      if (event.role !== 'assistant') return null;
      const content = event.content;
      if (Array.isArray(content)) {
        const texts: string[] = [];
        for (const part of content as Record<string, unknown>[]) {
          if (part.type === 'text' && typeof part.text === 'string') texts.push(part.text as string);
        }
        return texts.length ? texts.join('') : null;
      }
      return typeof content === 'string' ? content : null;
    }

    default:
      return pickText(event);
  }
}

/** Codex --json JSONL 청크에서 사람이 읽을 수 있는 로그 텍스트를 추출. */
export function extractCodexLogText(chunk: string): string {
  const parts: string[] = [];
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      const text = formatCodexEvent(event);
      if (text) parts.push(text);
    } catch { /* 불완전 JSON 라인 무시 */ }
  }
  return parts.join('');
}

function formatClaudeStreamEvent(event: Record<string, unknown>): string | null {
  const type = String(event.type ?? '');

  // stream_event — --include-partial-messages 사용 시 실시간 스트리밍 이벤트
  if (type === 'stream_event') {
    const inner = event.event as Record<string, unknown> | undefined;
    if (!inner) return null;
    const innerType = String(inner.type ?? '');

    // content_block_delta — 텍스트 청크는 UI에 노출하지 않음 (PRD 원문 스트리밍 숨김)
    if (innerType === 'content_block_delta') {
      return null;
    }

    // content_block_start — tool_use 시작 시 도구명+설명 표시, text 시작 시 생성 중 표시
    if (innerType === 'content_block_start') {
      const block = inner.content_block as Record<string, unknown> | undefined;
      if (block?.type === 'tool_use' && typeof block.name === 'string') {
        const TOOL_LABELS: Record<string, string> = {
          Agent: '서브 에이전트 호출',
          Bash: '명령어 실행 중',
          Read: '파일 읽기 중',
          Write: '파일 작성 중',
          Edit: '파일 수정 중',
          Glob: '파일 탐색 중',
          Grep: '코드 검색 중',
          WebFetch: '웹 조회 중',
          WebSearch: '웹 검색 중',
        };
        const desc = TOOL_LABELS[block.name] ?? '실행 중';
        return `\n[도구] ${block.name}: ${desc}\n`;
      }
      // text 블록 시작 = Claude가 최종 응답 작성 시작
      if (block?.type === 'text') {
        return '\n[생성 중...]\n';
      }
      return null;
    }

    // message_start, content_block_stop, message_delta, message_stop — 무시
    return null;
  }

  // assistant — 완료된 전체 메시지 (partial messages가 이미 표시했으므로 무시)
  if (type === 'assistant') {
    return null;
  }

  if (type === 'result') {
    return '\n[완료] 문서 생성 완료\n';
  }

  // system, rate_limit_event 등은 무시
  return null;
}

/** Claude --output-format stream-json JSONL 청크에서 로그 텍스트 추출. */
export function extractClaudeLogText(chunk: string): string {
  const parts: string[] = [];
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      const text = formatClaudeStreamEvent(event);
      if (text) parts.push(text);
    } catch { /* 불완전 JSON 라인 무시 */ }
  }
  return parts.join('');
}

/** 프로바이더에 맞게 청크를 로그용 텍스트로 변환. */
export function chunkToLogText(chunk: string, provider: string): string {
  return provider === 'codex' ? extractCodexLogText(chunk) : extractClaudeLogText(chunk);
}
