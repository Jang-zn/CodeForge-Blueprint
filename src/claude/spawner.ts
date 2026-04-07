import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { findClaudeBinary, needsShell, MODEL_PATTERN } from './finder.js';

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/** stream-json stdout JSONL에서 최종 결과 텍스트와 토큰 사용량을 추출. */
function parseClaudeStdout(stdout: string): { text: string; usage: UsageTotals | undefined } {
  let lastAssistantText = '';
  let usage: UsageTotals | undefined;

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;

      // result 이벤트 — 세션 전체 누적 usage + 최종 텍스트
      if (event.type === 'result') {
        if (typeof event.result === 'string') lastAssistantText = event.result;
        const u = event.usage as Record<string, unknown> | undefined;
        if (u) {
          usage = {
            inputTokens: (u.input_tokens as number) ?? 0,
            outputTokens: (u.output_tokens as number) ?? 0,
            cacheCreationTokens: (u.cache_creation_input_tokens as number) ?? 0,
            cacheReadTokens: (u.cache_read_input_tokens as number) ?? 0,
          };
        }
        // result가 최종이므로 여기서 종료
        break;
      }

      // assistant 이벤트 — text content 누적 (fallback)
      if (event.type === 'assistant') {
        const msg = event.message as { content?: Array<{ type: string; text?: string }> } | undefined;
        const texts = (msg?.content ?? [])
          .filter(b => b.type === 'text' && b.text)
          .map(b => b.text as string);
        if (texts.length) lastAssistantText = texts.join('');
      }
    } catch { /* 불완전 JSON 라인 무시 */ }
  }

  return { text: lastAssistantText, usage };
}

export interface SpawnOptions {
  model?: string;
  /** wall-clock 최대 실행 시간(ms). 기본 1800000 (30분). */
  timeout?: number;
  /** 청크 무응답 idle 타임아웃(ms). 기본 300000 (5분). */
  idleTimeout?: number;
  cwd?: string;
  onChunk?: (text: string) => void;
}

export interface SpawnResult {
  success: boolean;
  result: string;
  error?: string;
  usage?: UsageTotals;
}

export interface SpawnHandle {
  promise: Promise<SpawnResult>;
  childReady: Promise<ChildProcess | null>;
}

/**
 * Claude CLI를 spawn하여 프롬프트를 실행하고 결과를 반환.
 * child process를 즉시 공개하는 handle을 반환.
 */
export function spawnClaudeWithHandle(prompt: string, options: SpawnOptions = {}): SpawnHandle {
  let resolveChild!: (child: ChildProcess | null) => void;
  const childReady = new Promise<ChildProcess | null>(r => { resolveChild = r; });

  const promise: Promise<SpawnResult> = (async () => {
    const model = options.model ?? 'claude-sonnet-4-6';
    const timeout = options.timeout ?? 600_000;

    const claudePath = await findClaudeBinary();
    if (!claudePath) {
      resolveChild(null);
      return {
        success: false,
        result: '',
        error: "Claude Code CLI를 찾을 수 없습니다. 'npm install -g @anthropic-ai/claude-code' 로 설치하세요.",
      };
    }

    if (!MODEL_PATTERN.test(model)) {
      resolveChild(null);
      return { success: false, result: '', error: `잘못된 모델 이름: ${model}` };
    }

    return new Promise<SpawnResult>((resolve) => {
      const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--model', model, '--no-session-persistence'];
      const useShell = needsShell(claudePath);
      const cmd = useShell ? `"${claudePath}"` : claudePath;
      const child = spawn(cmd, args, { env: process.env, shell: useShell, cwd: options.cwd });
      resolveChild(child);

      const stdoutChunks: Buffer[] = [];
      let stderr = '';
      let lineBuf = '';  // JSONL 라인 버퍼 — 줄 단위로 분리해서 onChunk 전달

      // idle timeout: 청크 수신 시마다 리셋. hard timeout: 절대 최대.
      const idleMs = options.idleTimeout ?? 300_000;   // 5분 무응답
      const hardMs = options.timeout ?? 1_800_000;     // 30분 wall-clock 안전선
      let idleTimer: ReturnType<typeof setTimeout>;
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          child.kill();
          resolve({ success: false, result: '', error: 'Timeout: Claude CLI가 5분간 응답이 없습니다.' });
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
        if (options.onChunk) {
          lineBuf += chunk.toString();
          const lines = lineBuf.split('\n');
          lineBuf = lines.pop() ?? '';  // 마지막 불완전 라인은 버퍼에 유지
          const completeLines = lines.filter(l => l.trim()).map(l => l + '\n').join('');
          if (completeLines) options.onChunk(completeLines);
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      // stdin에 프롬프트 전달 (ClaudeCLISummarizer.ts 패턴)
      child.stdin.write(prompt);
      child.stdin.end();

      child.on('close', (code) => {
        clearTimeout(idleTimer);
        clearTimeout(hardTimer);
        const stdout = Buffer.concat(stdoutChunks).toString();

        if (code !== 0 && !stdout) {
          resolve({ success: false, result: '', error: stderr || `Claude CLI 오류 (exit code ${code})` });
          return;
        }

        const { text, usage } = parseClaudeStdout(stdout);
        resolve({ success: true, result: text, usage });
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
 * Claude CLI를 spawn하여 프롬프트를 실행하고 결과를 반환.
 * (vsc-secondbrain ClaudeCLISummarizer.ts 패턴 기반 ESM 포팅)
 */
export async function spawnClaude(prompt: string, options: SpawnOptions = {}): Promise<SpawnResult> {
  return spawnClaudeWithHandle(prompt, options).promise;
}
