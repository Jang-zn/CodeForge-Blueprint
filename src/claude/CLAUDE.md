# src/claude — AI Provider & Prompts

## Provider 스폰

`spawnProviderWithHandle(prompt, providerModel, options)` (`provider.ts`)

- `providerModel.provider`: `'claude'` | `'codex'`
- 반환: `{ promise, childReady }` — `promise`는 `{ success, result, error, usage }` resolve
- `registerProcess(jobId, child)` / `unregisterProcess(jobId)` 로 중단 가능

## Log Extractor

`createLogExtractor(provider)` — 스트리밍 청크를 plain text로 변환.
- Claude: JSON Lines 파싱 → content_block_delta 추출
- Codex: JSONL 파싱 → message delta 추출
- `processChunk(chunk)` → `string | null`

## Prompt Builders

| 파일 | 탭 | 기본 관점 수 |
|------|----|-------------|
| `prompts/review-plan.ts` | review | 6 |
| `prompts/design-backend.ts` | backend | 5 |
| `prompts/design-frontend.ts` | frontend | 5 |
| `prompts/plan-features.ts` | features | 4 |

모든 빌더 시그니처: `buildXxxPrompt(ctx: ContextPackage, perspectives?: Perspective[])`

- `perspectives`가 비어있으면 파일 내 `DEFAULT_PERSPECTIVES` 폴백
- 관점은 `id_prefix`, `name`, `prompt_instruction`만 사용
- 이슈 ID 패턴: `{id_prefix}1~{id_prefix}9` (예: `a1`, `be-api3`, `rv-mon1`)
