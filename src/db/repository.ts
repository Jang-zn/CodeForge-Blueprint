// ===== Types =====
import type { UsageTotals } from '../claude/spawner.js';

export type Tab = 'review' | 'ux' | 'backend' | 'frontend' | 'features';
export type IssueStatus = 'pending' | 'reviewing' | 'resolved' | 'deferred' | 'dismissed' | 'candidate' | 'promoted' | 'archived';
export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'superseded';

export interface WorkspaceMeta {
  id: number;
  name: string;
  prd_path: string | null;
  source_prd_path: string | null;
  tech_stack_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  tab: Tab;
  category: string;
  title: string;
  html_content: string;
  tag: string | null;
  priority: string | null;
  badge: string | null;
  status: IssueStatus;
  memo: string;
  sort_order: number;
  origin_id: string | null;
  assignee: string | null;
  updated_by: string | null;
  applied_at: string | null;
  source_run_id: string | null;
  confidence: number | null;
  decision_at: string | null;
  decision_quality: string | null;
  created_at: string;
  updated_at: string;
}

export interface DecisionLog {
  id: number;
  issue_id: string;
  date: string;
  status: string;
  memo: string;
  old_status: string | null;
  tab: string | null;
  reason: string | null;
  cycle_id: number | null;
}

export interface IssueSnapshot {
  id: number;
  issue_id: string;
  title: string;
  html_content: string;
  category: string | null;
  tag: string | null;
  priority: string | null;
  status: string | null;
  memo: string | null;
  source_run_id: string | null;
  confidence: number | null;
  snapshot_at: string;
}

export interface Job {
  id: string;
  type: string;
  tab: string | null;
  session_id: string | null;
  capability: string | null;
  run_key: string | null;
  source_version: string | null;
  workspace_root: string | null;
  status: JobStatus;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  log: string | null;
  cancel_requested_at: string | null;
  superseded_by: string | null;
  result_path: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_tokens: number | null;
  cache_read_tokens: number | null;
}

export interface DocumentRecord {
  id: number;
  tab: Tab;
  version: string;
  kind: string;
  file_path: string;
  source_version: string | null;
  source_job_id: string | null;
  doc_type: string | null;
  summary: string | null;
  created_at: string;
  source_cycle_id: number | null;
}

export interface DocType {
  slug: string;
  label: string;
  template_sections: string; // JSON string of TemplateSectionDef[]
  sort_order: number;
}

export interface TemplateSectionDef {
  key: string;
  title: string;
  hint: string;
  required: boolean;
}

export interface DocSection {
  id: number;
  document_id: number;
  section_key: string;
  content: string;
  sort_order: number;
  updated_at: string;
}

export interface GlossaryTerm {
  id: number;
  term: string;
  definition: string;
  category: string | null;
  aliases: string | null;
  created_at: string;
  updated_at: string;
}

export interface Perspective {
  id: string;
  tab: string;
  name: string;
  description: string;
  category: string;
  is_locked: number;
  prompt_instruction: string;
  skill_checklist: string | null;
  id_prefix: string;
  sort_order: number;
}

export interface ProjectMeta {
  id: number;
  start_path: string | null;
  project_type: string | null;
  launch_purpose: string | null;
  tech_nature: string | null;
  current_stage: string | null;
  created_at: string;
  updated_at: string;
}

// ===== Workspace =====

export function getWorkspaceMeta(db: any): WorkspaceMeta | null {
  return db.prepare('SELECT * FROM workspace WHERE id = 1').get() ?? null;
}

export function upsertWorkspaceMeta(db: any, data: Partial<WorkspaceMeta>): void {
  const existing = getWorkspaceMeta(db);
  if (existing) {
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (key === 'id' || key === 'created_at') continue;
      fields.push(`${key} = ?`);
      values.push(val);
    }
    fields.push("updated_at = datetime('now')");
    if (fields.length === 0) return;
    db.prepare(`UPDATE workspace SET ${fields.join(', ')} WHERE id = 1`).run(...values);
  } else {
    db.prepare(
      `INSERT INTO workspace (id, name, prd_path, source_prd_path, tech_stack_path)
       VALUES (1, ?, ?, ?, ?)`
    ).run(
      data.name ?? 'Untitled',
      data.prd_path ?? null,
      data.source_prd_path ?? null,
      data.tech_stack_path ?? null,
    );
  }
}

// ===== Provider Model =====

export type ProviderType = 'claude' | 'codex';

export interface ProviderModel {
  provider: ProviderType;
  model: string;
}

const DEFAULT_PROVIDER: ProviderModel = { provider: 'claude', model: 'claude-sonnet-4-6' };

export function getProviderModel(db: any): ProviderModel {
  const row = db.prepare('SELECT provider_model FROM workspace WHERE id = 1').get() as { provider_model: string | null } | undefined;
  const raw = row?.provider_model;
  if (!raw) return DEFAULT_PROVIDER;
  const [provider, ...rest] = raw.split(':');
  const model = rest.join(':');
  if ((provider === 'claude' || provider === 'codex') && model) {
    return { provider, model };
  }
  return DEFAULT_PROVIDER;
}

export function setProviderModel(db: any, provider: ProviderType, model: string): void {
  db.prepare(`
    INSERT INTO workspace (id, name, provider_model) VALUES (1, 'Untitled', ?)
    ON CONFLICT(id) DO UPDATE SET provider_model = excluded.provider_model, updated_at = datetime('now')
  `).run(`${provider}:${model}`);
}

// ===== Issues =====

export function getIssues(db: any, tab?: Tab): Issue[] {
  if (tab) {
    return db.prepare('SELECT * FROM issues WHERE tab = ? ORDER BY sort_order ASC').all(tab);
  }
  return db.prepare('SELECT * FROM issues ORDER BY sort_order ASC').all();
}

export function getIssuesWithDrafts(db: any, tab?: Tab): (Issue & { draft_status?: string; draft_memo?: string })[] {
  const where = tab ? 'WHERE i.tab = ?' : '';
  const args = tab ? [tab] : [];
  return db.prepare(`
    SELECT i.*, ip.preview_status as draft_status, ip.preview_memo as draft_memo
    FROM issues i
    LEFT JOIN issue_preview ip ON i.id = ip.issue_id
    ${where}
    ORDER BY i.sort_order ASC
  `).all(...args);
}

