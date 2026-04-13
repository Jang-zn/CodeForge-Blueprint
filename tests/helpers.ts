/**
 * 공통 테스트 헬퍼 — 모든 테스트 파일에서 import하여 사용
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { Hono } from 'hono';
import { SCHEMA_SQL, MIGRATION_V2_SQL, MIGRATION_V39_SQL, MIGRATION_V42_SQL, MIGRATION_V43_SQL, seedPerspectives } from '../src/db/schema.js';
import { openDb, resetDb, closeAllDbs, getDb } from '../src/db/index.js';
import { initAppDb, closeAppDb } from '../src/db/app-db.js';
import { openWorkspace, type WorkspaceContext } from '../src/workspace.js';
import { getJob, type Tab, type IssueStatus } from '../src/db/repository.js';
import { getRequestContext } from '../src/server/context.js';

const require = createRequire(import.meta.url);
const BetterSqlite3 = require('better-sqlite3') as any;

// ─── 파일시스템 ──────────────────────────────────────────────────────────────

export function makeTempDir(prefix = 'cfb-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanDir(dir: string): void {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ─── 데이터베이스 ────────────────────────────────────────────────────────────

/** 인메모리 SQLite DB 생성 (스키마 + 마이그레이션 + 시드 적용) */
export function createTestDb(): any {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  try { db.exec(MIGRATION_V2_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V39_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V42_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V43_SQL); } catch { /* ignore */ }
  seedPerspectives(db);
  return db;
}

// ─── 워크스페이스 설정 ────────────────────────────────────────────────────────

export interface TestWorkspace {
  tmpDir: string;
  ws: WorkspaceContext;
  db: any;
  sessionId: string;
  cleanup: () => void;
}

/** 임시 디렉토리에 워크스페이스 + app DB를 셋업하고 cleanup 함수를 반환 */
export function setupTestWorkspace(prefix?: string): TestWorkspace {
  const tmpDir = makeTempDir(prefix);
  process.env.CODEFORGE_BLUEPRINT_HOME = path.join(tmpDir, '.state');
  initAppDb();
  const ws = openWorkspace(tmpDir);
  const db = openDb(ws.dbPath);
  const cleanup = () => {
    resetDb();
    closeAllDbs();
    closeAppDb();
    cleanDir(tmpDir);
  };
  return { tmpDir, ws, db, sessionId: ws.sessionId, cleanup };
}

// ─── 이슈 팩토리 ─────────────────────────────────────────────────────────────

interface IssueOverrides {
  id?: string;
  tab?: Tab;
  category?: string;
  title?: string;
  html_content?: string;
  tag?: string | null;
  priority?: string;
  badge?: string | null;
  status?: IssueStatus;
  memo?: string;
  sort_order?: number;
  origin_id?: string | null;
  assignee?: string | null;
  updated_by?: string | null;
  applied_at?: string | null;
  source_run_id?: string | null;
  confidence?: number | null;
}

export function makeIssue(overrides: IssueOverrides = {}) {
  return {
    id: overrides.id ?? 'test-1',
    tab: overrides.tab ?? 'review' as Tab,
    category: overrides.category ?? 'A',
    title: overrides.title ?? '테스트 이슈',
    html_content: overrides.html_content ?? '<p>내용</p>',
    tag: overrides.tag ?? null,
    priority: overrides.priority ?? 'high',
    badge: overrides.badge ?? null,
    status: overrides.status ?? 'pending' as IssueStatus,
    memo: overrides.memo ?? '',
    sort_order: overrides.sort_order ?? 0,
    origin_id: overrides.origin_id ?? null,
    assignee: overrides.assignee ?? null,
    updated_by: overrides.updated_by ?? null,
    applied_at: overrides.applied_at ?? null,
    source_run_id: overrides.source_run_id ?? null,
    confidence: overrides.confidence ?? null,
  };
}

// ─── 잡 폴링 ─────────────────────────────────────────────────────────────────

export async function waitForJob(db: any, jobId: string, maxIter = 40): Promise<any> {
  for (let i = 0; i < maxIter; i++) {
    const job = getJob(db, jobId);
    if (job?.status === 'completed' || job?.status === 'failed') return job;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`job timeout: ${jobId}`);
}

// ─── Hono 테스트 앱 ──────────────────────────────────────────────────────────

/** 세션 헤더를 포함한 Request 옵션 생성 */
export function withSession(sessionId: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('x-codeforge-session', sessionId);
  return { ...init, headers };
}

/** 라우트 통합 테스트용 JSON POST 요청 헬퍼 */
export function jsonPost(sessionId: string, body: unknown): RequestInit {
  return withSession(sessionId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** 라우트 통합 테스트용 JSON PUT 요청 헬퍼 */
export function jsonPut(sessionId: string, body: unknown): RequestInit {
  return withSession(sessionId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
