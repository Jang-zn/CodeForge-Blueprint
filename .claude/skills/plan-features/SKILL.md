---
name: plan-features
description: |
  Phase N의 확정된 기획서 + 설계문서를 기반으로, 다음 버전 기능을 마케팅/운영/서비스/기술 관점에서 제안합니다.
  TRIGGER when: (1) Phase N 기획+설계 확정 후 다음 단계 기능 제안 요청 시. (2) /plan-features 직접 호출.
  DO NOT TRIGGER when: 기획서 모순 분석, 코드 리뷰, BE/FE 설계 요청.
argument-hint: [path to Phase N PRD] [path to BE design doc] [path to FE design doc]
---

# 다음버전 기능 제안 Skill

Phase N의 확정된 기획서와 BE/FE 설계문서를 입력받아, 다음 버전 기능을 마케팅/운영/서비스/기술 4개 관점에서 제안하는 인터랙티브 HTML 리포트를 생성합니다.

## Execution Flow

### Step 1: Input

- `$ARGUMENTS`에서 기획서 경로, BE 설계 문서 경로, FE 설계 문서 경로 파싱
- 경로가 없거나 파일이 존재하지 않으면 사용자에게 요청
- 추가 입력 (선택): review-plan JSON export 경로 (deferred 항목 참고용), 운영 피드백 텍스트

**프로젝트명 추출:**
- 첫 번째 `$ARGUMENTS` 파일명에서 첫 `_` 앞 세그먼트를 project_name으로 사용
- 예: `kkumi_requirements_v1.1.md` → project_name = `kkumi`
- 출력 폴더: `{input_doc_dir}/{project_name}_plan/` (입력 문서와 같은 디렉토리)

### Step 2: Pre-analysis Confirmation

분석 전 사용자에게 확인:
- 현재 Phase에서 구현된/구현 중인 기능 범위 (중복 제안 방지)
- 비즈니스 우선순위: 매출 확대 / 사용자 확보 / 운영 효율화 중 중점
- 다음 버전 목표 시점 및 개발 리소스 규모감 (개발자 N명, M개월)
- 운영 중 발견된 문제점이나 사용자 피드백 (있으면 공유)

### Step 3: Document Reading & Context

- 기획서 전문 읽기
- BE 설계 문서 전문 읽기
- FE 설계 문서 전문 읽기
- (있으면) review JSON에서 deferred/dismissed 항목 추출
- **기획 리뷰 보류 항목 자동 인식**: `{project_name}_plan/index.html`이 존재하면, `panel-features` 내 `ft-def*` ID를 가진 항목들을 추출. 이들은 review-plan JSON 반영 시 자동으로 넘어온 보류 이슈들임. 각 에이전트 브리핑에 해당 항목 목록을 전달하여 다음 버전 기능 후보로 평가하도록 지시.

### Step 4: Initial Analysis — 4 Perspectives

각 관점에서 다음 버전 기능 후보를 도출한다.

#### 마케팅 관점 (ft-mkt)

- 바이럴 루프 기능 (친구 초대, 공유 인센티브)
- 레퍼럴 프로그램
- 브랜드 포지셔닝 강화 기능
- 유저 그로스 드라이버
- 시즌/이벤트 기능
- 크로스 프로모션

#### 운영 관점 (ft-ops)

- 자동화 도구 (반복 작업 줄이기)
- 운영 모니터링 대시보드
- CS 효율화 도구
- 운영 비용 절감 기능
- 어뷰징 방지 강화
- 내부 관리 도구

#### 서비스 기획 관점 (ft-svc)

- 사용자 여정 갭 메우기
- 리텐션 훅 기능
- 인게이지먼트 루프 강화
- 커뮤니티 기능
- 개인화/추천
- 기존 핵심 기능 고도화

#### 기술 관점 (ft-tech)

- 기존 인프라 활용 확장 (Phase N 설계를 보고 어떤 확장이 자연스러운지)
- 성능 최적화
- 데이터 파이프라인 구축
- A/B 테스트 인프라
- 기술 부채 해소
- 새로운 기술 도입 기회

