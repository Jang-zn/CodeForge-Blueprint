---
name: review-plan
description: |
  Analyzes product requirement documents (PRDs), feature specs, or planning documents to find contradictions, blind spots, operational risks, and missing definitions. Outputs an interactive HTML report with status tracking and export.
  TRIGGER when: (1) User provides a planning/requirements document path and asks for review, analysis, contradiction check, or blind spot discovery. (2) User shows a feature spec and asks "what's missing", "find problems", "review this plan". (3) Invoked directly via /review-plan.
  DO NOT TRIGGER when: Code review, PR review, bug analysis, technical doc review, simple document summarization.
argument-hint: [path to requirements document]
---

# Planning Document Review Skill

Read and analyze a planning/requirements document, then produce an interactive HTML report identifying contradictions, blind spots, and operational risks.

## Execution Flow

### Step 1: Input

- Read the document at the path provided via `$ARGUMENTS`
- If no path or file not found, ask the user

### Step 2: Assess Document Maturity

Determine maturity level based on these criteria:

| Criterion | Concrete | Rough |
|-----------|----------|-------|
| Screen-level field/UI definitions | Yes | No |
| Specific pricing/credit numbers | Yes | No |
| Step-by-step user flows | Yes | No |
| Explicit policies (guest access, deletion, data retention) | Yes | No |

- **3+ criteria met → Mode A (Review Mode)** — find contradictions and blind spots
- **2 or fewer → Mode B (Checklist Mode)** — provide conditional checkpoints of what needs to be defined
- If ambiguous, ask the user

### Step 3: Pre-analysis Confirmation

Ask the user before analyzing:
- Any features intentionally excluded? (e.g., "we're NOT doing CRM", "no booking integration")
- Are screen designs/layouts at wireframe stage and subject to change?
- Is there an existing codebase? (path, for technical implementation analysis)

### Step 4: Analysis

#### Mode A: Review Mode (Concrete Documents)

Find contradictions and blind spots across 7 perspectives:

**A. Planning Consistency (기획 정합성)**
Conflicts between policies/definitions, undefined items, logical contradictions.
- Different sections defining the same concept differently
- Feature A's premise conflicting with Feature B's policy
- User flows with undefined next steps
- 1st/2nd phase scope contradictions
- Service identity confusion (tool vs platform)

**B. Revenue / Pricing Model (수익/과금 모델)**
Pricing structure coherence, missing definitions, unit economics.
- Pricing contradictions (free but requires credits, etc.)
- Undefined free/paid boundaries
- Credit/point carry-over, expiration, refund, cancellation policies missing
- Payment refund policy (full/partial/none, criteria, processing timeline, cancellation window)
- In-app purchase: app store commission (30%) factored in, IAP policy compliance
- Credit-consuming features: refund on failure/error, reprocessing policy, accidental charge reversal
- Unit economics inversion (manual processing cost > charge revenue)
- Missing conversion funnel design

**C. User Acquisition / Retention (사용자 획득/유지)**
Cold start, retention, discovery path issues.
- UGC/feed exists but no cold start strategy
- Content exposure algorithm undefined
- Content production→exposure→reaction→reward loop incomplete
- Different content types mixed without filtering
- User discovery/connection path missing
- Retention hooks / push triggers undefined
- Excessive Time-to-Value (too many steps to first value)
- Hashtags/search as decoration (input exists but no exploration feature)

