# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the application code. Use `src/cli.ts` for the entry point, `src/server/` for the Hono HTTP server and routes, `src/db/` for SQLite access and schema helpers, `src/claude/` for AI provider integration, and `src/dashboard/` for static browser assets. Tests live under `tests/` and mirror the source layout, for example `tests/db/repository.test.ts`. Build output goes to `dist/`. Generated workspace documents are written outside the repo to `{workspace}/docs/`.

## Build, Test, and Development Commands
Run `npm run dev -- ~/projects/my-app` to start the CLI directly from TypeScript for local development. Run `npm run build` to compile to `dist/` and copy dashboard assets. Run `npm start -- ~/projects/my-app` to execute the built CLI. Run `npm test` to execute the Node test suite with `tsx/esm`.

## Coding Style & Naming Conventions
This project uses strict TypeScript with ES modules. Follow the existing 2-space indentation and semicolon usage. Prefer `camelCase` for variables and functions, `PascalCase` for interfaces and types, and lowercase hyphenated filenames for multiword modules such as `log-extractor.ts`. Keep route handlers small and move reusable persistence logic into `src/db/` or provider-specific logic into `src/claude/`.

## Testing Guidelines
Tests use Node's built-in `node:test` runner with `assert/strict`. Name files `*.test.ts` and place them near the matching domain folder in `tests/`. Cover both happy paths and filesystem or database edge cases; `tests/workspace.test.ts` is a good pattern for temp-directory cleanup. Run `npm test` before opening a PR.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits, often with scopes, for example `feat(init): ...` or `test(workspace,db): ...`. Keep commits focused and use `feat`, `fix`, `test`, or similar typed prefixes. PRs should include a short summary, linked issue if applicable, test results, and screenshots or short recordings for dashboard changes.

## Security & Configuration Tips
Target Node.js 18+ as declared in `package.json`. Do not commit workspace-specific `docs/` output, database files, or local CLI credentials. When changing provider integration, verify both CLI detection and the browser workflow from workspace selection through document generation.
