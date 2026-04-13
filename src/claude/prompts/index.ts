/**
 * AI 프롬프트에서 공통으로 사용하는 ID 연속성 규칙 블록.
 * 4개 탭의 프롬프트 빌더에서 동일하게 주입됨.
 */
export const ID_CONTINUITY_RULES = `- **ID 연속성 규칙** (<context:existing-issues> 참조):
  1. 기존 이슈와 같은 의도/주제를 이어받으면 → 기존 ID 그대로 사용, basis_issue_id에 동일 ID 기재
  2. 기존 이슈를 세분화/분할하면 → "{원본id}-1", "{원본id}-2" 형태의 새 ID, basis_issue_id에 원본 ID
  3. 완전히 새로운 이슈 → 새 prefix 기반 ID, basis_issue_id는 null
  4. status가 "dismissed"인 기존 이슈의 ID는 절대 재사용 금지
  5. status가 "pending" / "reviewing"인 기존 이슈가 여전히 유효하면 반드시 계승
- basis_issue_id: 계승/분할한 기존 이슈 ID (신규이면 null)`;
