import { spawn } from 'child_process';
import { findCodexBinary } from './finder.js';
import type { SpawnOptions, SpawnResult } from './spawner.js';

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
 * type==="message" && role==="assistant" 이벤트의 마지막 텍스트를 반환.
 * @internal export for testing
 */
export function parseCodexJsonl(stdout: string): string | null {
  const lines = stdout.split('\n').filter(l => l.trim());
  let lastText: string | null = null;

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      if (event.type === 'message' && event.role === 'assistant') {
        const content = event.content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (typeof part === 'object' && part !== null && (part as Record<string, unknown>).type === 'text') {
              const text = (part as Record<string, unknown>).text;
              if (typeof text === 'string') lastText = text;
            }
          }
        } else if (typeof content === 'string') {
          lastText = content;
        }
      }
    } catch { /* skip unparseable lines */ }
  }

  return lastText ? lastText.trim() : null;
}