**D. Implementation Feasibility (구현 가능성)**
Missing flows, state management gaps, data model issues when building as specified.
- Credit loss on unsaved/abandoned results
- Insufficient-balance entry UX undefined
- Async processing (AI, etc.) wait/failure/cancel UX
- Data source inconsistencies (referenced data doesn't exist)
- Parameter schema missing (data needed to reproduce a feature state)
- Race conditions between state changes
- N+1 queries, fanout scalability issues
- Build order dependencies between features

**E. Operational Scalability (운영 확장성)**
Structural bottlenecks that worsen with growth.
- Manual process scalability limits
- External data dependencies (crawling, unofficial APIs)
- Missing moderation/reporting/blocking
- Unenforceable SLA structures
- Operations team capacity bottlenecks
- Data source sustainability

**F. Legal / Regulatory Risk (법적/규제 리스크)**
Legal issues to verify before launch.
- Missing consent flows for personal data collection
- External platform ToS violation risk
- Portrait rights / publicity rights infringement
- Account deletion timeline/scope undefined
- PII encryption policy missing

**Ref. Implementation Notes (구현 참고사항)**
NOT contradictions — reference points for implementation. No decisions needed, just things easy to miss.
- Navigation back-button behavior
- Cross-screen state synchronization
- Network disconnection handling
- Dark mode support
- Touch targets / accessibility

All Ref items found during analysis are stored in `state-review.refItems` (string array) only — they are **NOT rendered in panel-review HTML**. The Ref section is not shown in the review tab because these items are FE design inputs for `/design-frontend`, not planning issues. When `/design-frontend` runs, these items are automatically extracted from `state-review.refItems` and mapped to the relevant FE sections.

#### Mode B: Checklist Mode (Rough Documents)

Provide conditional checkpoints: "If you have X, you need to define Y."

Output these as checklist items grouped by perspective (A through F), using the following patterns:

**A. Planning Consistency:**
- Multiple user types → define: type switching policy, data retention, permission differences, UI branching
- Same feature accessible from multiple entry points → define: state sync scope
- Content visibility options (public/private/restricted) → define: exposure rules per scope
- Cross-referencing features → verify: build order dependencies, MVP scope cuts

**B. Revenue / Pricing Model:**
- Virtual currency/credit system → define: carry-over, expiration, consumption priority, charge units
- Free/paid distinction → define: free limits, conversion trigger points, paid-only feature scope
- Subscription model → define: cancellation data/feature handling, downgrade policy, renewal cycle/pricing
- Payments → define: refund policy (full/partial/none), refund criteria, processing timeline, cancellation window
- In-app purchases → define: app store commission pricing, IAP compliance, store product registration structure
- Credit-consuming features → define: failure/error refund, result non-delivery reprocessing, accidental charge reversal

**C. User Acquisition / Retention:**
- UGC/feed → define: cold start strategy, exposure algorithm, content loop
- Follow/subscribe system → define: zero-follower UX, recommendation algorithm
- Notifications → define: retention triggers (system-initiated), Day 1/7/30 scenarios
- Onboarding → review: Time-to-Value step count

**D. Implementation Feasibility:**
- AI/ML features → define: processing time UX (sync/async), failure handling, cost structure
- Paid actions (credits, etc.) → define: result non-delivery refund policy
- External data dependencies → design: graceful deactivation on source disconnection
- State restoration features ("restart", "retry") → define: original parameter serialization schema

**E. Operational Scalability:**
- Manual processes → define: N-concurrent-request SLA, cost vs staffing analysis
- Community features → define: report/block/moderation policy, content guidelines
- External platform data dependency → verify: ToS compliance, alternative data sources

**F. Legal / Regulatory:**
- Personal data collection → define: consent flow, encryption, deletion policy
- Third-party data usage → verify: licensing, portrait rights, ToS compliance
- Account deletion → define: deletion timeline, cascading deletion scope, backup handling

### Step 5: Multi-Agent Parallel Analysis (6 agents, one per perspective)

After initial analysis, launch 6 agents in parallel — one for each analysis perspective. Each agent receives the full requirements document + initial analysis results and is instructed to find only NEW issues not already covered.

1. **Agent A — Planning Consistency (기획 정합성)**
   Focus: policy conflicts, undefined items, logical contradictions, scope overlaps, service identity confusion, feature interdependencies, build order traps.

2. **Agent B — Revenue / Pricing Model (수익/과금 모델)**
   Focus: pricing contradictions, free/paid boundary gaps, credit lifecycle (carry-over, expiration, refund, cancellation), payment refund policy, IAP compliance, unit economics, conversion funnel design.

3. **Agent C — User Acquisition / Retention (사용자 획득/유지)**
   Focus: cold start strategy, content exposure algorithm, production-consumption loop, discovery paths, retention hooks, push triggers, Time-to-Value, hashtag/search utility, viral mechanics.

4. **Agent D — Implementation Feasibility (구현 가능성)**
   Focus: missing UX flows, state management gaps, data model contradictions, async processing UX, race conditions, N+1/fanout issues, parameter schema gaps, cross-screen state sync.

5. **Agent E — Operational Scalability (운영 확장성)**
   Focus: manual process bottlenecks, external data dependencies, moderation/reporting gaps, SLA enforceability, ops team capacity, data source sustainability, support coverage gaps.

6. **Agent F — Legal / Regulatory Risk (법적/규제 리스크)**
   Focus: personal data consent flows, external platform ToS violations, portrait/publicity rights, account deletion timeline/scope, PII encryption, content liability, age verification requirements.

Each agent uses `subagent_type: "general-purpose"` and is briefed with:
- The full requirements document content
- The initial analysis results for their perspective (so they build on, not repeat)
- Explicit instruction: "Find NEW issues only. Report in the user's language. Under 500 words."

Merge all agent findings into the report under their respective perspective sections.

#### Mode B (Checklist): 1 agent only

Launch 1 `product-planning-god` agent to review the checklist output for completeness and suggest additional checkpoints based on the specific service type.

### Step 6: HTML Report Output

Generate an HTML file based on `${CLAUDE_SKILL_DIR}/template.html`.

**Output location:** `{input_doc_dir}/{project_name}_plan/` — a subfolder in the same directory as the input document.

**Project name extraction:** Take the input document filename and use the segment before the first `_`.
- Example: `kkumi_requirements_v1.1.md` → project_name = `kkumi` → output folder = `kkumi_plan/`

**Shell existence check:**
- If `{project_name}_plan/index.html` does **not** exist: generate the full 4-tab dashboard shell from `${CLAUDE_SKILL_DIR}/template.html`, producing `index.html`, `styles.css`, and `app.js` in the output folder.
  - Copy `${CLAUDE_SKILL_DIR}/styles.css` → `{output}/styles.css` as-is.
  - Copy `${CLAUDE_SKILL_DIR}/app.js` → `{output}/app.js`, replacing `{{PROJECT_NAME}}` with the actual project name.
- If `{project_name}_plan/index.html` **already exists**: replace only the `<div class="tab-panel" id="panel-review">...</div>` block and the `<script type="application/json" id="state-review">...</script>` block. Do NOT touch `styles.css` or `app.js`.

**State data:** Use a `<script type="application/json" id="state-review">{...}</script>` block (not an inline `INITIAL_STATE` variable). When creating the shell, populate it with `{{INITIAL_STATE_JSON}}`. When replacing the panel, update this block with the new state JSON.

The state JSON must include a `refItems` field — an array of strings, each being one Ref item found during analysis:
```json
{
  "issues": { ... },
  "refItems": [
    "뒤로가기 동작 정의 필요 — 각 화면의 back 동작이 스택/탭 구조와 일치하는지",
    "네트워크 단절 시 처리 — API 호출 실패/재시도 UX",
    ...
  ]
}
```

**localStorage key:** Set `STORAGE_KEY` to `'{project_name}-design-state-v1'` so each project's browser state is isolated.

**Placeholders** (in `template.html`):
- `{{REPORT_TITLE}}` — report title (e.g., "{프로젝트명} 기획서 모순점 및 맹점 분석")
- `{{REPORT_SUBTITLE}}` — subtitle in sidebar logo area
- `{{META_LINE}}` — meta information line (date, issue count, etc.)
- `{{SIDEBAR_NAV}}` — panel-review 내 사이드바 섹션 링크
- `{{MAIN_CONTENT}}` — panel-review 내 이슈 콘텐츠
- `{{SUMMARY_TABLE}}` — panel-review 내 요약 테이블
- `{{STATIC_SIDEBAR_FOOTER}}` — Changelog 링크만 (Ref 링크는 포함하지 않음 — Ref 항목은 FE 설계로 넘어가므로 사이드바에 표시하지 않는다)
- `{{INITIAL_STATE_JSON}}` — state-review script 블록에 들어갈 JSON

**panel-review 렌더링 규칙:**
- REF 섹션(`<h2>Ref. 화면 구현 참고사항</h2>` 및 하위 항목)은 panel-review HTML에 렌더링하지 않는다 — Ref 항목은 `state-review.refItems`에만 저장되고 `/design-frontend`가 자동 추출함
- Changelog는 panel-review 내부가 아닌 모든 탭 패널 바깥(`</div><!-- .main -->` 직전)에 단독 섹션으로 위치한다. 셸 생성 시 Changelog를 tab-panel 밖에 배치하라.

**Issue template:** Every issue MUST follow this structure:
```
Title + Tag (contradiction/blind spot/risk) + Priority (P0/P1/P2)
Description — what's wrong in 1-2 sentences
Evidence — mermaid diagram, table, or list (whichever fits)
Conclusion — callout box with the key point and required action
```

**Priority levels:**
- P0: Cannot start development without resolving
- P1: Major flow has a hole
- P2: Will cause problems in production

## Rules

- Screen design/layout issues go in Ref section (reference, not contradiction)
- Do NOT reference section/subsection numbers from the source document
- Distinguish between writing mistakes (typos, duplicates) and structural contradictions
- Confirm "intentionally excluded" features with the user before flagging them
- If an existing codebase is available, explore it for planning-implementation gaps
- All report content (issue titles, descriptions, conclusions) should match the user's language. If the user writes in Korean and the document is in Korean, output in Korean. If in English, output in English. Follow the user's language, not the document's.
- The HTML report template (CSS, JS, interactive features) comes from template.html

## Versioning & Changelog

Every report includes a version number and a changelog section at the bottom.

**Version format:** `MAJOR.MINOR.PATCH`
- **MAJOR** — analysis scope or perspective structure changes (e.g., adding/removing a perspective, re-analyzing from scratch)
- **MINOR** — issues added, removed, or significantly rewritten (e.g., user confirms an issue is invalid and it's removed, or new issues are discovered)
- **PATCH** — minor wording fixes, conclusion adjustments, priority changes

**Changelog rules:**
- The changelog tracks **content changes**, not HTML/CSS/JS changes
- Each entry: version, date, brief description of what changed in the analysis content
- Initial analysis is always v1.0.0
- When the user reviews issues and requests changes (delete issues, add new ones, change conclusions), bump the version and add a changelog entry
- The version is displayed in: sidebar logo area, meta line, changelog table

**Changelog location:** After the summary table, before the Ref section, as an `<h2>` with id `changelog`.

## Review Cycle

The review-plan skill supports an iterative improvement loop. One cycle consists of:

1. **기획서 분석 → HTML 리포트 작성** — Run `/review-plan` on a requirements document to produce the interactive HTML report. Output location is `{input_doc_dir}/{project_name}_plan/` (project_name = filename segment before first `_`). If the shell already exists, only the `panel-review` block and `state-review` block are replaced.
2. **사용자 검토 → JSON 내보내기** — User reviews each issue in the browser (sets status + memo), then exports via the Export button
3. **JSON 반영 → HTML 업데이트** — When the user provides the exported JSON file, apply it back to the HTML (see JSON Apply Rules below)

**문서 작성이 필요하면:** `/write-doc review {json경로} {원본문서경로}` 를 별도로 실행하세요.
리뷰 사이클이 충분히 진행된 후, 또는 팀 회의 직후 문서화가 필요한 시점에 호출합니다.

Bump the HTML version MINOR on each cycle.

## JSON Apply Rules

When the user provides an exported JSON review file to apply back to the HTML report:

### Issue content updates
- **Issue body는 어떤 경우에도 수정하지 않음** — verdict, conclusion callout 등 기존 콘텐츠를 변경하지 않는다
- 모든 메모(방향 확정, 정보성 모두)는 decision-log entry로만 기록한다

### Decision log format
Add a `<div class="decision-log">` section to each issue (between the last content element and the `issue-controls` div):

```html
<div class="decision-log">
  <div class="decision-log-title">결정 이력</div>
  <div class="decision-entry">
    <span class="decision-date">YYYY-MM-DD</span>
    <span class="decision-status decision-status-{status}">상태레이블</span>
    <span class="decision-memo">메모 내용</span>
  </div>
</div>
```

- Use the JSON export date as the entry date
- Log entries are appended in chronological order on subsequent cycles

### Sidebar rebuild
After applying JSON, rebuild the sidebar to use status-based collapsible groups (see HTML template for `buildStatusSidebar()` function).

### Deferred items → panel-features (이동, 복사 아님)

After applying decision-log entries, extract all issues with `status: "deferred"` from the JSON and **move** them to `panel-features` as `ft-def{N}` entries. "이동"이란 panel-review에서 해당 h3 블록을 제거하고 panel-features에 생성하는 것을 의미한다.

```html
<h3 id="ft-def1" data-origin-id="[원본이슈ID]">ft-def1. [원본 이슈 제목]</h3>
<span class="tag tag-deferred-input">기획 리뷰 보류</span>
<p>원본: <code>[원본 이슈 ID]</code> — [원본 이슈 섹션명]</p>
<div class="callout callout-orange">
  <strong>보류 사유:</strong> [deferred 메모 내용. 메모가 없으면 "사유 미기재"]
</div>
<!-- 원본 이슈 콘텐츠 전체 복사 (아래) -->
[panel-review의 원본 이슈 h3 이후 콘텐츠 블록 전체]
```
- 원본 콘텐츠 이동 범위: panel-review에서 `<h3 id="[원본이슈ID]">` 태그부터 다음 `<h3>` 또는 `<h2>` 직전까지 전체 블록. 단, `<div class="issue-controls">`, `<div class="decision-log">` 는 제외.
- 이동된 원본의 태그/배지/설명/증거/결론 callout이 모두 ft-def 항목 안에 포함됨.
- **panel-review에서 원본 h3 블록을 삭제한다** (이동이므로 panel-review에 남기지 않음).
- panel-review에서 이동 후 해당 섹션 `<h2>`에 남은 `<h3>` 항목이 없으면 `<h2>` 헤더도 함께 삭제.
- (issue-controls는 app.js가 자동으로 추가하므로 HTML에 직접 작성하지 않는다)

Rules:
- `ft-def{N}` 번호는 panel-features 내 기존 `ft-def*` 항목 수 + 1부터 시작
- panel-features에 `<h2 id="part-ft-def">기획 리뷰 보류 항목</h2>` 섹션이 없으면 마지막 `<h2>` 뒤에 추가
- 이미 같은 원본 ID(`data-origin-id` 속성으로 확인)에서 넘어온 ft-def 항목이 있으면 중복 생성 안 함 — decision-log만 갱신
- `state-features` JSON 블록도 갱신: 새 ft-def 아이템을 `pending` 상태로 추가
- `h3` 태그에 `data-origin-id="{원본이슈ID}"` 속성 추가 (중복 방지용)
- state-review JSON에서 이동된 항목은 제거 (panel-review에서도 HTML이 사라지므로)

### Version bump
Bump MINOR version and add a changelog entry describing the number of issues updated, key decisions made, and how many deferred items were moved to features tab.
