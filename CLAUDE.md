# CLAUDE.md

Electron + Hono + SQLite local desktop app for AI-powered product planning.

## Stack
- **Electron** shell → BrowserWindow serves `src/dashboard/`
- **Hono** HTTP server (`src/server/`) — all API routes
- **SQLite** via better-sqlite3: `app.db` (global) + `data.db` (per-workspace)
- **AI**: Claude CLI or Codex CLI spawned as subprocess

## Key paths
- `src/server/routes/` — API handlers
- `src/claude/` — prompt builders + provider spawner
- `src/db/` — schema, migrations, repository
- `src/dashboard/` — vanilla JS SPA (index.html / app.js / styles.css)
- `src/electron/` — Electron main process
- `tests/` — Node test runner; use `createTestDb()` from `tests/helpers.ts`

## Conventions
- Korean UI, prompts, comments
- Issue IDs: `{id_prefix}{N}` (e.g. `a1`, `be-api3`, `rv-mon1`)
- Decision logs: append-only — never mutate original issue body
