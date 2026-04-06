import { spawn } from 'child_process';
import { findClaudeBinary } from './finder.js';

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

/**
 * Claude CLI를 spawn하여 프롬프트를 실행하고 결과를 반환.
 * (vsc-secondbrain ClaudeCLISummarizer.ts 패턴 기반 ESM 포팅)
 */
export async function spawnClaude(prompt: string, options: SpawnOptions = {}): Promise<SpawnResult> {
  const model = options.model ?? 'claude-sonnet-4-6';
  const timeout = options.timeout ?? 600_000;

  const claudePath = await findClaudeBinary();
  if (!claudePath) {
    return {
      success: false,
      result: '',
      error: "Claude Code CLI를 찾을 수 없습니다. 'npm install -g @anthropic-ai/claude-code' 로 설치하세요.",
    };
  }

  return new Promise((resolve) => {
    const args = ['-p', '--output-format', 'text', '--model', model, '--no-session-persistence'];
    const child = spawn(claudePath, args, { env: process.env });

    const stdoutChunks: Buffer[] = [];
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      options.onChunk?.(chunk.toString());
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

      resolve({ success: true, result: stdout.trim() });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, result: '', error: err.message });
    });
  });
}
