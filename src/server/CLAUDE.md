# src/server — Hono API Server

## 분석 파이프라인

```
POST /api/analyze { tab, perspectiveIds? }
  → getActivePerspectives(db, tab)  [perspectiveIds로 필터]
  → buildXxxPrompt(contextPackage, perspectives)
  → spawnProviderWithHandle(prompt, providerModel)
  → Claude/Codex CLI subprocess (streaming)
  → createLogExtractor → appendJobLog (실시간)
  → validateAnalyzeResults → bulkUpsertIssues
  → updateJob('completed')
```

분석은 fire-and-forget 비동기(`(async () => { ... })()`). 클라이언트는 `GET /api/jobs/:id`를 폴링.

## 주요 라우트

| 경로 | 파일 |
|------|------|
| `/api/analyze` | `routes/analyze.ts` |
| `/api/apply` | `routes/apply.ts` |
| `/api/issues` | `routes/issues.ts` |
| `/api/perspectives` | `routes/perspectives.ts` |
| `/api/workspace` | `routes/workspace.ts` |
| `/api/generate` | `routes/generate.ts` |
| `/api/jobs` | `routes/jobs.ts` |

## Context Package

`buildContextPackage(db, docsPath, tab, prdPath)` — PRD, 기존 이슈, ref items, glossary 등을 수집해 프롬프트에 주입하는 컨텍스트 번들. `src/claude/context-package.ts`.

## Perspectives 뮤테이션 후처리

POST/PUT/DELETE/toggle 엔드포인트는 항상 `exportPerspectivesJson(db, docsPath)` 호출 — `{workspace}/.codeforge/perspectives.json` 자동 갱신.
