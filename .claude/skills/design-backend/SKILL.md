---
name: design-backend
description: |
  확정된 기획서와 기술 스택 문서를 기반으로 백엔드 아키텍처를 설계합니다. API, DB 스키마, 인프라, 라이브러리, 서비스 레이어를 분석하고 리뷰 가능한 설계 문서를 생성합니다.
  TRIGGER when: (1) 기획서+기술스택 문서 기반 BE 설계 요청 시. (2) /design-backend 직접 호출.
  DO NOT TRIGGER when: 기획 리뷰, 코드 리뷰, FE 설계, 버그 분석.
argument-hint: [path to PRD] [path to tech-stack doc]
---

# Backend Architecture Design Skill

Read a confirmed PRD and a tech-stack document, then produce an interactive HTML report with backend architecture decisions across 5 categories: API, DB Schema, Infrastructure, Libraries, and Service Layer.

## Output Directory Rules (Generic)

- **Project name extraction:** first segment before the first `_` in the first input document filename
  - Example: `kkumi_requirements_v1.1.md` -> `kkumi`
- **Output location:** `{input_doc_dir}/{project_name}_plan/` — a subfolder in the same directory as the input document
- **localStorage STORAGE_KEY:** `'{project_name}-plan-state-v1'`

## Execution Flow

### Step 1: Input

- Parse `$ARGUMENTS` for two paths: PRD path, tech-stack document path
- If paths are missing or files not found, ask the user
- Optional additional inputs:
  - Previous Phase BE design document path (for extending existing design)
  - review-plan JSON export (for resolved/deferred items)

### Step 2: Pre-analysis Confirmation

Ask the user these questions before proceeding:

1. **Phase scope:** Which features/sections of the PRD are in scope for this phase?
2. **Existing implementation:** Are there already implemented APIs/DB? If so, provide the document path.
3. **API versioning strategy:** URL versioning (`/v1/`), Header versioning, or other preference?
4. **Authentication method:** Confirm if not specified in the tech-stack document.

### Step 3: Document Reading

- Read PRD in full
- Read tech-stack document in full
- (If provided) Read previous Phase BE design document -> identify extension/change points
- (If provided) Parse review JSON for resolved/deferred items

### Step 4: Initial Analysis — 5 Sections

#### A. API Design (be-api)

- Map each PRD feature to REST endpoints
- Per endpoint: HTTP method, URL path, request params/body schema, response structure, auth level (public/user/designer/admin)
- Pagination strategy (cursor vs offset)
- Standard error response format
- API versioning application

#### B. DB Schema (be-db)

- Derive entities per domain
- mermaid ERD diagram
- Per-table column definitions (name, type, NOT NULL, DEFAULT, index)
- Migration strategy (Flyway or tool from the tech stack)
- Soft delete applicability

#### C. Infrastructure (be-infra)

- Deployment topology diagram (mermaid)
- Message queue / event design (if applicable)
- Cache strategy (what to cache, TTL, invalidation timing)
- Storage structure (file uploads, etc. if applicable)

#### D. Libraries / Frameworks (be-lib)

- Additional libraries needed beyond the tech-stack document
- Version compatibility issues
- Trade-offs for each choice

#### E. Service Layer (be-svc)

- Core Use Case list and processing flow for each
- Layer structure matching the architecture pattern from the tech-stack document
- Cross-cutting concerns: logging, error handling, transaction boundaries
- Domain event design (if applicable)

### Step 5: Multi-Agent Parallel Analysis (5 agents)

Launch 5 agents in parallel, one per section. Each agent uses `subagent_type: "senior-backend-architect"`.

Each agent receives:
- Full PRD text
- Full tech-stack document text
- Pre-analysis confirmation answers
- Step 4 initial analysis result for their section
- Instruction: "Review the initial analysis. Find missing endpoints, schema issues, infrastructure considerations, etc. Provide specific technical rationale for each decision."

Merge all agent findings into the final design.

### Step 6: HTML Report Output

Generate output based on `${CLAUDE_SKILL_DIR}/template.html`.

**Output path:** `{input_doc_dir}/{project_name}_plan/`

**Shell existence check:**
- If `{project_name}_plan/index.html` does **not** exist: generate the full 4-tab dashboard shell from `${CLAUDE_SKILL_DIR}/template.html`, producing `index.html`, `styles.css`, and `app.js` in the output folder.
- If `{project_name}_plan/index.html` **already exists**: replace only the `<div class="tab-panel" id="panel-backend">...</div>` block and the `<script type="application/json" id="state-backend">...</script>` block. Do NOT touch `styles.css` or `app.js`.

