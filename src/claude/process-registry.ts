import type { ChildProcess } from 'child_process';

const _registry = new Map<string, Set<ChildProcess>>();

export function registerProcess(jobId: string, child: ChildProcess): void {
  let children = _registry.get(jobId);
  if (!children) {
    children = new Set();
    _registry.set(jobId, children);
  }
  children.add(child);
}

export function unregisterProcess(jobId: string, child?: ChildProcess): void {
  if (!child) {
    _registry.delete(jobId);
    return;
  }
  const children = _registry.get(jobId);
  if (!children) return;
  children.delete(child);
  if (children.size === 0) {
    _registry.delete(jobId);
  }
}

export function killProcess(jobId: string): boolean {
  const children = _registry.get(jobId);
  if (!children || children.size === 0) return false;
  for (const child of children) {
    try {
      child.kill('SIGTERM');
      // 5초 후 SIGKILL (이미 종료된 경우 에러 무시)
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }, 5_000);
    } catch {
      // already exited — safe no-op
    }
  }
  _registry.delete(jobId);
  return true;
}

export function killAllProcesses(): void {
  for (const [jobId] of _registry) {
    killProcess(jobId);
  }
}
