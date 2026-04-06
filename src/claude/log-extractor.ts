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

/** 프로바이더에 맞게 청크를 로그용 텍스트로 변환. Codex는 JSONL 파싱, Claude는 raw 텍스트. */
export function chunkToLogText(chunk: string, provider: string): string {
  return provider === 'codex' ? extractCodexLogText(chunk) : chunk;
}