export function hasPendingDrafts(db: any, tab: Tab): boolean {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM issue_preview ip
    WHERE ip.issue_id IN (SELECT id FROM issues WHERE tab = ?)
  `).get(tab) as { cnt: number };
  return row.cnt > 0;
}

export function getIssue(db: any, id: string): Issue | null {
  return db.prepare('SELECT * FROM issues WHERE id = ?').get(id) ?? null;
}

export function upsertIssue(db: any, issue: Omit<Issue, 'created_at' | 'updated_at'>): void {
  db.prepare(`
    INSERT INTO issues (
      id, tab, category, title, html_content, tag, priority, badge, status, memo, sort_order, origin_id,
      assignee, updated_by, applied_at, source_run_id, confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      tab = excluded.tab,
      category = excluded.category,
      title = excluded.title,
      html_content = excluded.html_content,
      tag = excluded.tag,
      priority = excluded.priority,
      badge = excluded.badge,
      status = excluded.status,
      memo = excluded.memo,
      sort_order = excluded.sort_order,
      origin_id = excluded.origin_id,
      assignee = excluded.assignee,
      updated_by = excluded.updated_by,
      applied_at = excluded.applied_at,
      source_run_id = excluded.source_run_id,
      confidence = excluded.confidence,
      updated_at = datetime('now')
  `).run(
    issue.id, issue.tab, issue.category, issue.title, issue.html_content,
    issue.tag, issue.priority, issue.badge, issue.status, issue.memo,
    issue.sort_order, issue.origin_id, issue.assignee, issue.updated_by,
    issue.applied_at, issue.source_run_id, issue.confidence
  );
}

export function updateIssueStatus(
  db: any,
  id: string,
  status: IssueStatus,
  memo: string,
  patch: { updated_by?: string | null; applied_at?: string | null } = {},
): void {
  db.prepare(
    `UPDATE issues
     SET status = ?, memo = ?, updated_by = COALESCE(?, updated_by), applied_at = COALESCE(?, applied_at), updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, memo, patch.updated_by ?? null, patch.applied_at ?? null, id);
}

export function deleteIssue(db: any, id: string): void {
  db.prepare('DELETE FROM issues WHERE id = ?').run(id);
}

export function snapshotIssueIfExists(db: any, issueId: string): void {
  db.prepare(`
    INSERT INTO issue_snapshots (issue_id, title, html_content, category, tag, priority, status, memo, source_run_id, confidence)
    SELECT i.id, i.title, i.html_content, i.category, i.tag, i.priority, i.status,
      CASE WHEN i.status != 'pending' THEN COALESCE(dl.memo, i.memo) ELSE i.memo END,
      i.source_run_id, i.confidence
    FROM issues i
    LEFT JOIN (
      SELECT issue_id, memo FROM decision_logs
      WHERE id IN (SELECT MAX(id) FROM decision_logs WHERE issue_id = ? GROUP BY issue_id)
    ) dl ON dl.issue_id = i.id
    WHERE i.id = ?
  `).run(issueId, issueId);
}

export function getIssueSnapshots(db: any, issueId: string): IssueSnapshot[] {
  return db.prepare(
    'SELECT * FROM issue_snapshots WHERE issue_id = ? ORDER BY snapshot_at DESC'
  ).all(issueId);
}

export function bulkUpsertIssues(db: any, issues: Omit<Issue, 'created_at' | 'updated_at'>[]): void {
  const tx = db.transaction(() => {
    for (const issue of issues) {
      snapshotIssueIfExists(db, issue.id);
      upsertIssue(db, issue);
    }
  });
  tx();
}

// ===== Tab Versions =====

export function getTabVersion(db: any, tab: Tab): string {
  const row = db.prepare('SELECT version FROM tab_versions WHERE tab = ?').get(tab);
  return row?.version ?? '1.0.0';
}

export function setTabVersion(db: any, tab: Tab, version: string): void {
  db.prepare(`
    INSERT INTO tab_versions (tab, version) VALUES (?, ?)
    ON CONFLICT(tab) DO UPDATE SET version = excluded.version
  `).run(tab, version);
}

// ===== Decision Logs =====

export function addDecisionLog(db: any, log: Omit<DecisionLog, 'id'>): void {
  db.prepare(
    'INSERT INTO decision_logs (issue_id, date, status, memo, old_status, tab, reason, cycle_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(log.issue_id, log.date, log.status, log.memo, log.old_status ?? null, log.tab ?? null, log.reason ?? null, log.cycle_id ?? null);
}

export function getDecisionLogs(db: any, issue_id: string): DecisionLog[] {
  return db.prepare('SELECT * FROM decision_logs WHERE issue_id = ?').all(issue_id);
}

export function getDecisionLogsBulk(db: any, issueIds: string[]): Record<string, DecisionLog[]> {
  if (issueIds.length === 0) return {};
  const placeholders = issueIds.map(() => '?').join(',');
  const logs = db.prepare(
    `SELECT * FROM decision_logs WHERE issue_id IN (${placeholders}) ORDER BY id ASC`
  ).all(...issueIds) as DecisionLog[];
  const result: Record<string, DecisionLog[]> = {};
  for (const log of logs) {
    if (!result[log.issue_id]) result[log.issue_id] = [];
    result[log.issue_id].push(log);
  }
  return result;
}

// ===== Timeline (Snapshots + Decision Logs merged) =====

export interface TimelineEntry {
  type: 'snapshot' | 'decision';
  date: string;
  seq: number;  // 동일 날짜 내 정렬용 (snapshot: id, decision: id)
  issue_id: string;
  title?: string;
  html_content?: string;
  category?: string | null;
  tag?: string | null;
  priority?: string | null;
  status?: string | null;
  memo?: string | null;
  old_status?: string | null;
  reason?: string | null;
  confidence?: number | null;
  source_run_id?: string | null;
}

export function getIssueTimeline(db: any, issueId: string): TimelineEntry[] {
  const snapshots: IssueSnapshot[] = db.prepare(
    'SELECT * FROM issue_snapshots WHERE issue_id = ? ORDER BY snapshot_at DESC'
  ).all(issueId);

  const logs: DecisionLog[] = db.prepare(
    'SELECT * FROM decision_logs WHERE issue_id = ? ORDER BY id DESC'
  ).all(issueId);

  const entries: TimelineEntry[] = [];

  for (const s of snapshots) {
    entries.push({
      type: 'snapshot',
      date: s.snapshot_at,
      seq: s.id,
      issue_id: s.issue_id,
      title: s.title,
      html_content: s.html_content,
      category: s.category,
      tag: s.tag,
      priority: s.priority,
      status: s.status,
      memo: s.memo,
      confidence: s.confidence,
      source_run_id: s.source_run_id,
    });
  }

  for (const l of logs) {
    entries.push({
      type: 'decision',
      date: l.date,
      seq: l.id,
      issue_id: l.issue_id,
      status: l.status,
      memo: l.memo,
      old_status: l.old_status,
      reason: l.reason,
    });
  }

  entries.sort((a, b) => b.date > a.date ? 1 : b.date < a.date ? -1 : b.seq - a.seq);

  return entries;
}

export function getLastDecisionLogsBulk(db: any, issueIds: string[]): Record<string, DecisionLog> {
  if (issueIds.length === 0) return {};
  const placeholders = issueIds.map(() => '?').join(',');
  const logs = db.prepare(`
    SELECT * FROM decision_logs
    WHERE id IN (
      SELECT MAX(id) FROM decision_logs WHERE issue_id IN (${placeholders}) GROUP BY issue_id
    )
  `).all(...issueIds) as DecisionLog[];
  return Object.fromEntries(logs.map(log => [log.issue_id, log]));
}

// ===== Applied Decisions =====

export interface AppliedDecision {
  issueId: string;
  title: string;
  status: IssueStatus;
  memo: string;
}

/** 사용자 피드백이 반영된 이슈 목록 (pending 제외) */
export function getAppliedDecisions(db: any, tab?: Tab): AppliedDecision[] {
  const issues = getIssues(db, tab);
  const nonPending = issues.filter(i => i.status !== 'pending');
  if (nonPending.length === 0) return [];

  const lastLogs = getLastDecisionLogsBulk(db, nonPending.map(i => i.id));
  return nonPending
    .map(i => {
      const log = lastLogs[i.id];
      const memo = (log?.status === i.status ? log?.memo?.trim() : null) || i.memo?.trim() || '';
      if (!memo && i.status !== 'dismissed') return null;
      return {
        issueId: i.id,
        title: i.title,
        status: i.status as IssueStatus,
        memo: memo || `상태: ${i.status}`,
      };
    })
    .filter((f): f is AppliedDecision => f !== null);
}

// ===== Changelogs =====

export function addChangelog(db: any, entry: { tab: string; version: string; date: string; description: string }): void {
  db.prepare(
    'INSERT INTO changelogs (tab, version, date, description) VALUES (?, ?, ?, ?)'
  ).run(entry.tab, entry.version, entry.date, entry.description);
}

export function getChangelogs(db: any, tab?: string): { id: number; tab: string; version: string; date: string; description: string }[] {
  if (tab) {
    return db.prepare('SELECT * FROM changelogs WHERE tab = ? ORDER BY id DESC').all(tab);
  }
  return db.prepare('SELECT * FROM changelogs ORDER BY id DESC').all();
}

// ===== Ref Items =====

export function getRefItems(db: any): { id: number; content: string; fe_section: string | null }[] {
  return db.prepare('SELECT * FROM ref_items').all();
}

export function bulkSetRefItems(db: any, items: { content: string; fe_section?: string }[]): void {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM ref_items').run();
    const stmt = db.prepare('INSERT INTO ref_items (content, fe_section) VALUES (?, ?)');
    for (const item of items) stmt.run(item.content, item.fe_section ?? null);
  });
  tx();
}

