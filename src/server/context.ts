import type { Context } from 'hono';
import fs from 'fs';
import path from 'path';
import { openDb } from '../db/index.js';
import { getWorkspaceOrNull, type WorkspaceContext } from '../workspace.js';
import { touchSession, deleteSession } from '../db/app-db.js';

export interface RequestContext {
  sessionId: string;
  workspace: WorkspaceContext;
  db: any;
}

export function getSessionIdFromRequest(c: Context): string | null {
  return c.req.header('x-codeforge-session') ?? c.req.query('session') ?? null;
}

export function getRequestContext(c: Context, opts: { requireWorkspace?: boolean } = {}): RequestContext | null {
  const sessionId = getSessionIdFromRequest(c);
  const workspace = getWorkspaceOrNull(sessionId);
  if (!workspace) {
    if (opts.requireWorkspace) throw new Error('Workspace session missing');
    return null;
  }

  // stale session 처리: workspace 폴더가 삭제/이동된 경우
  if (!fs.existsSync(path.dirname(workspace.dbPath))) {
    deleteSession(workspace.sessionId);
    if (opts.requireWorkspace) throw new Error('Workspace session missing');
    return null;
  }

  const db = openDb(workspace.dbPath);
  touchSession(workspace.sessionId);
  return { sessionId: workspace.sessionId, workspace, db };
}

export function requireRequestContext(c: Context): RequestContext {
  const ctx = getRequestContext(c);
  if (!ctx) throw new Error('Workspace session missing');
  return ctx;
}
