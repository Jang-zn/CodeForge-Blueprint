import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface ClaudeStatus {
  available: boolean;
  path: string | null;
  version?: string;
}

/**
 * Claude CLI 바이너리 자동 감지.
 * 탐색 순서: which/where -> npm root -g -> 플랫폼별 알려진 경로 -> null
 * (vsc-secondbrain spawnHelper.ts 패턴 기반 ESM 포팅)
 */
export async function findClaudeBinary(): Promise<string | null> {
  const isWin = process.platform === 'win32';

  const strategies: Array<() => Promise<string | null>> = [
    () => tryWhich(isWin),
    () => tryNpmRoot(isWin),
    () => tryKnownPaths(isWin),
  ];

  for (const strategy of strategies) {
    const result = await strategy();
    if (result) return result;
  }

  return null;
}

export async function checkClaude(): Promise<ClaudeStatus> {
  const claudePath = await findClaudeBinary();
  if (!claudePath) return { available: false, path: null };

  try {
    const version = await new Promise<string>((resolve, reject) => {
      execFile(claudePath, ['--version'], { timeout: 5000 }, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
    });
    return { available: true, path: claudePath, version };
  } catch {
    return { available: true, path: claudePath };
  }
}

function tryWhich(isWin: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const cmd = isWin ? 'where' : 'which';
    const target = isWin ? 'claude.cmd' : 'claude';
    execFile(cmd, [target], { shell: isWin, timeout: 3000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
        return;
      }
      resolve(stdout.trim().split('\n')[0].trim());
    });
  });
}

function tryNpmRoot(isWin: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('npm', ['root', '-g'], { shell: isWin, timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
        return;
      }
      const npmRoot = stdout.trim();
      const candidate = isWin
        ? path.join(path.dirname(npmRoot), 'claude.cmd')
        : path.join(npmRoot, '..', 'bin', 'claude');

      resolve(fs.existsSync(candidate) ? candidate : null);
    });
  });
}

function tryKnownPaths(isWin: boolean): Promise<string | null> {
  const home = os.homedir();
  let candidates: string[];

  if (isWin) {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
    candidates = [
      path.join(appData, 'npm', 'claude.cmd'),
      path.join(localAppData, 'npm', 'claude.cmd'),
    ];
  } else {
    const nvmVersionsDir = path.join(home, '.nvm', 'versions', 'node');
    const nvmCandidates: string[] = [];
    if (fs.existsSync(nvmVersionsDir)) {
      try {
        const versions = fs.readdirSync(nvmVersionsDir)
          .filter(v => v.startsWith('v'))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        for (const v of versions) {
          nvmCandidates.push(path.join(nvmVersionsDir, v, 'bin', 'claude'));
        }
      } catch { /* ignore */ }
    }
    candidates = [
      ...nvmCandidates,
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      '/usr/bin/claude',
    ];
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return Promise.resolve(candidate);
  }

  return Promise.resolve(null);
}
