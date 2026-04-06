import type { ChildProcess } from 'child_process';

const _registry = new Map<string, ChildProcess>();

export function registerProcess(jobId: string, child: ChildProcess): void {
  _registry.set(jobId, child);
}

export function unregisterProcess(jobId: string): void {
  _registry.delete(jobId);
}

export function killProcess(jobId: string): boolean {
  const child = _registry.get(jobId);
  if (!child) return false;
  try {
    child.kill('SIGTERM');
    // 5초 후 SIGKILL (이미 종료된 경우 에러 무시)
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, 5_000);
  } catch {
    // already exited — safe no-op
  }
  _registry.delete(jobId);
  return true;
}

export function killAllProcesses(): void {
  for (const [jobId] of _registry) {
    killProcess(jobId);
  }
}
