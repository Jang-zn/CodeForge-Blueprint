import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface ClaudeStatus {
  available: boolean;
  path: string | null;
  version?: string;
}

export type CodexStatus = ClaudeStatus;

/**
 * Claude CLI 바이너리 자동 감지.
 * 탐색 순서: which/where -> npm root -g -> 플랫폼별 알려진 경로 -> null
 */
export async function findClaudeBinary(): Promise<string | null> {
  return findBinary('claude');
}

export async function findCodexBinary(): Promise<string | null> {
  return findBinary('codex');
}

async function findBinary(name: string): Promise<string | null> {
  const isWin = process.platform === 'win32';

  const strategies: Array<() => Promise<string | null>> = [
    () => tryWhich(name, isWin),
    () => tryNpmRoot(name, isWin),
    () => tryKnownPaths(name, isWin),
  ];

  for (const strategy of strategies) {
    const result = await strategy();
    if (result) return result;
  }

  return null;
}

export async function checkClaude(): Promise<ClaudeStatus> {
  return checkBinary(await findClaudeBinary());
}

export async function checkCodex(): Promise<CodexStatus> {
  return checkBinary(await findCodexBinary());
}

async function checkBinary(binPath: string | null): Promise<ClaudeStatus> {
  if (!binPath) return { available: false, path: null };

  try {
    const version = await new Promise<string>((resolve, reject) => {
      execFile(binPath, ['--version'], { timeout: 5000 }, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
    });
    return { available: true, path: binPath, version };
  } catch {
    return { available: true, path: binPath };
  }
}

function tryWhich(name: string, isWin: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const cmd = isWin ? 'where' : 'which';
    const target = isWin ? `${name}.cmd` : name;
    execFile(cmd, [target], { shell: isWin, timeout: 3000 }, (err, stdout) => {
      if (err || !stdout.trim()) { resolve(null); return; }
      resolve(stdout.trim().split('\n')[0].trim());
    });
  });
}

function tryNpmRoot(name: string, isWin: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('npm', ['root', '-g'], { shell: isWin, timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) { resolve(null); return; }
      const npmRoot = stdout.trim();
      const candidate = isWin
        ? path.join(path.dirname(npmRoot), `${name}.cmd`)
        : path.join(npmRoot, '..', 'bin', name);
      resolve(fs.existsSync(candidate) ? candidate : null);
    });
  });
}

function tryKnownPaths(name: string, isWin: boolean): Promise<string | null> {
  const home = os.homedir();
  let candidates: string[];

  if (isWin) {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
    candidates = [
      path.join(appData, 'npm', `${name}.cmd`),
      path.join(localAppData, 'npm', `${name}.cmd`),
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
          nvmCandidates.push(path.join(nvmVersionsDir, v, 'bin', name));
        }
      } catch { /* ignore */ }
    }
    candidates = [
      ...nvmCandidates,
      `/usr/local/bin/${name}`,
      `/opt/homebrew/bin/${name}`,
      `/usr/bin/${name}`,
    ];
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return Promise.resolve(candidate);
  }

  return Promise.resolve(null);
}
