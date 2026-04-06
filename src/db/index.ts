import { createRequire } from 'module';
import path from 'path';
import {
  SCHEMA_SQL,
  MIGRATION_V2_SQL,
  MIGRATION_V3_SQL,
  MIGRATION_V4_SQL,
  MIGRATION_V5_SQL,
  MIGRATION_V6_SQL,
  MIGRATION_V7_SQL,
  MIGRATION_V8_SQL,
  MIGRATION_V9_SQL,
  MIGRATION_V10_SQL,
  MIGRATION_V11_SQL,
  MIGRATION_V12_SQL,
  MIGRATION_V13_SQL,
  MIGRATION_V14_SQL,
  MIGRATION_V15_SQL,
  MIGRATION_V16_SQL,
  MIGRATION_V17_SQL,
  MIGRATION_V18_SQL,
  MIGRATION_V19_SQL,
  MIGRATION_V20_SQL,
} from './schema.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BetterSqlite3 = require('better-sqlite3') as any;

const _dbs = new Map<string, any>();
let _activeDbPath: string | null = null;

function normalizeDbPath(dbPath: string): string {
  return path.resolve(dbPath);
}

export function openDb(dbPath: string): any {
  const normalizedPath = normalizeDbPath(dbPath);
  const existing = _dbs.get(normalizedPath);
  if (existing) {
    _activeDbPath = normalizedPath;
    return existing;
  }

  const db = new BetterSqlite3(normalizedPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  try { db.exec(MIGRATION_V2_SQL); } catch { /* 컬럼 이미 존재 시 무시 */ }
  try { db.exec(MIGRATION_V3_SQL); } catch { /* 컬럼 이미 존재 시 무시 */ }
  try { db.exec(MIGRATION_V4_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V5_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V6_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V7_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V8_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V9_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V10_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V11_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V12_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V13_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V14_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V15_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V16_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V17_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V18_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V19_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V20_SQL); } catch { /* ignore */ }

  _dbs.set(normalizedPath, db);
  _activeDbPath = normalizedPath;
  return db;
}

export function getDb(): any {
  if (!_activeDbPath) throw new Error('Database not opened');
  const db = _dbs.get(_activeDbPath);
  if (!db) throw new Error('Database not opened');
  return db;
}

export function resetDb(): void {
  _activeDbPath = null;
}

export function closeAllDbs(): void {
  for (const db of _dbs.values()) {
    try { db.close(); } catch { /* ignore */ }
  }
  _dbs.clear();
  _activeDbPath = null;
}
