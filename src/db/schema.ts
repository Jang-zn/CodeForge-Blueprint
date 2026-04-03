export const MIGRATION_V2_SQL = `
ALTER TABLE workspace ADD COLUMN provider_model TEXT DEFAULT 'claude:claude-sonnet-4-6';
`;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workspace (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  name TEXT NOT NULL,
  prd_path TEXT,
  tech_stack_path TEXT,
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL REFERENCES issues(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  memo TEXT NOT NULL
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
  status TEXT DEFAULT 'running',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT
);
`;
