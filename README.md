# CodeForge Blueprint

Turn an idea into a structured PRD, backend/frontend architecture, and next-version feature proposals — all in a local browser dashboard powered by Claude Code CLI.

## Requirements

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/claude-code) installed globally

```bash
npm install -g @anthropic-ai/claude-code
```

## Usage

```bash
# Run against a project folder (workspace)
npx codeforge-blueprint ~/projects/my-app

# Use current directory
npx codeforge-blueprint .

# Specify port
npx codeforge-blueprint ~/projects/my-app --port 4000
```

The dashboard opens automatically in your browser. All artifacts are saved under `{workspace}/docs/`.

## Pipeline

```
Init (PRD 생성) → 기획 리뷰 → BE 설계 → FE 설계 → 다음버전 기능 제안 → 문서 생성
```

1. **Init** — Fill in a structured form (service type, target users, revenue model, tech stack, detailed description) → Claude generates a PRD draft
2. **기획 리뷰** — Claude analyzes the PRD across 6 perspectives (planning consistency, revenue, user acquisition, implementation feasibility, operational scalability, legal/compliance). Review issues in the browser, set status/memo
3. **분석하기** — Triggers analysis for the active tab (review/backend/frontend/features)
4. **반영하기** — Applies review results: decision logs recorded, deferred items moved to features tab, version bumped
5. **문서 생성하기** — Generates a final Markdown document in `docs/`

## Workspace Structure

```
~/projects/my-app/           ← workspace root
├── docs/
│   ├── .codeforge/
│   │   └── data.db          ← SQLite (project state, issues, logs)
│   ├── prd-v0.1.0.md
│   ├── review-1.1.0.md
│   ├── backend-1.0.0.md
│   ├── frontend-1.0.0.md
│   └── features-1.0.0.md
└── ...
```

## Development

```bash
git clone https://github.com/your-org/codeforge-blueprint
cd codeforge-blueprint
npm install

# Run in dev mode (tsx, no build required)
npm run dev -- ~/projects/my-app

# Build
npm run build
```

## Architecture

```
Local Server (Hono + @hono/node-server)
├── Static file server (dashboard)
├── REST API (workspace, issues CRUD, jobs polling)
├── Claude CLI Spawner (claude -p --output-format json)
└── SQLite (better-sqlite3)
        ↕ REST API                    ↕ child_process.spawn
  Browser Dashboard              Claude Code CLI
  (review / monitor)             (internal sub-agents)
```

**Runtime dependencies (4 only):** `hono`, `@hono/node-server`, `better-sqlite3`, `open`

## License

MIT
