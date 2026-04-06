import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { findClaudeBinary } from './finder.js';

/** stream-json stdout JSONL에서 최종 결과 텍스트를 추출. */
function extractFinalResult(stdout: string): string {
  let lastAssistantText = '';
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      // result 타입이 최종 결과 (가장 신뢰도 높음)
      if (event.type === 'result' && typeof event.result === 'string') {
        return event.result;
      }
      // assistant 메시지에서 text content 누적
      if (event.type === 'assistant') {
        const msg = event.message as { content?: Array<{ type: string; text?: string }> } | undefined;
        const texts = (msg?.content ?? [])
          .filter(b => b.type === 'text' && b.text)
          .map(b => b.text as string);
        if (texts.length) lastAssistantText = texts.join('');
      }
    } catch { /* 불완전 JSON 라인 무시 */ }
  }
  return lastAssistantText;
}

export interface SpawnOptions {
  model?: string;
  timeout?: number;
  onChunk?: (text: string) => void;
}

export interface SpawnResult {
  success: boolean;
  result: string;
  error?: string;
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

    return new Promise<SpawnResult>((resolve) => {
      const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--model', model, '--no-session-persistence'];
      const child = spawn(claudePath, args, { env: process.env });
      resolveChild(child);

      const stdoutChunks: Buffer[] = [];
      let stderr = '';
      let lineBuf = '';  // JSONL 라인 버퍼 — 줄 단위로 분리해서 onChunk 전달

      child.stdout.on('data', (chunk: Buffer) => {
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

      const timer = setTimeout(() => {
        child.kill();
        resolve({ success: false, result: '', error: 'Timeout: Claude CLI가 응답하지 않습니다.' });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString();

        if (code !== 0 && !stdout) {
          resolve({ success: false, result: '', error: stderr || `Claude CLI 오류 (exit code ${code})` });
          return;
        }

        resolve({ success: true, result: extractFinalResult(stdout) });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
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
