export const MIGRATION_V2_SQL = `
ALTER TABLE workspace ADD COLUMN provider_model TEXT DEFAULT 'claude:claude-sonnet-4-6';
`;

export const MIGRATION_V3_SQL = `
ALTER TABLE jobs ADD COLUMN log TEXT;
`;

export const MIGRATION_V4_SQL = `
ALTER TABLE workspace ADD COLUMN source_prd_path TEXT;
`;

export const MIGRATION_V5_SQL = `
ALTER TABLE issues ADD COLUMN assignee TEXT;
`;

export const MIGRATION_V6_SQL = `
ALTER TABLE issues ADD COLUMN updated_by TEXT;
`;

export const MIGRATION_V7_SQL = `
ALTER TABLE issues ADD COLUMN applied_at TEXT;
`;

export const MIGRATION_V8_SQL = `
ALTER TABLE issues ADD COLUMN source_run_id TEXT;
`;

export const MIGRATION_V9_SQL = `
ALTER TABLE issues ADD COLUMN confidence REAL;
`;

export const MIGRATION_V10_SQL = `
ALTER TABLE jobs ADD COLUMN tab TEXT;
`;

export const MIGRATION_V11_SQL = `
ALTER TABLE jobs ADD COLUMN session_id TEXT;
`;

export const MIGRATION_V12_SQL = `
ALTER TABLE jobs ADD COLUMN capability TEXT;
`;

export const MIGRATION_V13_SQL = `
ALTER TABLE jobs ADD COLUMN run_key TEXT;
`;

export const MIGRATION_V14_SQL = `
ALTER TABLE jobs ADD COLUMN source_version TEXT;
`;

export const MIGRATION_V15_SQL = `
ALTER TABLE jobs ADD COLUMN workspace_root TEXT;
`;

export const MIGRATION_V16_SQL = `
ALTER TABLE jobs ADD COLUMN cancel_requested_at TEXT;
`;

export const MIGRATION_V17_SQL = `
ALTER TABLE jobs ADD COLUMN superseded_by TEXT;
`;

export const MIGRATION_V18_SQL = `
ALTER TABLE jobs ADD COLUMN result_path TEXT;
`;

export const MIGRATION_V19_SQL = `
ALTER TABLE decision_logs ADD COLUMN old_status TEXT;
`;

export const MIGRATION_V20_SQL = `
ALTER TABLE decision_logs ADD COLUMN tab TEXT;
`;

export const MIGRATION_V21_SQL = `
CREATE TABLE IF NOT EXISTS doc_types (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  template_sections TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
`;

export const MIGRATION_V22_SQL = `
ALTER TABLE documents ADD COLUMN doc_type TEXT;
`;

export const MIGRATION_V23_SQL = `
ALTER TABLE documents ADD COLUMN summary TEXT;
`;

export const MIGRATION_V24_SQL = `
CREATE TABLE IF NOT EXISTS doc_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  section_key TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(document_id, section_key)
);
`;

export const MIGRATION_V25_SQL = `
CREATE TABLE IF NOT EXISTS glossary_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  category TEXT,
  aliases TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V26_SQL = `
ALTER TABLE decision_logs ADD COLUMN reason TEXT;
`;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workspace (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  name TEXT NOT NULL,
  prd_path TEXT,
  source_prd_path TEXT,
  tech_stack_path TEXT,
  provider_model TEXT DEFAULT 'claude:claude-sonnet-4-6',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tab_versions (
  tab TEXT PRIMARY KEY CHECK(tab IN ('review','backend','frontend','features')),
  version TEXT DEFAULT '1.0.0'
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  tab TEXT NOT NULL CHECK(tab IN ('review','backend','frontend','features')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  html_content TEXT NOT NULL,
  tag TEXT,
  priority TEXT,
  badge TEXT,
  status TEXT DEFAULT 'pending',
  memo TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  origin_id TEXT,
  assignee TEXT,
  updated_by TEXT,
  applied_at TEXT,
  source_run_id TEXT,
  confidence REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL REFERENCES issues(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  memo TEXT NOT NULL,
  old_status TEXT,
  tab TEXT,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS changelogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab TEXT NOT NULL,
  version TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  fe_section TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  tab TEXT,
  session_id TEXT,
  capability TEXT,
  run_key TEXT,
  source_version TEXT,
  workspace_root TEXT,
  status TEXT DEFAULT 'running',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT,
  log TEXT,
  cancel_requested_at TEXT,
  superseded_by TEXT,
  result_path TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab TEXT NOT NULL,
  version TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  source_version TEXT,
  source_job_id TEXT,
  doc_type TEXT,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doc_types (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  template_sections TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS doc_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  section_key TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(document_id, section_key)
);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  category TEXT,
  aliases TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`;
