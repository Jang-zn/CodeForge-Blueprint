import { spawn } from 'child_process';
import { findCodexBinary } from './finder.js';
import type { SpawnOptions, SpawnResult } from './spawner.js';
import { pickText } from './log-extractor.js';

const LARGE_PROMPT_THRESHOLD = 100_000; // 100KB

/**
 * Codex CLI를 spawn하여 프롬프트를 실행하고 결과를 반환.
 * 출력 형식: JSONL (--json 플래그), type==="message" 이벤트에서 텍스트 추출.
 */
export async function spawnCodex(prompt: string, options: SpawnOptions = {}): Promise<SpawnResult> {
  const model = options.model ?? 'o4-mini';
  const timeout = options.timeout ?? 300_000;

  const codexPath = await findCodexBinary();
  if (!codexPath) {
    return {
      success: false,
      result: '',
      error: "Codex CLI를 찾을 수 없습니다. 'npm install -g @openai/codex' 로 설치하세요.",
    };
  }

  return new Promise((resolve) => {
    const usePipe = prompt.length > LARGE_PROMPT_THRESHOLD;

    // 긴 프롬프트는 stdin 파이프, 짧은 프롬프트는 positional 인자
    // 100KB 초과 프롬프트는 OS arg 한계 회피를 위해 stdin 파이프 사용
    const args = usePipe
      ? ['exec', '--json', '--full-auto', '--ephemeral', '-m', model, '-']
      : ['exec', '--json', '--full-auto', '--ephemeral', '-m', model, prompt];

    const child = spawn(codexPath, args, { env: process.env });

    const stdoutChunks: Buffer[] = [];
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      options.onChunk?.(chunk.toString());
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    if (usePipe) {
      child.stdin.write(prompt);
    }
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill();
      resolve({ success: false, result: '', error: 'Timeout: Codex CLI가 응답하지 않습니다.' });
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString();

      if (code !== 0 && !stdout) {
        resolve({ success: false, result: '', error: stderr || `Codex CLI 오류 (exit code ${code})` });
        return;
      }

      const result = parseCodexJsonl(stdout);
      resolve({ success: true, result: result ?? stdout.trim() });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, result: '', error: err.message });
    });
  });
}

/**
 * Codex --json JSONL 출력 파싱.
 * assistant 메시지 텍스트를 추출. v0.118.0+의 turn.completed/delta 형식도 지원.
 * @internal export for testing
 */
export function parseCodexJsonl(stdout: string): string | null {
  const lines = stdout.split('\n').filter(l => l.trim());
  let lastText: string | null = null;
  const deltaAccum: string[] = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const type = String(event.type ?? '');

      if (type === 'message' && event.role === 'assistant') {
        const content = event.content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (typeof part === 'object' && part !== null) {
              const p = part as Record<string, unknown>;
              if (p.type === 'text' && typeof p.text === 'string') lastText = p.text;
            }
          }
        } else if (typeof content === 'string') {
          lastText = content;
        }
        continue;
      }

      if (type === 'turn.completed') {
        const output = event.output;
        if (typeof output === 'string' && output) lastText = output;
        if (typeof output === 'object' && output !== null) {
          const o = output as Record<string, unknown>;
          if (typeof o.text === 'string') lastText = o.text;
        }
        continue;
      }

      // v0.118.0: item.completed 이벤트에 agent_message 텍스트로 최종 응답 전달
      if (type === 'item.completed') {
        const item = event.item as Record<string, unknown> | undefined;
        if (item?.type === 'agent_message' && typeof item.text === 'string') {
          lastText = item.text;
        }
        continue;
      }

      // message/turn.completed 없이 스트리밍 delta만 오는 경우 누적
      const deltaText = pickText(event);
      if (deltaText) deltaAccum.push(deltaText);
    } catch { /* skip unparseable lines */ }
  }

  if (lastText) return lastText.trim();
  if (deltaAccum.length) return deltaAccum.join('').trim();
  return null;
}
