import type { ProviderType } from '../db/repository.js';

const INPUT_TRUNCATE = 200;
const MAX_TOOL_INPUT_BUF = 4096; // tool input 버퍼 상한 — Write/Edit 대형 파일 내용 방지

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

// 로그에 허용되는 prefix 패턴 — 이 외의 텍스트는 suppress
const KNOWN_PREFIXES = ['[도구]', '[시작]', '[완료]', '[생성 중', '[응답 수신]', '→'];

function isKnownLogPrefix(text: string): boolean {
  const t = text.trimStart();
  return KNOWN_PREFIXES.some(p => t.startsWith(p));
}

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

/** tool_use 블록의 input JSON에서 사람이 읽기 쉬운 설명을 추출. */
function extractToolDetail(toolName: string, inputJson: string): string {
  try {
    const input = JSON.parse(inputJson) as Record<string, unknown>;
    if ((toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') && typeof input.file_path === 'string') {
      return shortenPath(input.file_path);
    }
    if (toolName === 'Glob' && typeof input.pattern === 'string') {
      return input.pattern;
    }
    if (toolName === 'Grep' && typeof input.pattern === 'string') {
      return `"${input.pattern}"`;
    }
    if (toolName === 'Bash' && typeof input.command === 'string') {
      const cmd = input.command;
      return cmd.length > 80 ? cmd.slice(0, 80) + '…' : cmd;
    }
    if (toolName === 'Agent' && typeof input.description === 'string') {
      return input.description;
    }
  } catch { /* 불완전 JSON 무시 */ }
  return '';
}

/** 절대 경로를 마지막 2~3 세그먼트로 줄임. */
function shortenPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 3) return parts.join('/');
  return parts.slice(-3).join('/');
}

/**
 * Claude stream-json JSONL 청크를 처리하는 상태 기반 추출기.
 * tool_use 블록의 input_json_delta를 누적하여 파일 경로 등을 표시.
 */
export class ClaudeLogExtractor {
  private currentBlockType: 'text' | 'tool_use' | null = null;
  private currentToolName: string | null = null;
  private toolInputBuf: string = '';

  processChunk(chunk: string): string {
    const parts: string[] = [];
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as Record<string, unknown>;
        const text = this.processEvent(event);
        if (text && isKnownLogPrefix(text)) {
          parts.push(text);
        }
      } catch { /* 불완전 JSON 라인 무시 */ }
    }
    return parts.join('');
  }

  private processEvent(event: Record<string, unknown>): string | null {
    const type = String(event.type ?? '');

    if (type === 'stream_event') {
      const inner = event.event as Record<string, unknown> | undefined;
      if (!inner) return null;
      const innerType = String(inner.type ?? '');

      if (innerType === 'content_block_start') {
        const block = inner.content_block as Record<string, unknown> | undefined;
        if (block?.type === 'tool_use' && typeof block.name === 'string') {
          this.currentBlockType = 'tool_use';
          this.currentToolName = block.name;
          this.toolInputBuf = '';
          const desc = TOOL_LABELS[block.name] ?? '실행 중';
          return `\n[도구] ${block.name}: ${desc}\n`;
        }
        if (block?.type === 'text') {
          this.currentBlockType = 'text';
          this.currentToolName = null;
          this.toolInputBuf = '';
          return '\n[생성 중...]\n';
        }
        return null;
      }

      if (innerType === 'content_block_delta') {
        const delta = inner.delta as Record<string, unknown> | undefined;
        const deltaType = String(delta?.type ?? '');
        // tool_use 블록 내 input_json_delta — 누적만 하고 표시 안 함
        if (deltaType === 'input_json_delta' && this.currentBlockType === 'tool_use') {
          if (typeof delta?.partial_json === 'string' && this.toolInputBuf.length < MAX_TOOL_INPUT_BUF) {
            this.toolInputBuf += delta.partial_json;
          }
        }
        // text_delta (텍스트 블록) — 콘텐츠 suppress
        return null;
      }

      if (innerType === 'content_block_stop') {
        let result: string | null = null;
        if (this.currentBlockType === 'tool_use' && this.toolInputBuf && this.currentToolName) {
          const detail = extractToolDetail(this.currentToolName, this.toolInputBuf);
          result = detail ? `→ ${detail}\n` : null;
        }
        this.currentBlockType = null;
        this.currentToolName = null;
        this.toolInputBuf = '';
        return result;
      }

      // message_start, message_delta, message_stop — 무시
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
}

/** stateless 호환 함수 — 하위 호환용. 상태가 필요한 경우 ClaudeLogExtractor 사용. */
export function extractClaudeLogText(chunk: string): string {
  return new ClaudeLogExtractor().processChunk(chunk);
}

/** 각 spawn 세션용 extractor 인스턴스 생성 팩토리. */
export function createLogExtractor(provider: ProviderType): { processChunk: (chunk: string) => string } {
  if (provider === 'codex') {
    return { processChunk: extractCodexLogText };
  }
  return new ClaudeLogExtractor();
}

/** 프로바이더에 맞게 청크를 로그용 텍스트로 변환 (하위 호환). */
export function chunkToLogText(chunk: string, provider: ProviderType): string {
  return provider === 'codex' ? extractCodexLogText(chunk) : extractClaudeLogText(chunk);
}
