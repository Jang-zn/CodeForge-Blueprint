// ===== Types =====
export type Tab = 'review' | 'backend' | 'frontend' | 'features';
export type IssueStatus = 'pending' | 'reviewing' | 'resolved' | 'deferred' | 'dismissed';
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
  created_at: string;
  updated_at: string;
}

export interface DecisionLog {
  id: number;
  issue_id: string;
  date: string;
  status: string;
  memo: string;
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
}

export interface DocumentRecord {
  id: number;
  tab: Tab;
  version: string;
  kind: string;
  file_path: string;
  source_version: string | null;
  source_job_id: string | null;
  created_at: string;
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

export function bulkUpsertIssues(db: any, issues: Omit<Issue, 'created_at' | 'updated_at'>[]): void {
  const tx = db.transaction(() => {
    for (const issue of issues) upsertIssue(db, issue);
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
    'INSERT INTO decision_logs (issue_id, date, status, memo) VALUES (?, ?, ?, ?)'
  ).run(log.issue_id, log.date, log.status, log.memo);
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

export function updateJob(db: any, id: string, status: JobStatus, error?: string, patch: { result_path?: string | null } = {}): void {
  db.prepare(
    `UPDATE jobs
     SET status = ?, error = ?, result_path = COALESCE(?, result_path), completed_at = datetime('now')
     WHERE id = ?`
  ).run(status, error ?? null, patch.result_path ?? null, id);
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

export function addDocumentRecord(db: any, doc: Omit<DocumentRecord, 'id' | 'created_at'>): void {
  db.prepare(`
    INSERT INTO documents (tab, version, kind, file_path, source_version, source_job_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(doc.tab, doc.version, doc.kind, doc.file_path, doc.source_version ?? null, doc.source_job_id ?? null);
}

export function getDocuments(db: any, tab?: Tab): DocumentRecord[] {
  if (tab) {
    return db.prepare('SELECT * FROM documents WHERE tab = ? ORDER BY id DESC').all(tab);
  }
  return db.prepare('SELECT * FROM documents ORDER BY id DESC').all();
}
