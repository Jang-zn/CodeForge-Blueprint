# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeForge-Blueprint is a collection of Claude Code custom skills (slash commands) that form an integrated product planning and architecture design pipeline. There is no application code, no package.json, no build system — the entire repository lives inside `.claude/skills/`.

## Skills Pipeline

The 5 skills form a sequential pipeline sharing a single interactive HTML dashboard:

```
PRD → /review-plan → /design-backend → /design-frontend → /plan-features → /write-doc
```

- **`/review-plan`**: Analyzes PRDs for contradictions, blind spots, operational risks. Creates the dashboard shell (`index.html`) with 4 tabs. Uses 6 parallel sub-agents (one per perspective).
- **`/design-backend`**: Backend architecture design (API, DB, infra, libraries, service layer). Outputs to `panel-backend` tab. Uses 5 parallel sub-agents.
- **`/design-frontend`**: Frontend architecture design (components, state, routing, API integration, design system). Consumes "Ref" items from review-plan. Uses 5 parallel sub-agents.
- **`/plan-features`**: Next-version feature proposals from 4 perspectives (marketing, ops, service, tech). Absorbs "deferred" items from review-plan. Uses 4 parallel sub-agents.
- **`/write-doc`**: Generates final Markdown documents from JSON exports. No sub-agents.

## Architecture

All skills share:
- A single `index.html` dashboard with 4 tabs (`panel-review`, `panel-backend`, `panel-frontend`, `panel-features`)
- Common `styles.css` and `app.js` from the `review-plan` skill directory
- JSON state blocks (`<script type="application/json" id="state-{tab}">`) embedded in HTML for data persistence
- `localStorage` for browser-side status tracking per project

Key data flows between skills:
- "Deferred" items from `/review-plan` automatically become candidates in `/plan-features`
- "Ref" items (FE implementation notes) from `/review-plan` are consumed by `/design-frontend`
- `/write-doc` reads JSON exports from any tab to generate final `.md` documents

## File Structure

```
.claude/skills/
├── review-plan/       # Master skill — creates dashboard shell
│   ├── SKILL.md       # Skill definition (Mode A: Review, Mode B: Checklist)
│   ├── template.html  # Full 4-tab dashboard HTML shell
│   ├── styles.css     # Dark-themed CSS (shared by all tabs)
│   └── app.js         # Dashboard interactivity (shared by all tabs)
├── design-backend/
│   ├── SKILL.md
│   └── template.html  # Panel fragment for BE tab
├── design-frontend/
│   ├── SKILL.md
│   └── template.html  # Panel fragment for FE tab
├── plan-features/
│   ├── SKILL.md
│   └── template.html  # Full shell template (alternate entry)
└── write-doc/
    └── SKILL.md
```

## Conventions

- **Issue IDs**: Strict naming patterns per category (`a1`, `be-api1`, `fe-comp1`, `ft-mkt1`, etc.)
- **Versioning**: Semantic versioning (MAJOR.MINOR.PATCH) with changelog in every report
- **Review cycle**: HTML report → browser review → JSON export → JSON apply → version bump
- **Language**: Content follows the user's language; templates are in Korean
- **Decision logs**: Review memos are recorded only as decision-log entries, never modifying the original issue body
- **Mermaid.js** (v11, CDN): Used for diagrams (ERD, flowcharts, sequence diagrams)
