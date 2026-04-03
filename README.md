# CodeForge Blueprint

Turn an idea into a structured PRD, backend/frontend architecture, and next-version feature proposals — all in a local browser dashboard powered by your choice of AI backend.

## Requirements

- Node.js 18+
- At least one AI CLI installed:

| CLI | Install |
|-----|---------|
| [Claude Code CLI](https://docs.anthropic.com/en/claude-code) | `npm install -g @anthropic-ai/claude-code` |
| [Codex CLI](https://github.com/openai/codex) | `npm install -g @openai/codex` |

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

1. **Init** — Fill in a structured form (service type, target users, revenue model, tech stack, detailed description) → AI generates a PRD draft
2. **기획 리뷰** — AI analyzes the PRD across 6 perspectives: planning consistency, revenue, user acquisition, implementation feasibility, operational scalability, legal/compliance. Review each issue in the browser and set status/memo
3. **BE / FE 설계** — Architecture analysis for backend (API, DB, infra, libraries, service layer) and frontend (components, state, routing, API integration, design system)
4. **다음버전** — Next-version feature proposals from 4 angles (marketing, ops, service, tech). Deferred items from 기획 리뷰 are automatically included
5. **반영하기** — Applies review results: records decision logs, moves deferred items to the features tab, bumps the version
6. **문서 생성하기** — Generates a final Markdown document in `docs/`

## Model Selection

The header dropdown lets you switch AI backends at any time. The selection persists across server restarts.

**Claude models** (requires Claude Code CLI):
- Claude Sonnet 4.6 *(default)*
- Claude Opus 4.6
- Claude Haiku 4.5

**Codex models** (requires Codex CLI):
- o4-mini
- o3
- GPT-4.1

Options for uninstalled CLIs are disabled automatically.

## Workspace Structure

```
~/projects/my-app/           ← workspace root
├── docs/
│   ├── .codeforge/
│   │   └── data.db          ← SQLite (issues, decision logs, versions, provider preference)
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

# Test
npm test
```

## Architecture

```
Local Server (Hono + @hono/node-server)
├── Static file server (dashboard)
├── REST API (workspace, issues CRUD, jobs polling)
├── Provider Spawner
│   ├── Claude CLI  (claude -p --output-format json)
│   └── Codex CLI   (codex exec --json --full-auto --ephemeral)
└── SQLite (better-sqlite3)
        ↕ REST API                    ↕ child_process.spawn
  Browser Dashboard              AI CLI (Claude / Codex)
  (review / monitor)             (analysis & generation)
```

**Runtime dependencies (4 only):** `hono`, `@hono/node-server`, `better-sqlite3`, `open`

## License

MIT