// ===== Jobs =====

export function createJob(
  db: any,
  id: string,
  type: string,
  meta: {
    tab?: string | null;
    session_id?: string | null;
    capability?: string | null;
    run_key?: string | null;
    source_version?: string | null;
    workspace_root?: string | null;
  } = {},
): void {
  db.prepare(`
    INSERT INTO jobs (id, type, tab, session_id, capability, run_key, source_version, workspace_root)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    type,
    meta.tab ?? null,
    meta.session_id ?? null,
    meta.capability ?? null,
    meta.run_key ?? null,
    meta.source_version ?? null,
    meta.workspace_root ?? null,
  );
}

export function updateJob(db: any, id: string, status: JobStatus, error?: string, patch: { result_path?: string | null; usage?: UsageTotals } = {}): void {
  db.prepare(
    `UPDATE jobs
     SET status = ?, error = ?,
         result_path = COALESCE(?, result_path),
         input_tokens = COALESCE(?, input_tokens),
         output_tokens = COALESCE(?, output_tokens),
         cache_creation_tokens = COALESCE(?, cache_creation_tokens),
         cache_read_tokens = COALESCE(?, cache_read_tokens),
         completed_at = datetime('now')
     WHERE id = ?`
  ).run(
    status,
    error ?? null,
    patch.result_path ?? null,
    patch.usage?.inputTokens ?? null,
    patch.usage?.outputTokens ?? null,
    patch.usage?.cacheCreationTokens ?? null,
    patch.usage?.cacheReadTokens ?? null,
    id,
  );
}

export function appendJobLog(db: any, id: string, text: string): void {
  db.prepare(`
    UPDATE jobs
    SET log = substr(COALESCE(log, '') || ?, 1, 65536)
    WHERE id = ? AND status = 'running'
  `).run(text, id);
}

export function getJob(db: any, id: string): Job | null {
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) ?? null;
}

export function markSupersededJobs(db: any, params: { session_id: string; type: string; tab?: string | null; run_key?: string | null }, supersededBy: string): number {
  const result = db.prepare(`
    UPDATE jobs
    SET status = 'superseded', superseded_by = ?, completed_at = datetime('now')
    WHERE session_id = ? AND type = ? AND status = 'running'
      AND (? IS NULL OR tab = ?)
      AND (? IS NULL OR run_key = ?)
  `).run(
    supersededBy,
    params.session_id,
    params.type,
    params.tab ?? null,
    params.tab ?? null,
    params.run_key ?? null,
    params.run_key ?? null,
  );
  return result.changes as number;
}

export function cancelJob(db: any, id: string): void {
  db.prepare(`
    UPDATE jobs
    SET status = 'cancelled', cancel_requested_at = datetime('now'), completed_at = datetime('now')
    WHERE id = ? AND status = 'running'
  `).run(id);
}

export function isJobRunnable(db: any, id: string): boolean {
  const row = db.prepare('SELECT status FROM jobs WHERE id = ?').get(id) as { status?: JobStatus } | undefined;
  return row?.status === 'running';
}

export function getRunningJobs(db: any): Job[] {
  return db.prepare(`SELECT * FROM jobs WHERE status = 'running' ORDER BY started_at DESC`).all();
}

// ===== Documents =====

export function addDocumentRecord(
  db: any,
  doc: Omit<DocumentRecord, 'id' | 'created_at' | 'doc_type' | 'summary' | 'source_cycle_id'> & { doc_type?: string | null; summary?: string | null; source_cycle_id?: number | null },
): number {
  const result = db.prepare(`
    INSERT INTO documents (tab, version, kind, file_path, source_version, source_job_id, doc_type, summary, source_cycle_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(doc.tab, doc.version, doc.kind, doc.file_path, doc.source_version ?? null, doc.source_job_id ?? null, doc.doc_type ?? null, doc.summary ?? null, doc.source_cycle_id ?? null);
  return Number(result.lastInsertRowid);
}

export function getDocuments(db: any, tab?: Tab): DocumentRecord[] {
  if (tab) {
    return db.prepare('SELECT * FROM documents WHERE tab = ? ORDER BY id DESC').all(tab);
  }
  return db.prepare('SELECT * FROM documents ORDER BY id DESC').all();
}

export function getDocument(db: any, id: number): DocumentRecord | null {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) ?? null;
}

// ===== Workflow Snapshot Helpers =====

export function getLastApplyAtByTab(db: any): Record<string, string | null> {
  const rows: { tab: string; last_at: string }[] = db.prepare(`
    SELECT tab, MAX(completed_at) as last_at
    FROM jobs
    WHERE type LIKE 'apply-%' AND status = 'completed' AND tab IS NOT NULL
    GROUP BY tab
  `).all();
  const result: Record<string, string | null> = { review: null, backend: null, frontend: null, features: null };
  for (const row of rows) {
    result[row.tab] = row.last_at;
  }
  return result;
}

export function getDirtyCountByTab(db: any, tab: string, lastApplyAt: string | null): number {
  if (lastApplyAt === null) {
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM issues WHERE tab = ? AND status != 'pending'
    `).get(tab) as { cnt: number };
    return row.cnt;
  }
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM issues WHERE tab = ? AND status != 'pending' AND updated_at > ?
  `).get(tab, lastApplyAt) as { cnt: number };
  return row.cnt;
}

export function getLastCompletedJobAtByPrefix(db: any, typePrefix: string): Record<string, string | null> {
  const rows: { tab: string; last_at: string }[] = db.prepare(`
    SELECT tab, MAX(completed_at) as last_at
    FROM jobs
    WHERE type LIKE ? AND status = 'completed' AND tab IS NOT NULL
    GROUP BY tab
  `).all(typePrefix + '%');
  const result: Record<string, string | null> = { review: null, backend: null, frontend: null, features: null };
  for (const row of rows) {
    result[row.tab] = row.last_at;
  }
  return result;
}

// ===== Decision Timeline =====

export const DEFERRED_REMINDER_DAYS = 3;

export interface TimelineDecision {
  id: number;
  issue_id: string;
  issue_title: string;
  tab: string;
  date: string;
  old_status: string | null;
  status: string;
  memo: string;
}

export function getDecisionTimeline(
  db: any,
  filters: { tab?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }
): { decisions: TimelineDecision[]; total: number } {
  const { tab, status, from, to, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (tab) { conditions.push('COALESCE(dl.tab, i.tab) = ?'); params.push(tab); }
  if (status) { conditions.push('dl.status = ?'); params.push(status); }
  if (from) { conditions.push('dl.date >= ?'); params.push(from); }
  if (to) { conditions.push('dl.date <= ?'); params.push(to); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const decisions = db.prepare(`
    SELECT dl.id, dl.issue_id, i.title as issue_title,
           COALESCE(dl.tab, i.tab) as tab,
           dl.date, dl.old_status, dl.status, dl.memo
    FROM decision_logs dl
    JOIN issues i ON dl.issue_id = i.id
    ${where}
    ORDER BY dl.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as TimelineDecision[];

  const countRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM decision_logs dl
    JOIN issues i ON dl.issue_id = i.id
    ${where}
  `).get(...params) as { cnt: number };

  return { decisions, total: countRow.cnt };
}

export interface DecisionStats {
  total: number;
  resolved: number;
  deferred: number;
  dismissed: number;
  reviewing: number;
  pending: number;
}

export function getDecisionStats(db: any): DecisionStats {
  const rows = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM decision_logs GROUP BY status
  `).all() as { status: string; cnt: number }[];

  const map: Record<string, number> = {};
  for (const row of rows) map[row.status] = row.cnt;

  return {
    total: rows.reduce((s, r) => s + r.cnt, 0),
    resolved: map['resolved'] ?? 0,
    deferred: map['deferred'] ?? 0,
    dismissed: map['dismissed'] ?? 0,
    reviewing: map['reviewing'] ?? 0,
    pending: map['pending'] ?? 0,
  };
}

export interface DeferredReminder {
  issue_id: string;
  title: string;
  tab: string;
  deferred_at: string;
}

export function getDeferredReminders(db: any, daysThreshold = DEFERRED_REMINDER_DAYS): DeferredReminder[] {
  return db.prepare(`
    SELECT id as issue_id, title, tab, updated_at as deferred_at
    FROM issues
    WHERE status = 'deferred'
      AND updated_at <= datetime('now', ? || ' days')
    ORDER BY updated_at ASC
  `).all(`-${daysThreshold}`) as DeferredReminder[];
}

// ===== Doc Types =====

export function getDocTypes(db: any): DocType[] {
  return db.prepare('SELECT * FROM doc_types ORDER BY sort_order').all() as DocType[];
}

export function getDocType(db: any, slug: string): DocType | null {
  return db.prepare('SELECT * FROM doc_types WHERE slug = ?').get(slug) ?? null;
}

// ===== Typed Documents =====

export function getDocByType(db: any, docType: string): DocumentRecord | null {
  return db.prepare(
    'SELECT * FROM documents WHERE doc_type = ? ORDER BY id DESC LIMIT 1'
  ).get(docType) ?? null;
}

export function createTypedDocument(db: any, docType: string, filePath: string): number {
  const typeDef = getDocType(db, docType);
  const result = db.prepare(
    `INSERT INTO documents (tab, version, kind, file_path, doc_type) VALUES ('docs', '1.0.0', 'typed-doc', ?, ?)`
  ).run(filePath, docType);
  const docId = result.lastInsertRowid as number;

  // 빈 섹션 생성
  if (typeDef) {
    const sections: TemplateSectionDef[] = JSON.parse(typeDef.template_sections);
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO doc_sections (document_id, section_key, content, sort_order) VALUES (?, ?, ?, ?)'
    );
    sections.forEach((s, idx) => stmt.run(docId, s.key, '', idx));
  }

  return docId;
}

export function updateDocumentSummary(db: any, documentId: number, summary: string): void {
  db.prepare('UPDATE documents SET summary = ? WHERE id = ?').run(summary, documentId);
}

// ===== Doc Sections =====

export function getDocSections(db: any, documentId: number): DocSection[] {
  return db.prepare(
    'SELECT * FROM doc_sections WHERE document_id = ? ORDER BY sort_order'
  ).all(documentId) as DocSection[];
}

export function upsertDocSection(db: any, documentId: number, sectionKey: string, content: string): void {
  db.prepare(`
    INSERT INTO doc_sections (document_id, section_key, content, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(document_id, section_key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).run(documentId, sectionKey, content);
}

export function assembleMarkdown(db: any, documentId: number): string {
  const doc = getDocument(db, documentId);
  if (!doc?.doc_type) return '';
  const docType = getDocType(db, doc.doc_type);
  if (!docType) return '';
  const sections = getDocSections(db, documentId);
  const defs: TemplateSectionDef[] = JSON.parse(docType.template_sections);
  const lines: string[] = [`# ${docType.label}`, ''];
  for (const def of defs) {
    const sec = sections.find(s => s.section_key === def.key);
    lines.push(`## ${def.title}`);
    lines.push(sec?.content?.trim() || '');
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function parseSectionsFromMarkdown(content: string, templateSections: TemplateSectionDef[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const def of templateSections) {
    const regex = new RegExp(`##\\s+${def.title}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
    const match = content.match(regex);
    if (match) result[def.key] = match[1].trim();
  }
  return result;
}

export function getRecentDecisionLogs(
  db: any,
  statusFilter: string[],
  limit = 20,
): DecisionLog[] {
  if (statusFilter.length === 0) return [];
  const placeholders = statusFilter.map(() => '?').join(',');
  // 이슈당 최신 로그만 선택한 뒤 최근순(id DESC) 정렬
  return db.prepare(`
    SELECT dl.* FROM decision_logs dl
    INNER JOIN (
      SELECT issue_id, MAX(id) as max_id
      FROM decision_logs
      GROUP BY issue_id
    ) latest ON dl.id = latest.max_id
    WHERE dl.status IN (${placeholders})
    ORDER BY dl.id DESC
    LIMIT ?
  `).all(...statusFilter, limit) as DecisionLog[];
}

// ===== Glossary =====

export function getGlossaryTerms(db: any, category?: string): GlossaryTerm[] {
  if (category) {
    return db.prepare('SELECT * FROM glossary_terms WHERE category = ? ORDER BY term').all(category) as GlossaryTerm[];
  }
  return db.prepare('SELECT * FROM glossary_terms ORDER BY term').all() as GlossaryTerm[];
}

type GlossaryInput = Omit<GlossaryTerm, 'id' | 'created_at' | 'updated_at'> | Omit<GlossaryTerm, 'created_at' | 'updated_at'>;

export function upsertGlossaryTerm(db: any, term: GlossaryInput): GlossaryTerm {
  const id = 'id' in term ? term.id : undefined;
  if (id) {
    db.prepare(`
      UPDATE glossary_terms SET term = ?, definition = ?, category = ?, aliases = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(term.term, term.definition, term.category ?? null, term.aliases ?? null, id);
    return db.prepare('SELECT * FROM glossary_terms WHERE id = ?').get(id) as GlossaryTerm;
  }
  const result = db.prepare(
    'INSERT INTO glossary_terms (term, definition, category, aliases) VALUES (?, ?, ?, ?)'
  ).run(term.term, term.definition, term.category ?? null, term.aliases ?? null);
  return db.prepare('SELECT * FROM glossary_terms WHERE id = ?').get(result.lastInsertRowid) as GlossaryTerm;
}

export function deleteGlossaryTerm(db: any, id: number): void {
  db.prepare('DELETE FROM glossary_terms WHERE id = ?').run(id);
}

export function buildGlossaryMarkdown(db: any): string {
  const terms = getGlossaryTerms(db);
  if (terms.length === 0) return '';
  const lines = ['# 용어집', ''];
  const byCategory: Record<string, GlossaryTerm[]> = {};
  for (const t of terms) {
    const cat = t.category || '일반';
    (byCategory[cat] ??= []).push(t);
  }
  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`## ${cat}`, '');
    for (const t of items) {
      const aliases = t.aliases ? ` (별칭: ${t.aliases})` : '';
      lines.push(`**${t.term}**${aliases}: ${t.definition}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

// ===== Perspectives =====

export interface CustomPerspectiveInput {
  tab: string;
  name: string;
  description: string;
  prompt_instruction: string;
  skill_checklist?: string | null;
  id_prefix: string;
}

export function listPerspectives(db: any, tab?: string): Perspective[] {
  if (tab) {
    return db.prepare('SELECT * FROM perspectives WHERE tab = ? ORDER BY sort_order, id').all(tab) as Perspective[];
  }
  return db.prepare('SELECT * FROM perspectives ORDER BY tab, sort_order, id').all() as Perspective[];
}

export function getActivePerspectives(db: any, tab: string): Perspective[] {
  return db.prepare(`
    SELECT p.* FROM perspectives p
    INNER JOIN active_perspectives ap ON ap.perspective_id = p.id AND ap.tab = p.tab
    WHERE p.tab = ?
    ORDER BY p.sort_order, p.id
  `).all(tab) as Perspective[];
}

export function getPerspective(db: any, id: string): Perspective | null {
  return db.prepare('SELECT * FROM perspectives WHERE id = ?').get(id) ?? null;
}

export function addCustomPerspective(db: any, input: CustomPerspectiveInput): Perspective {
  const id = `custom-${input.tab}-${Date.now()}`;
  db.prepare(`
    INSERT INTO perspectives (id, tab, name, description, category, is_locked, prompt_instruction, skill_checklist, id_prefix, sort_order)
    VALUES (?, ?, ?, ?, 'custom', 0, ?, ?, ?, 100)
  `).run(id, input.tab, input.name, input.description, input.prompt_instruction, input.skill_checklist ?? null, input.id_prefix);
  return db.prepare('SELECT * FROM perspectives WHERE id = ?').get(id) as Perspective;
}

export function updateCustomPerspective(db: any, id: string, input: Partial<CustomPerspectiveInput>): Perspective {
  const current = getPerspective(db, id);
  if (!current) throw new Error(`Perspective ${id} not found`);
  if (current.is_locked === 1) throw new Error(`Perspective ${id} is locked and cannot be modified`);

  const updates: string[] = [];
  const values: unknown[] = [];
  if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
  if (input.description !== undefined) { updates.push('description = ?'); values.push(input.description); }
  if (input.prompt_instruction !== undefined) { updates.push('prompt_instruction = ?'); values.push(input.prompt_instruction); }
  if ('skill_checklist' in input) { updates.push('skill_checklist = ?'); values.push(input.skill_checklist ?? null); }
  if (input.id_prefix !== undefined) { updates.push('id_prefix = ?'); values.push(input.id_prefix); }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE perspectives SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  return db.prepare('SELECT * FROM perspectives WHERE id = ?').get(id) as Perspective;
}

export function deleteCustomPerspective(db: any, id: string): void {
  const current = getPerspective(db, id);
  if (!current) return;
  if (current.is_locked === 1) throw new Error(`Perspective ${id} is locked and cannot be deleted`);
  db.prepare('DELETE FROM active_perspectives WHERE perspective_id = ?').run(id);
  db.prepare('DELETE FROM perspectives WHERE id = ?').run(id);
}

export function toggleActivePerspective(db: any, perspectiveId: string, active: boolean): void {
  const p = getPerspective(db, perspectiveId);
  if (!p) throw new Error(`Perspective ${perspectiveId} not found`);
  if (active) {
    db.prepare('INSERT OR IGNORE INTO active_perspectives (perspective_id, tab) VALUES (?, ?)').run(perspectiveId, p.tab);
  } else {
    if (p.is_locked === 1) throw new Error(`Default perspective ${perspectiveId} cannot be deactivated`);
    db.prepare('DELETE FROM active_perspectives WHERE perspective_id = ? AND tab = ?').run(perspectiveId, p.tab);
  }
}

// ===== Project Meta =====

export function getProjectMeta(db: any): ProjectMeta | null {
  return db.prepare('SELECT * FROM project_meta WHERE id = 1').get() ?? null;
}

export function upsertProjectMeta(db: any, data: Partial<Omit<ProjectMeta, 'id' | 'created_at' | 'updated_at'>>): void {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return;
  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => data[f] ?? null);
  db.prepare(`
    INSERT INTO project_meta (id, ${fields.join(', ')}, updated_at)
    VALUES (1, ${fields.map(() => '?').join(', ')}, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET ${setClauses}, updated_at = datetime('now')
  `).run(...values, ...values);
}

// ===== Review Completion Metrics =====

export interface ReviewMetrics {
  totalIssues: number;
  decidedIssues: number;
  resolvePct: number;
  deferPct: number;
  dismissPct: number;
  completionPct: number;
}

export function getReviewMetrics(db: any, tab: Tab): ReviewMetrics {
  const issues = getIssues(db, tab);
  const total = issues.length;

  if (total === 0) {
    return {
      totalIssues: 0,
      decidedIssues: 0,
      resolvePct: 0,
      deferPct: 0,
      dismissPct: 0,
      completionPct: 0,
    };
  }

  const resolved = issues.filter(i => i.status === 'resolved').length;
  const deferred = issues.filter(i => i.status === 'deferred').length;
  const dismissed = issues.filter(i => i.status === 'dismissed').length;
  const decided = resolved + deferred + dismissed;

  return {
    totalIssues: total,
    decidedIssues: decided,
    resolvePct: Math.round((resolved / total) * 100),
    deferPct: Math.round((deferred / total) * 100),
    dismissPct: Math.round((dismissed / total) * 100),
    completionPct: Math.round((decided / total) * 100),
  };
}

// ===== Issue Preview =====

export interface IssuePreview {
  id: number;
  issue_id: string;
  preview_status: IssueStatus;
  preview_memo: string;
  created_at: string;
}

export function createIssuePreview(db: any, issueId: string, status: IssueStatus, memo: string = ''): IssuePreview {
  const result = db.prepare(`
    INSERT OR REPLACE INTO issue_preview (issue_id, preview_status, preview_memo)
    VALUES (?, ?, ?)
  `).run(issueId, status, memo);

  const preview = db.prepare('SELECT * FROM issue_preview WHERE issue_id = ?').get(issueId);
  return preview as IssuePreview;
}

export function getIssuePreview(db: any, issueId: string): IssuePreview | null {
  return db.prepare('SELECT * FROM issue_preview WHERE issue_id = ?').get(issueId) ?? null;
}

export function getAllIssuePreviews(db: any, tab: Tab): IssuePreview[] {
  const issueIds = getIssues(db, tab).map(i => i.id);
  if (issueIds.length === 0) return [];

  const placeholders = issueIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM issue_preview WHERE issue_id IN (${placeholders})`).all(...issueIds) as IssuePreview[];
}

export function deleteIssuePreview(db: any, issueId: string): void {
  db.prepare('DELETE FROM issue_preview WHERE issue_id = ?').run(issueId);
}

export function clearAllPreviewsForTab(db: any, tab: Tab): void {
  const issueIds = getIssues(db, tab).map(i => i.id);
  if (issueIds.length === 0) return;

  const placeholders = issueIds.map(() => '?').join(',');
  db.prepare(`DELETE FROM issue_preview WHERE issue_id IN (${placeholders})`).run(...issueIds);
}

// ===== Review Cycles =====

export type CycleStatus = 'pending' | 'analyzing' | 'applied' | 'completed' | 'failed';

export interface ReviewCycle {
  id: number;
  tab: string;
  cycle_number: number;
  base_doc_id: number | null;
  result_doc_id: number | null;
  status: CycleStatus;
  started_at: string;
  completed_at: string | null;
}

/** 현재 탭의 미완료 사이클 조회 (apply/generate에서 사용) */
export function getCurrentCycle(db: any, tab: Tab): ReviewCycle | null {
  return db.prepare(
    `SELECT * FROM review_cycles WHERE tab = ? AND status IN ('pending','analyzing','applied') ORDER BY id DESC LIMIT 1`
  ).get(tab) ?? null;
}

/** 분석 시작 시 사이클 생성 또는 기존 analyzing 사이클 재사용. applied 사이클은 새 사이클로 롤오버 */
export function createOrResumeCycle(db: any, tab: Tab): ReviewCycle {
  const existing = getCurrentCycle(db, tab);
  if (existing && (existing.status === 'pending' || existing.status === 'analyzing')) {
    if (existing.status === 'pending') {
      db.prepare(`UPDATE review_cycles SET status = 'analyzing' WHERE id = ?`).run(existing.id);
      return { ...existing, status: 'analyzing' as CycleStatus };
    }
    return existing;
  }
  const maxCycle = db.prepare(
    'SELECT COALESCE(MAX(cycle_number), 0) as max_num FROM review_cycles WHERE tab = ?'
  ).get(tab) as { max_num: number };
  const nextNum = maxCycle.max_num + 1;
  const info = db.prepare(
    `INSERT INTO review_cycles (tab, cycle_number, status) VALUES (?, ?, 'analyzing')`
  ).run(tab, nextNum);
  return {
    id: Number(info.lastInsertRowid),
    tab,
    cycle_number: nextNum,
    base_doc_id: null,
    result_doc_id: null,
    status: 'analyzing',
    started_at: new Date().toISOString(),
    completed_at: null,
  };
}

export function updateCycleStatus(db: any, cycleId: number, status: CycleStatus, resultDocId?: number): void {
  db.prepare(
    `UPDATE review_cycles SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END, result_doc_id = COALESCE(?, result_doc_id) WHERE id = ?`
  ).run(status, status, resultDocId ?? null, cycleId);
}

// ===== Baselines =====

export const PIPELINE_REQUIRED_BASELINES: Record<Tab, Tab[]> = {
  review: [],
  ux: ['review'],
  backend: ['review', 'ux'],
  frontend: ['review', 'ux', 'backend'],
  features: ['review', 'ux', 'backend', 'frontend'],
};

export interface StageBaseline {
  id: number;
  tab: Tab;
  version: string;
  doc_snapshot: string | null;
  frozen_at: string;
  superseded_at: string | null;
  superseded_by: number | null;
}

/** 해당 탭의 모든 baseline 조회 */
export function listBaselines(db: any, tab: Tab): StageBaseline[] {
  return db.prepare(`SELECT * FROM stage_baselines WHERE tab = ? ORDER BY frozen_at DESC`).all(tab);
}

/** 전체 baseline 조회 (tab 필터 없음) */
export function getAllBaselines(db: any): StageBaseline[] {
  return db.prepare(`SELECT * FROM stage_baselines ORDER BY tab ASC, frozen_at DESC`).all();
}

/** 해당 탭의 활성(superseded되지 않은) baseline 조회 */
export function getActiveBaseline(db: any, tab: Tab): StageBaseline | null {
  return db.prepare(
    `SELECT * FROM stage_baselines WHERE tab = ? AND superseded_at IS NULL ORDER BY frozen_at DESC LIMIT 1`
  ).get(tab) ?? null;
}

/** 모든 탭의 활성 baseline을 맵으로 반환 */
export function getAllActiveBaselines(db: any): Record<string, StageBaseline | null> {
  const tabs: Tab[] = ['review', 'ux', 'backend', 'frontend', 'features'];
  const result: Record<string, StageBaseline | null> = {};
  for (const tab of tabs) {
    result[tab] = getActiveBaseline(db, tab);
  }
  return result;
}

/** 새 baseline 생성 */
export function createBaseline(
  db: any,
  tab: Tab,
  version: string,
  docSnapshot: string | null = null
): StageBaseline {
  const info = db.prepare(
    `INSERT INTO stage_baselines (tab, version, doc_snapshot) VALUES (?, ?, ?)`
  ).run(tab, version, docSnapshot);

  return {
    id: Number(info.lastInsertRowid),
    tab,
    version,
    doc_snapshot: docSnapshot,
    frozen_at: new Date().toISOString(),
    superseded_at: null,
    superseded_by: null,
  };
}

/** 기존 활성 baseline을 supersede 처리 (oldBaselineId: 교체될 이전 baseline) */
export function supersedeBaseline(db: any, oldBaselineId: number, newBaselineId: number): void {
  db.prepare(
    `UPDATE stage_baselines SET superseded_at = datetime('now'), superseded_by = ? WHERE id = ?`
  ).run(newBaselineId, oldBaselineId);
}

/** freeze 대상 문서 선택 — 항상 최신 generated-doc, cycle 연결 정보는 LEFT JOIN으로 첨부 */
export function getFreezeCandidateDoc(db: any, tab: Tab): any | null {
  // 최신 generated-doc을 기준으로 선택하되, 해당 문서가 cycle과 연결돼 있으면 메타 첨부
  return db.prepare(`
    SELECT d.*, rc.id AS _cycle_id, rc.cycle_number AS _cycle_number
    FROM documents d
    LEFT JOIN review_cycles rc
      ON d.id = rc.result_doc_id AND rc.status IN ('applied', 'completed')
    WHERE d.tab = ? AND d.kind = 'generated-doc'
    ORDER BY d.created_at DESC LIMIT 1
  `).get(tab) ?? null;
}

export interface FreezeReadinessCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface FreezeReadinessResult {
  ready: boolean;
  /** 하위호환 유지 — blockingReasons와 동일 */
  reasons: string[];
  checks: FreezeReadinessCheck[];
  blockingReasons: string[];
  warnings: string[];
}

/** freeze 준비 상태 확인 — prefetchedActiveMap을 넘기면 DB 재조회 없이 재사용 */
export function checkFreezeReadiness(
  db: any,
  tab: Tab,
  prefetchedActiveMap?: Record<Tab, any>,
): FreezeReadinessResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const checks: FreezeReadinessCheck[] = [];

  /** 체크 항목 추가 + blocking이면 blockingReasons에도 기록 */
  function addCheck(name: string, passed: boolean, failMessage: string, blocking = true) {
    checks.push({ name, passed, message: passed ? undefined : failMessage });
    if (!passed && blocking) blockingReasons.push(failMessage);
  }

  // 1) 선행 baseline 체크 (review는 선행 없음)
  if (tab !== 'review') {
    const required = PIPELINE_REQUIRED_BASELINES[tab] || [];
    const activeMap = prefetchedActiveMap ?? getAllActiveBaselines(db);
    const missing = required.filter(t => !activeMap[t]);
    addCheck(
      '선행 baseline',
      missing.length === 0,
      `${missing.join(', ')} 탭의 활성 baseline이 필요합니다.`,
    );
  } else {
    checks.push({ name: '선행 baseline', passed: true });
  }

  // 2) 해당 탭 generated-doc 문서 존재 확인
  const doc = db.prepare(
    `SELECT id FROM documents WHERE tab = ? AND kind = 'generated-doc' ORDER BY created_at DESC LIMIT 1`
  ).get(tab);
  addCheck(
    '생성 문서',
    !!doc,
    `${tab} 탭의 생성된 문서가 없습니다. 먼저 문서를 생성하세요.`,
  );

  // 3) P0 이슈 없음 체크
  const p0Count = (db.prepare(
    `SELECT COUNT(*) as cnt FROM issues WHERE tab = ? AND status = 'pending' AND priority = 'P0'`
  ).get(tab) as { cnt: number } | undefined)?.cnt ?? 0;
  addCheck(
    'P0 이슈',
    p0Count === 0,
    `미해결 P0 이슈가 ${p0Count}건 있습니다. freeze 전에 처리하세요.`,
  );

  // 4) 미완료 cycle — blocking이 아닌 경고
  const activeCycle = db.prepare(
    `SELECT id, cycle_number FROM review_cycles WHERE tab = ? AND status NOT IN ('completed', 'applied') ORDER BY id DESC LIMIT 1`
  ).get(tab);
  if (activeCycle) {
    warnings.push(`진행 중인 리뷰 사이클(#${(activeCycle as { id: number; cycle_number: number }).cycle_number})이 있습니다.`);
  }

  return { ready: blockingReasons.length === 0, reasons: blockingReasons, checks, blockingReasons, warnings };
}

/** baseline doc_snapshot 파싱 유틸 — 구버전(schemaVersion 없음) 호환 */
export function parseBaselineSnapshot(raw: string | null): {
  schemaVersion: string;
  tab?: string;
  document?: any;
  content?: string | null;
  structuredData?: { flows?: any[]; screens?: any[]; scopeItems?: any[] };
  sourceCycle?: { id: number; cycleNumber: number } | null;
} | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: parsed.schemaVersion ?? '0.0.0',
      ...parsed,
    };
  } catch { return null; }
}

// ===== Structured Data =====

export interface DeliveryRun {
  id: number;
  version: string;
  baseline_refs: string | null;
  output: string | null;
  created_at: string;
}

export interface UserFlow {
  id: number;
  tab: Tab;
  flow_id: string;
  title: string;
  actor: string | null;
  steps_json: string | null;
  created_at: string;
}

export interface Screen {
  id: number;
  tab: Tab;
  screen_id: string;
  flow_ids_json: string | null;
  title: string;
  description: string | null;
  complexity: string | null;
  states_json: string | null;
  created_at: string;
}

export interface ScopeItem {
  id: number;
  tab: Tab;
  scope_item_id: string;
  screen_id: string | null;
  title: string;
  complexity: string | null;
  estimate_metadata: string | null;
  created_at: string;
}

/** delivery_run 생성 */
export function createDeliveryRun(
  db: any,
  version: string,
  baselineRefs: Record<string, number>,
  output: string
): DeliveryRun {
  const info = db.prepare(
    `INSERT INTO delivery_runs (version, baseline_refs, output) VALUES (?, ?, ?)`
  ).run(version, JSON.stringify(baselineRefs), output);

  const id = Number(info.lastInsertRowid);
  const run = db.prepare(`SELECT * FROM delivery_runs WHERE id = ?`).get(id);
  return run as DeliveryRun;
}

/** delivery_run 조회 */
export function getDeliveryRun(db: any, id: number): DeliveryRun | null {
  return db.prepare(`SELECT * FROM delivery_runs WHERE id = ?`).get(id) ?? null;
}

/** 모든 delivery_run 조회 */
export function listDeliveryRuns(db: any): DeliveryRun[] {
  return db.prepare(`SELECT * FROM delivery_runs ORDER BY created_at DESC, id DESC`).all();
}

/** user_flows 저장 (해당 탭 기존 flows 삭제 후 재삽입) */
export function saveUserFlows(db: any, tab: Tab, flows: any[]): void {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM user_flows WHERE tab = ?`).run(tab);
    const stmt = db.prepare(
      `INSERT INTO user_flows (tab, flow_id, title, actor, steps_json) VALUES (?, ?, ?, ?, ?)`
    );
    for (const flow of flows) {
      stmt.run(
        tab,
        flow.flow_id,
        flow.title,
        flow.actor ?? null,
        flow.steps_json ? JSON.stringify(flow.steps_json) : null
      );
    }
  });
  tx();
}

/** user_flows 조회 */
export function getUserFlows(db: any, tab: Tab): any[] {
  const rows = db.prepare(`SELECT * FROM user_flows WHERE tab = ? ORDER BY created_at`).all(tab) as UserFlow[];
  return rows.map(row => ({
    ...row,
    steps_json: row.steps_json ? JSON.parse(row.steps_json) : null,
  }));
}

/** screens 저장 (해당 탭 기존 screens 삭제 후 재삽입) */
export function saveScreens(db: any, tab: Tab, screens: any[]): void {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM screens WHERE tab = ?`).run(tab);
    const stmt = db.prepare(
      `INSERT INTO screens (tab, screen_id, flow_ids_json, title, description, complexity, states_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const screen of screens) {
      stmt.run(
        tab,
        screen.screen_id,
        screen.flow_ids_json ? JSON.stringify(screen.flow_ids_json) : null,
        screen.title,
        screen.description ?? null,
        screen.complexity ?? null,
        screen.states_json ? JSON.stringify(screen.states_json) : null
      );
    }
  });
  tx();
}

/** screens 조회 */
export function getScreens(db: any, tab: Tab): any[] {
  const rows = db.prepare(`SELECT * FROM screens WHERE tab = ? ORDER BY created_at`).all(tab) as Screen[];
  return rows.map(row => ({
    ...row,
    flow_ids_json: row.flow_ids_json ? JSON.parse(row.flow_ids_json) : null,
    states_json: row.states_json ? JSON.parse(row.states_json) : null,
  }));
}

/** scope_items 저장 (해당 탭 기존 items 삭제 후 재삽입) */
export function saveScopeItems(db: any, tab: Tab, items: any[]): void {
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM scope_items WHERE tab = ?`).run(tab);
    const stmt = db.prepare(
      `INSERT INTO scope_items (tab, scope_item_id, screen_id, title, complexity, estimate_metadata) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const item of items) {
      stmt.run(
        tab,
        item.scope_item_id,
        item.screen_id ?? null,
        item.title,
        item.complexity ?? null,
        item.estimate_metadata ? JSON.stringify(item.estimate_metadata) : null
      );
    }
  });
  tx();
}

/** scope_items 조회 */
export function getScopeItems(db: any, tab: Tab): any[] {
  const rows = db.prepare(`SELECT * FROM scope_items WHERE tab = ? ORDER BY created_at`).all(tab) as ScopeItem[];
  return rows.map(row => ({
    ...row,
    estimate_metadata: row.estimate_metadata ? JSON.parse(row.estimate_metadata) : null,
  }));
}

/** Final delivery assembly — frozen baseline의 doc_snapshot에서 구조화 데이터 추출 */
export function assembleFinalDelivery(
  db: any,
  prefetchedBaselines?: Record<string, StageBaseline | null>,
): {
  baselines: Record<string, StageBaseline | null>;
  flows: Record<string, any[]>;
  screens: Record<string, any[]>;
  scopeItems: Record<string, any[]>;
} {
  const tabs: Tab[] = ['review', 'ux', 'backend', 'frontend', 'features'];
  const baselines = prefetchedBaselines ?? getAllActiveBaselines(db);

  const flows: Record<string, any[]> = {};
  const screens: Record<string, any[]> = {};
  const scopeItems: Record<string, any[]> = {};

  for (const tab of tabs) {
    const baseline = baselines[tab];
    let sd: any = {};
    if (baseline?.doc_snapshot) {
      try {
        const parsed = JSON.parse(baseline.doc_snapshot);
        sd = parsed.structuredData ?? {};
      } catch { /* snapshot 파싱 실패 시 빈 데이터 */ }
    }
    flows[tab] = sd.flows ?? [];
    screens[tab] = sd.screens ?? [];
    scopeItems[tab] = sd.scopeItems ?? [];
  }

  return { baselines, flows, screens, scopeItems };
}
