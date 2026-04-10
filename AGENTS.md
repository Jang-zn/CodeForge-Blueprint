# Repository Guidelines

## Project Overview

CodeForge-Blueprint is a local desktop app (Electron + Hono + SQLite) for AI-powered product planning and architecture review. Users open a project folder, write PRD/documents, and trigger AI analysis via Claude or Codex CLI. Results are stored in SQLite and rendered in a dark-themed browser dashboard.

## Project Structure & Module Organization

`src/` contains the application code. Use `src/server/` for the Hono HTTP server and routes, `src/db/` for SQLite schema/migrations/repository, `src/claude/` for AI provider integration and prompt builders, `src/dashboard/` for the vanilla JS SPA (index.html, app.js, styles.css), and `src/electron/` for the Electron main process. Tests live under `tests/` and mirror the source layout. Build output goes to `dist/`. Generated workspace documents are written outside the repo to `{workspace}/.codeforge/`.

## Build, Test, and Development Commands

Run `npm run dev -- ~/projects/my-app` to start the server directly from TypeScript for local development. Run `npm run build` to compile to `dist/` and copy dashboard assets. Run `npm start -- ~/projects/my-app` to execute the built server. Run `npm test` to execute the Node test suite with `tsx/esm`.

## Database Architecture

Two-tier SQLite setup: `app.db` (global: sessions, recents) managed by `initAppDb()`/`closeAppDb()`, and `data.db` (per-workspace: issues, jobs, perspectives, documents, glossary) opened by `openDb()`. `initAppDb()` must be called before `openDb()`. Migrations are sequential `MIGRATION_V{N}_SQL` constants in `src/db/schema.ts` — never modify existing migrations or use `DROP TABLE`.

## Perspectives System

Analysis viewpoints in the `perspectives` table: `is_locked=1` (always active) and `is_locked=0` (user-toggled optional/custom). The `active_perspectives` junction table tracks enabled state per tab. Issue IDs follow `{id_prefix}{N}` format (e.g. `a1`, `be-api3`, `rv-mon1`).

## Coding Style & Naming Conventions

Strict TypeScript with ES modules. 2-space indentation, semicolons. `camelCase` for variables and functions, `PascalCase` for interfaces and types, lowercase hyphenated filenames (`log-extractor.ts`). Keep route handlers thin — persistence logic in `src/db/`, AI logic in `src/claude/`.

## Testing Guidelines

Node built-in `node:test` with `assert/strict`. Files named `*.test.ts` under `tests/`. Use `createTestDb()` from `tests/helpers.ts` for DB tests — includes schema + seed. Bracket tests that change `CODEFORGE_BLUEPRINT_HOME` with `initAppDb()`/`closeAppDb()`. Run `npm test` before opening a PR.

## Commit & Pull Request Guidelines

Conventional Commits with Korean descriptions: e.g. `feat(analyze): 관점 선택 UI 추가`. Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`. PRs include summary, test results, and screenshots for dashboard changes.

## Security & Configuration Tips

Target Node.js 18+. Do not commit workspace `docs/` output, database files (`*.db`), or credentials. When changing provider integration, verify both Claude CLI and Codex CLI paths.
