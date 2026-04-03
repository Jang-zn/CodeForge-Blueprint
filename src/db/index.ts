import { createRequire } from 'module';
import { SCHEMA_SQL, MIGRATION_V2_SQL } from './schema.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BetterSqlite3 = require('better-sqlite3') as any;

let _db: any = null;

export function openDb(dbPath: string): any {
  if (_db) return _db;
  _db = new BetterSqlite3(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.exec(SCHEMA_SQL);
  try { _db.exec(MIGRATION_V2_SQL); } catch { /* 컬럼 이미 존재 시 무시 */ }
  return _db;
}

export function getDb(): any {
  if (!_db) throw new Error('Database not opened');
  return _db;
}
