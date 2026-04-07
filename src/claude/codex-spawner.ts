import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { findCodexBinary, needsShell, MODEL_PATTERN } from './finder.js';
import type { SpawnOptions, SpawnResult, SpawnHandle, UsageTotals } from './spawner.js';
import { pickText } from './log-extractor.js';

const LARGE_PROMPT_THRESHOLD = 100_000; // 100KB

/**
 * Codex CLI를 spawn하여 프롬프트를 실행하고 결과를 반환.
 * child process를 즉시 공개하는 handle을 반환.
 */
export function spawnCodexWithHandle(prompt: string, options: SpawnOptions = {}): SpawnHandle {
  let resolveChild!: (child: ChildProcess | null) => void;
  const childReady = new Promise<ChildProcess | null>(r => { resolveChild = r; });

  const promise: Promise<SpawnResult> = (async () => {
    const model = options.model ?? 'o4-mini';
    const timeout = options.timeout ?? 300_000;

    const codexPath = await findCodexBinary();
    if (!codexPath) {
      resolveChild(null);
      return {
        success: false,
        result: '',
        error: "Codex CLI를 찾을 수 없습니다. 'npm install -g @openai/codex' 로 설치하세요.",
      };
    }

    if (!MODEL_PATTERN.test(model)) {
      resolveChild(null);
      return { success: false, result: '', error: `잘못된 모델 이름: ${model}` };
    }

    return new Promise<SpawnResult>((resolve) => {
      const useShell = needsShell(codexPath);
      // Windows shell 환경에서는 positional arg 이스케이프 이슈 회피를 위해 항상 stdin 파이프 사용
      const usePipe = prompt.length > LARGE_PROMPT_THRESHOLD || useShell;

      // 긴 프롬프트는 stdin 파이프, 짧은 프롬프트는 positional 인자
      // 100KB 초과 프롬프트는 OS arg 한계 회피를 위해 stdin 파이프 사용
      const args = usePipe
        ? ['exec', '--json', '--full-auto', '--ephemeral', '-m', model, '-']
        : ['exec', '--json', '--full-auto', '--ephemeral', '-m', model, prompt];

      const cmd = useShell ? `"${codexPath}"` : codexPath;
      const child = spawn(cmd, args, { env: process.env, shell: useShell, cwd: options.cwd });
      resolveChild(child);

      const stdoutChunks: Buffer[] = [];
      let stderr = '';

      // idle timeout: 청크 수신 시마다 리셋. hard timeout: 절대 최대.
      const idleMs = options.idleTimeout ?? 300_000;   // 5분 무응답
      const hardMs = options.timeout ?? 1_800_000;     // 30분 wall-clock 안전선
      let idleTimer: ReturnType<typeof setTimeout>;
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          child.kill();
          resolve({ success: false, result: '', error: 'Timeout: Codex CLI가 5분간 응답이 없습니다.' });
        }, idleMs);
      };
      resetIdle();
      const hardTimer = setTimeout(() => {
        child.kill();
        resolve({ success: false, result: '', error: 'Timeout: 최대 실행 시간(30분)을 초과했습니다.' });
      }, hardMs);

      child.stdout.on('data', (chunk: Buffer) => {
        resetIdle();
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

      child.on('close', (code) => {
        clearTimeout(idleTimer);
        clearTimeout(hardTimer);
        const stdout = Buffer.concat(stdoutChunks).toString();

        if (code !== 0 && !stdout) {
          resolve({ success: false, result: '', error: stderr || `Codex CLI 오류 (exit code ${code})` });
          return;
        }

        const { text, usage } = parseCodexJsonl(stdout);
        resolve({ success: true, result: text ?? stdout.trim(), usage });
      });

      child.on('error', (err) => {
        clearTimeout(idleTimer);
        clearTimeout(hardTimer);
        resolveChild(null);
        resolve({ success: false, result: '', error: err.message });
      });
    });
  })();

  return { promise, childReady };
}

/**
 * Codex CLI를 spawn하여 프롬프트를 실행하고 결과를 반환.
 * 출력 형식: JSONL (--json 플래그), type==="message" 이벤트에서 텍스트 추출.
 */
export async function spawnCodex(prompt: string, options: SpawnOptions = {}): Promise<SpawnResult> {
  return spawnCodexWithHandle(prompt, options).promise;
}

/**
 * Codex --json JSONL 출력 파싱.
 * assistant 메시지 텍스트와 토큰 사용량을 추출. v0.118.0+의 turn.completed/delta 형식도 지원.
 * @internal export for testing
 */
export function parseCodexJsonl(stdout: string): { text: string | null; usage: UsageTotals | undefined } {
  const lines = stdout.split('\n').filter(l => l.trim());
  let lastText: string | null = null;
  const deltaAccum: string[] = [];
  let usage: UsageTotals | undefined;

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
        // turn.completed에 usage 포함 시 추출
        const u = event.usage as Record<string, unknown> | undefined;
        if (u) {
          usage = {
            inputTokens: (u.input_tokens as number) ?? 0,
            outputTokens: (u.output_tokens as number) ?? 0,
            cacheCreationTokens: (u.cache_creation_input_tokens as number) ?? 0,
            cacheReadTokens: (u.cache_read_input_tokens as number) ?? 0,
          };
        }
        continue;
      }

      // token_count 이벤트 (일부 codex 버전)
      if (type === 'token_count') {
        usage = {
          inputTokens: (event.input_tokens as number) ?? 0,
          outputTokens: (event.output_tokens as number) ?? 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        };
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

  const text = lastText ? lastText.trim() : (deltaAccum.length ? deltaAccum.join('').trim() : null);
  return { text, usage };
}
