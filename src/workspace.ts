import path from 'path';
import fs from 'fs';
import os from 'os';

export interface WorkspaceContext {
  rootPath: string;
  docsPath: string;
  dbPath: string;
  name: string;
}

const RECENTS_PATH = path.join(os.homedir(), '.codeforge-blueprint', 'recents.json');

export function getRecents(): string[] {
  try {
    return JSON.parse(fs.readFileSync(RECENTS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveRecent(rootPath: string): void {
  const recents = getRecents().filter(r => r !== rootPath);
  recents.unshift(rootPath);
  const dir = path.dirname(RECENTS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RECENTS_PATH, JSON.stringify(recents.slice(0, 10)));
}

let _workspace: WorkspaceContext | null = null;

export function expandHome(p: string): string {
  return p.replace(/^~/, os.homedir());
}

export function openWorkspace(rootPath: string): WorkspaceContext {
  const absRoot = path.resolve(expandHome(rootPath));
  const docsPath = path.join(absRoot, 'docs');
  const dbDir = path.join(docsPath, '.codeforge');
  const dbPath = path.join(dbDir, 'data.db');

  fs.mkdirSync(dbDir, { recursive: true });
  saveRecent(absRoot);

  _workspace = { rootPath: absRoot, docsPath, dbPath, name: path.basename(absRoot) };
  return _workspace;
}

export function getWorkspace(): WorkspaceContext {
  if (!_workspace) throw new Error('Workspace not initialized');
  return _workspace;
}

export function getWorkspaceOrNull(): WorkspaceContext | null {
  return _workspace;
}

export function hasWorkspace(): boolean {
  return _workspace !== null;
}
