# src/db — Database Layer

## 2-Tier Architecture

| DB | 파일 | 내용 |
|----|------|------|
| `app.db` | `~/.codeforge-blueprint/app.db` | 전역: sessions, recents |
| `data.db` | `{workspace}/.codeforge/data.db` | 워크스페이스별: issues, jobs, perspectives, documents, glossary |

- `initAppDb()` → `openDb()` 순서 필수. 역순이면 앱 크래시.
- `openDb()` 내부 `_dbs` Map으로 같은 경로 중복 오픈 방지.

## Migrations

`schema.ts`에 `MIGRATION_V{N}_SQL` 상수로 순차 정의. `openDb()` 호출 시 자동 적용.

- **추가**: `MIGRATION_V{N+1}_SQL` 상수 추가 + `openDb()` 내 배열에 등록
- **절대 금지**: 기존 마이그레이션 수정, `DROP TABLE` 사용 (데이터 유실)
- 새 테이블은 `CREATE TABLE IF NOT EXISTS`만 사용

## Perspectives Seed

`seedPerspectives(db)` — `INSERT OR IGNORE`로 멱등. `PERSPECTIVE_SEEDS` 배열(schema.ts)이 단일 진실 공급원.

- 기본 locked 관점: `is_locked=1`, 자동으로 `active_perspectives`에도 삽입
- 테스트에서 `createTestDb()`는 schema + seed 모두 포함

## Test Pattern

```ts
// initAppDb/closeAppDb로 각 테스트 브래킷
beforeEach(() => { process.env.CODEFORGE_BLUEPRINT_HOME = tmpDir; initAppDb(); });
afterEach(() => { closeAppDb(); });
```