### Step 5: Multi-Agent Parallel Analysis (4 agents)

4개 에이전트를 병렬로 실행. 각 에이전트는 `product-planning-god` subagent_type 사용.

각 에이전트에게 전달:
- 기획서 전문
- BE 설계 문서 전문
- FE 설계 문서 전문
- 사전 확인 답변 (우선순위, 리소스 등)
- Step 4 초기 분석 결과 (담당 관점 섹션)
- (있으면) 기획 리뷰에서 넘어온 보류 항목 목록 (`ft-def*`): "기획 리뷰 단계에서 보류 처리된 항목들입니다. 이 항목들을 해당 관점에서 다음 버전 기능으로 발전시킬 수 있는지 평가하고, 가능하면 제안에 포함하세요."
- 지시: "초기 분석에 없는 새로운 기능 후보를 추가로 찾아라. 기존 설계를 구체적으로 참조하여 '이 테이블/API/컴포넌트를 확장하면 된다'는 수준으로 기술적 실현 가능성을 설명하라."

1. **Agent MKT — 마케팅 관점**
   Focus: 바이럴 루프, 레퍼럴, 브랜드 포지셔닝, 유저 그로스, 시즌/이벤트, 크로스 프로모션. 기존 설계의 어떤 테이블/API/컴포넌트를 확장하면 되는지 구체적으로 제시.

2. **Agent OPS — 운영 관점**
   Focus: 자동화, 모니터링, CS 효율화, 비용 절감, 어뷰징 방지, 내부 관리 도구. 운영 비용 절감 효과를 정량적으로 추정.

3. **Agent SVC — 서비스 기획 관점**
   Focus: 사용자 여정 갭, 리텐션 훅, 인게이지먼트 루프, 커뮤니티, 개인화/추천, 핵심 기능 고도화. 사용자 스토리와 기대 지표를 구체적으로 제시.

4. **Agent TECH — 기술 관점**
   Focus: 인프라 확장, 성능 최적화, 데이터 파이프라인, A/B 테스트, 기술 부채, 신기술 도입. 기존 BE/FE 설계를 참조하여 확장 포인트를 구체적으로 명시.

각 에이전트 결과를 초기 분석과 병합.

### Step 6: HTML Report Output

출력 위치: `{input_doc_dir}/{project_name}_plan/` (Step 1에서 추출한 project_name 사용)

**Shell existence check:**
- `{project_name}_plan/index.html`이 있으면: `<div class="tab-panel" id="panel-features">...</div>` 블록 교체 + `<script type="application/json" id="state-features">` 블록 갱신
- 없으면: `${CLAUDE_SKILL_DIR}/template.html` 기반으로 전체 셸 생성 (이 경우 panel-features만 채우고 나머지 탭은 빈 상태)

**localStorage STORAGE_KEY:** `'{project_name}-plan-state-v1'`

**Each feature proposal item HTML structure:**

```html
<h3 id="ft-{cat}{N}">ft-{cat}{N}. 기능 제목</h3>
<span class="tag tag-{marketing|ops|service|tech}">카테고리</span>
<p>요약 — 기능 설명 2~3문장</p>
<blockquote>
  <strong>사용자 스토리:</strong> As [역할], I want [행동], so that [효과]
</blockquote>
<h4>기존 기반 분석</h4>
<p>Phase N의 어떤 설계(테이블명, API 엔드포인트, 컴포넌트명 등)를 어떻게 확장/활용하는지</p>
<h4>실현 가능성 평가</h4>
<table>
  <tr><th>항목</th><th>평가</th><th>비고</th></tr>
  <tr><td>개발 공수</td><td>S/M/L</td><td>...</td></tr>
  <tr><td>기존 설계 의존성</td><td>낮음/보통/높음</td><td>...</td></tr>
  <tr><td>리스크</td><td>낮음/보통/높음</td><td>...</td></tr>
</table>
<h4>기대 효과</h4>
<!-- 지표 테이블 또는 mermaid 다이어그램 -->
<div class="callout callout-{green|orange|red}">
  <strong>결론:</strong> [build | skip | defer-to-next-phase] — 이유
</div>
```

