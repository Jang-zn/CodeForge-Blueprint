import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import {
  createSession,
  getSession,
  deleteSession,
  addRecent,
  type SessionRow,
} from './db/app-db.js';

export interface WorkspaceContext {
  sessionId: string;
  rootPath: string;
  docsPath: string;
  dbPath: string;
  name: string;
  openedAt: string;
}

export { getRecents } from './db/app-db.js';

export function expandHome(p: string): string {
  return p.replace(/^~/, os.homedir());
}

export function openWorkspace(rootPath: string): WorkspaceContext {
  const absRoot = path.resolve(expandHome(rootPath));
  const docsPath = path.join(absRoot, 'docs');
  const dbDir = path.join(docsPath, '.codeforge');
  const dbPath = path.join(dbDir, 'data.db');

  fs.mkdirSync(dbDir, { recursive: true });
  addRecent(absRoot);

  const ws: WorkspaceContext = {
    sessionId: crypto.randomUUID(),
    rootPath: absRoot,
    docsPath,
    dbPath,
    name: path.basename(absRoot),
    openedAt: new Date().toISOString(),
  };
  createSession({
    id: ws.sessionId,
    workspaceRoot: absRoot,
    workspaceName: ws.name,
    docsPath,
    dbPath,
  });
  return ws;
}

function rowToContext(row: SessionRow): WorkspaceContext {
  return {
    sessionId: row.id,
    rootPath: row.workspace_root,
    docsPath: row.docs_path,
    dbPath: row.db_path,
    name: row.workspace_name,
    openedAt: row.created_at,
  };
}

export function getWorkspace(sessionId: string): WorkspaceContext {
  const row = getSession(sessionId);
  if (!row) throw new Error('Workspace not initialized');
  return rowToContext(row);
}

export function getWorkspaceOrNull(sessionId: string | null | undefined): WorkspaceContext | null {
  if (!sessionId) return null;
  const row = getSession(sessionId);
  return row ? rowToContext(row) : null;
}

export function hasWorkspace(sessionId: string | null | undefined): boolean {
  return getWorkspaceOrNull(sessionId) !== null;
}

export function closeWorkspaceSession(sessionId: string): void {
  deleteSession(sessionId);
}
