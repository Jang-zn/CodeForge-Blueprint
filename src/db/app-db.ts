import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BetterSqlite3 = require('better-sqlite3') as any;

export interface SessionRow {
  id: string;
  workspace_root: string;
  workspace_name: string;
  docs_path: string;
  db_path: string;
  created_at: string;
  last_active_at: string;
}

const APP_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_root TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  docs_path TEXT NOT NULL,
  db_path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recents (
  workspace_root TEXT PRIMARY KEY,
  last_opened_at TEXT DEFAULT (datetime('now'))
);
`;

let _appDb: any = null;
const _lastTouchTime = new Map<string, number>();
const TOUCH_THROTTLE_MS = 60_000;

function getAppBaseDir(): string {
  return process.env.CODEFORGE_BLUEPRINT_HOME || path.join(os.homedir(), '.codeforge-blueprint');
}

function getAppDbPath(): string {
  return path.join(getAppBaseDir(), 'app.db');
}

function migrateRecentsJson(db: any): void {
  const recentsPath = path.join(getAppBaseDir(), 'recents.json');
  try {
    const raw = fs.readFileSync(recentsPath, 'utf-8');
    const all: unknown = JSON.parse(raw);
    if (!Array.isArray(all)) return;

    const paths = all.filter((p): p is string => typeof p === 'string');
    // Negative offsets preserve insertion order: index 0 (most recent) gets datetime('now', '0 seconds')
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO recents (workspace_root, last_opened_at)
      VALUES (?, datetime('now', ? || ' seconds'))
    `);
    const tx = db.transaction(() => {
      paths.forEach((p, i) => stmt.run(p, String(-i)));
    });
    tx();

    fs.renameSync(recentsPath, recentsPath + '.bak');
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      // Unexpected error — log but don't block startup
      console.warn('[app-db] recents.json migration failed:', err.message);
    }
  }
}

export function initAppDb(): void {
  if (_appDb) return;
  const dbPath = getAppDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(APP_SCHEMA_SQL);

  migrateRecentsJson(db);

  _appDb = db;
}

export function getAppDb(): any {
  if (!_appDb) initAppDb();
  return _appDb;
}

export function closeAppDb(): void {
  if (!_appDb) return;
  try { _appDb.close(); } catch { /* ignore */ }
  _appDb = null;
}

export function createSession(session: {
  id: string;
  workspaceRoot: string;
  workspaceName: string;
  docsPath: string;
  dbPath: string;
}): void {
  getAppDb().prepare(`
    INSERT OR REPLACE INTO sessions (id, workspace_root, workspace_name, docs_path, db_path)
    VALUES (?, ?, ?, ?, ?)
  `).run(session.id, session.workspaceRoot, session.workspaceName, session.docsPath, session.dbPath);
}

export function getSession(id: string): SessionRow | null {
  return getAppDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) ?? null;
}

export function touchSession(id: string): void {
  const now = Date.now();
  if ((now - (_lastTouchTime.get(id) ?? 0)) < TOUCH_THROTTLE_MS) return;
  getAppDb().prepare(`UPDATE sessions SET last_active_at = datetime('now') WHERE id = ?`).run(id);
  _lastTouchTime.set(id, now);
}

export function deleteSession(id: string): void {
  getAppDb().prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function addRecent(workspaceRoot: string): void {
  getAppDb().prepare(`
    INSERT INTO recents (workspace_root, last_opened_at) VALUES (?, datetime('now'))
    ON CONFLICT(workspace_root) DO UPDATE SET last_opened_at = datetime('now')
  `).run(workspaceRoot);
}

export function getRecents(): string[] {
  const rows: { workspace_root: string }[] = getAppDb()
    .prepare('SELECT workspace_root FROM recents ORDER BY last_opened_at DESC LIMIT 10')
    .all();
  return rows.map(r => r.workspace_root).filter(p => fs.existsSync(p));
}