**State data:** Use a `<script type="application/json" id="state-backend">{...}</script>` block. When creating the shell, populate it with `{{INITIAL_STATE_BACKEND_JSON}}`. When replacing the panel, update this block with the new state JSON.

**localStorage key:** Set `STORAGE_KEY` to `'{project_name}-plan-state-v1'` so each project's browser state is isolated.

#### Design Item HTML Structure

Each design item MUST follow this structure:

```html
<h3 id="be-{cat}{N}">be-{cat}{N}. Design Decision Title</h3>
<span class="tag tag-decision">결정</span>  <!-- or tag-trade-off, tag-dependency -->
<span class="badge badge-{confirmed|proposed|alternative}">Confirmed</span>
<p>Description — design decision content in 2-3 sentences.</p>
<h4>근거</h4>
<p>Why this decision. How it connects to tech-stack document decisions.</p>
<div class="diagram-container"><pre class="mermaid">...</pre></div>  <!-- if applicable -->
<table>...</table>  <!-- if applicable -->
<div class="callout callout-{blue|orange|red}">
  <strong>트레이드오프:</strong> Why this choice over the alternatives
</div>
```

#### Issue ID Rules

- API Design: `be-api1`, `be-api2`, ...
- DB Schema: `be-db1`, `be-db2`, ...
- Infrastructure: `be-infra1`, `be-infra2`, ...
- Libraries: `be-lib1`, `be-lib2`, ...
- Service Layer: `be-svc1`, `be-svc2`, ...

#### panel-backend Structure

```html
<div class="tab-panel" id="panel-backend">
  <h1>BE 설계</h1>
  <div class="meta">...</div>
  <div class="filter-bar" id="filterBar-backend">...</div>
  <h2 id="part-be-api">A. API 설계</h2>
  <!-- be-api items -->
  <h2 id="part-be-db">B. DB 스키마</h2>
  <!-- be-db items -->
  <h2 id="part-be-infra">C. 인프라</h2>
  <!-- be-infra items -->
  <h2 id="part-be-lib">D. 라이브러리/프레임워크</h2>
  <!-- be-lib items -->
  <h2 id="part-be-svc">E. 서비스 레이어</h2>
  <!-- be-svc items -->
  <h2 id="be-summary">요약</h2>
  <!-- summary table -->
  <h2 id="be-changelog">Changelog</h2>
  <!-- changelog entries -->
</div>
```

## Review Cycle

1. **BE 설계 분석 -> HTML 리포트 작성** — Run `/design-backend` to produce the interactive HTML report.
2. **사용자 검토 -> JSON 내보내기** — User reviews each design item in the browser (sets status + memo), then exports via the Export button.
3. **JSON 반영 -> HTML 업데이트** — When the user provides the exported JSON, apply it back to the HTML. Memos are recorded in decision-log entries only; body content is NOT modified.

**문서 작성이 필요하면:** `/write-doc backend {json경로} {원본문서경로}` 를 별도로 실행하세요.
리뷰 사이클이 충분히 진행된 후, 또는 팀 회의 직후 문서화가 필요한 시점에 호출합니다.

### JSON Apply Rules

#### Design item content updates
- **Item body is NEVER modified** — verdict, conclusion callout, etc. remain unchanged
- All memos (direction confirmed, informational) are recorded as decision-log entries only

#### Decision log format
Add a `<div class="decision-log">` section to each item:

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

#### Sidebar rebuild
After applying JSON, rebuild the sidebar to use status-based collapsible groups.

#### Version bump
Bump MINOR version and add a changelog entry.

## Versioning & Changelog

Every report includes a version number and a changelog section.

**Version format:** `MAJOR.MINOR.PATCH`
- **MAJOR** — analysis scope or category structure changes (e.g., adding/removing a category, re-analyzing from scratch)
- **MINOR** — design items added, removed, or significantly rewritten; review cycle applied
- **PATCH** — minor wording fixes, rationale adjustments, badge status changes

**Changelog rules:**
- Tracks **content changes**, not HTML/CSS/JS changes
- Each entry: version, date, brief description of what changed
- Initial design is always v1.0.0
- Version displayed in: sidebar logo area, meta line, changelog table

**Changelog location:** Inside `panel-backend`, after the summary section, as `<h2 id="be-changelog">`.

## Rules

- All report content (titles, descriptions, rationales) should match the user's language
- The HTML report template (CSS, JS, interactive features) comes from template.html
- Do NOT reference section/subsection numbers from the source documents
- Each design decision must include a rationale linking back to the tech-stack document or PRD
- Distinguish between confirmed decisions, proposed alternatives, and trade-offs using appropriate tags and badges