**Issue ID rules:**
- 마케팅: `ft-mkt1`, `ft-mkt2`, ...
- 운영: `ft-ops1`, `ft-ops2`, ...
- 서비스: `ft-svc1`, `ft-svc2`, ...
- 기술: `ft-tech1`, `ft-tech2`, ...

**panel-features structure:**

```html
<div class="tab-panel" id="panel-features">
  <h1>다음버전</h1>
  <div class="meta">...</div>
  <div class="filter-bar" id="filterBar-features">...</div>
  <h2 id="part-ft-mkt">마케팅 관점</h2>
  <!-- ft-mkt items -->
  <h2 id="part-ft-ops">운영 관점</h2>
  <!-- ft-ops items -->
  <h2 id="part-ft-svc">서비스 기획 관점</h2>
  <!-- ft-svc items -->
  <h2 id="part-ft-tech">기술 관점</h2>
  <!-- ft-tech items -->
  <h2 id="ft-summary">요약</h2>
  <!-- 관점별 제안 수, 추천/보류/제외 집계 테이블 -->
  <h2 id="ft-changelog">Changelog</h2>
</div>
```

**State data:** Use `<script type="application/json" id="state-features">{...}</script>` block. When creating the shell, populate with `{{INITIAL_STATE_FEATURES_JSON}}`. When replacing the panel, update this block with the new state JSON.

## Rules

- All report content (titles, descriptions, conclusions) should match the user's language
- Feature proposals must reference specific Phase N design elements (table names, API endpoints, component names)
- Distinguish between "build" (immediately valuable), "defer" (valuable but not now), and "skip" (not worth doing)
- Confirm existing Phase scope with user to avoid duplicate proposals
- If review-plan JSON is provided, check deferred/dismissed items as potential feature candidates
- The HTML report template (CSS, JS, interactive features) comes from template.html

## Review Cycle

리포트 생성 → 사용자 브라우저 리뷰(상태+메모) → JSON export → 반영(메모는 decision-log에만 기록, body 수정 없음)

**문서 작성이 필요하면:** `/write-doc features {json경로} {원본문서경로}` 를 별도로 실행하세요.
리뷰 사이클이 충분히 진행된 후, 또는 팀 회의 직후 문서화가 필요한 시점에 호출합니다.

### JSON Apply Rules

When the user provides an exported JSON review file:

#### Issue content updates
- If the memo **confirms a previously undefined item or changes the direction**: update the issue's HTML body (verdict, conclusion callout, etc.) to reflect the decision
  - Summarize the **previous content** in 2–3 sentences and add it to the issue's `decision-log`
- If the memo is **informational only** (e.g., "추후 검토", "보류"): do NOT modify the issue body — only add a log entry

#### Decision log format
Add a `<div class="decision-log">` section to each issue:

```html
<div class="decision-log">
  <div class="decision-log-title">결정 이력</div>
  <div class="decision-entry">
    <span class="decision-date">YYYY-MM-DD</span>
    <span class="decision-status decision-status-{status}">상태레이블</span>
    <span class="decision-memo">메모 요약 또는 변경 내용</span>
  </div>
</div>
```

#### Sidebar rebuild
After applying JSON, rebuild the sidebar to use status-based collapsible groups.

## Versioning & Changelog

Every report includes a version number and a changelog section at the bottom.

**Version format:** `MAJOR.MINOR.PATCH`
- **MAJOR** — analysis scope or perspective structure changes
- **MINOR** — features added, removed, or significantly rewritten
- **PATCH** — minor wording fixes, conclusion adjustments, priority changes

**Changelog rules:**
- The changelog tracks **content changes**, not HTML/CSS/JS changes
- Each entry: version, date, brief description of what changed
- Initial analysis is always v1.0.0
- When the user reviews and requests changes, bump the version and add a changelog entry
- The version is displayed in: sidebar logo area, meta line, changelog table

**Changelog location:** After the summary table, as an `<h2>` with id `ft-changelog`.
