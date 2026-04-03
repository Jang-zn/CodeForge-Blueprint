import path from 'path';
import fs from 'fs';

export interface WorkspaceContext {
  rootPath: string;
  docsPath: string;
  dbPath: string;
  name: string;
}

let _workspace: WorkspaceContext | null = null;

export function initWorkspace(rootPath: string): WorkspaceContext {
  const absRoot = path.resolve(rootPath);
  const docsPath = path.join(absRoot, 'docs');
  const dbDir = path.join(docsPath, '.codeforge');
  const dbPath = path.join(dbDir, 'data.db');

  fs.mkdirSync(dbDir, { recursive: true });

  _workspace = {
    rootPath: absRoot,
    docsPath,
    dbPath,
    name: path.basename(absRoot),
  };
  return _workspace;
}

export function getWorkspace(): WorkspaceContext {
  if (!_workspace) throw new Error('Workspace not initialized');
  return _workspace;
}
