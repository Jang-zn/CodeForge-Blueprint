---
name: design-frontend
description: |
  확정된 기획서를 기반으로 프론트엔드 아키텍처를 설계합니다. 화면/컴포넌트 계층, 상태 관리, 라우팅, API 연동 레이어, 디자인 시스템을 분석하고 리뷰 가능한 설계 문서를 생성합니다.
  TRIGGER when: (1) 기획서 기반 FE 설계 요청 시. (2) /design-frontend 직접 호출.
  DO NOT TRIGGER when: 기획 리뷰, 코드 리뷰, BE 설계, 버그 분석.
argument-hint: [path to PRD] [optional: path to BE design doc]
---

# FE 설계 Skill

확정된 기획서와 (선택적으로) BE 설계 문서를 입력받아, 프론트엔드 아키텍처를 5개 섹션으로 분석하고 인터랙티브 HTML 리포트를 생성합니다.

## Execution Flow

### Step 1: Input

- `$ARGUMENTS`에서 기획서 경로 파싱. BE 설계 문서 경로는 선택
- 경로가 없거나 파일이 존재하지 않으면 사용자에게 요청
- 추가 입력 (선택): 이전 Phase FE 설계 문서 경로, FE 기술 스택 문서 경로
- **review-plan Ref 항목 자동 추출**: 기획서와 같은 폴더의 `{project_name}_plan/index.html`이 존재하면, `<script id="state-review">` 블록에서 `refItems` 배열을 추출한다. 없으면 무시.

### Step 2: Pre-analysis Confirmation

분석 전 사용자에게 확인:
- 타겟 플랫폼: React Native / Flutter / Web(React/Next.js/Vue 등) — 상태관리 전략, 라우팅 방식이 달라짐
- 상태관리 라이브러리 선호 (예: Zustand, Redux, Jotai, Riverpod 등 플랫폼에 맞게)
- 디자인 시스템 기존 자산 여부 (Figma 파일, 기존 컴포넌트 라이브러리)
- BE API 설계 완료 여부 (있으면 경로)

### Step 3: Document Reading & Context

- 기획서 전문 읽기
- (있으면) BE 설계 문서 전문 읽기 → API 엔드포인트 목록 파악
- (있으면) 이전 Phase FE 설계 문서 읽기 → 확장/변경 포인트 파악
- (있으면) FE 기술 스택 문서 읽기
- **review-plan Ref 항목 섹션 배분**: Step 1에서 추출한 `refItems`가 있으면 아래 매핑에 따라 각 섹션 분석에 포함:
  - 뒤로가기/back-button → **C. 네비게이션/라우팅 (fe-route)**
  - 화면 간 상태 동기화 → **B. 상태 관리 (fe-state)**
  - 네트워크 단절 처리 → **D. API 연동 레이어 (fe-api)**
  - 다크모드 → **E. 디자인 시스템 (fe-token)**
  - 터치 타겟 / 접근성(a11y) → **A. 화면/컴포넌트 계층 (fe-comp)**
  - 매핑이 불명확한 항목은 가장 관련 있는 섹션에 배치
  
  배분된 Ref 항목은 해당 섹션 에이전트 브리핑에 포함한다.

### Step 4: Initial Analysis — 5 Sections

#### A. 화면/컴포넌트 계층 (fe-comp)

- 기획서의 사용자 흐름에서 화면 인벤토리 도출
- 화면 계층 구조 (mermaid 다이어그램)
- 공용 컴포넌트 후보 (여러 화면에서 재사용되는 것들)
- 화면 → 컴포넌트 매핑 테이블

#### B. 상태 관리 (fe-state)

- 글로벌 상태 vs 로컬 상태 경계 결정
- 도메인별 상태 형태 정의 (예: 사용자 정보, 피드 데이터, 구독 상태)
- 서버 상태 캐시 전략 (React Query / SWR 등 해당하는 경우)
- 낙관적 업데이트(Optimistic update) 적용 대상

#### C. 네비게이션/라우팅 (fe-route)

- 네비게이션 스택 구조 (mermaid 다이어그램)
- 딥링크 스키마 (모바일 앱인 경우)
- 탭바/드로어/스택 구조
- 인증 게이트 라우트 (로그인 필요 화면 정의)
- 딥링크 → 화면 매핑 테이블

#### D. API 연동 레이어 (fe-api)

- API 클라이언트 아키텍처 (레이어 구조)
- 공통 요청/응답 타입 정의 방법
- 에러 핸들링 전략 (글로벌 vs 로컬, 에러 타입별 처리)
- 로딩/성공/실패 상태 관리 패턴
- (BE 설계 문서 있으면) 주요 API 별 FE 연동 방법 구체화

#### E. 디자인 시스템 (fe-token)

- 컬러 토큰 (Primary, Secondary, Semantic 등)
- 타이포그래피 스케일
- 스페이싱 스케일
- 주요 컴포넌트 변형 정의 (버튼, 인풋, 카드, 모달 등)
- 다크모드 토큰 매핑 (지원하는 경우)
- 반응형 브레이크포인트

### Step 5: Multi-Agent Parallel Analysis (5 agents)

5개 에이전트를 병렬로 실행. 각 에이전트는 `frontend-wizard` subagent_type 사용.

각 에이전트에게 전달:
- 기획서 전문
- (있으면) BE 설계 문서 전문
- 사전 확인 답변 (플랫폼, 상태관리 선택 등)
- Step 4의 해당 섹션 초기 분석 결과
- (있으면) 해당 섹션에 배분된 review-plan Ref 항목 목록 — "기획 리뷰 단계에서 FE 참고 사항으로 플래그된 항목입니다. 설계에 반드시 반영하세요."
- 지시: "초기 분석을 검토하고 누락된 화면, 상태 관리 이슈, UX 패턴 등을 추가로 찾아라. 선택한 플랫폼과 라이브러리에 맞는 구체적인 구현 방법을 제시하라."

1. **Agent A — 화면/컴포넌트 계층**
   Focus: 화면 인벤토리 누락, 공용 컴포넌트 후보 추가, 화면 간 의존 관계, 컴포넌트 depth 최적화, 플랫폼별 화면 구조 차이.

2. **Agent B — 상태 관리**
   Focus: 글로벌/로컬 상태 경계 재검토, 서버 상태 캐시 전략 구체화, 낙관적 업데이트 대상 검증, 상태 정규화 전략, 상태 동기화 이슈.

3. **Agent C — 네비게이션/라우팅**
   Focus: 딥링크 누락, 인증 게이트 누락 화면, 탭/스택 전환 엣지케이스, 뒤로가기 동작 정의, 네비게이션 상태 복원.

4. **Agent D — API 연동 레이어**
   Focus: API 클라이언트 구조 개선, 에러 핸들링 구체화, 로딩 상태 패턴, 재시도 전략, 오프라인 대응, BE API와의 정합성 검증.

5. **Agent E — 디자인 시스템**
   Focus: 토큰 누락, 컴포넌트 변형 추가, 접근성(a11y) 고려, 다크모드 커버리지, 반응형 브레이크포인트 검증, 플랫폼별 디자인 가이드라인 준수.

결과를 병합하여 최종 설계 작성.

### Step 6: HTML Report Output

Generate HTML based on `${CLAUDE_SKILL_DIR}/template.html`.

**Output location:** `{input_doc_dir}/{project_name}_plan/`
- Project name extraction: 입력 문서 파일명에서 첫 `_` 앞 세그먼트
  - 예: `kkumi_requirements_v1.1.md` → `kkumi` → `kkumi_plan/`

**Shell existence check:**
- `{project_name}_plan/index.html` 있으면: `<div class="tab-panel" id="panel-frontend">` 블록 교체 + `<script type="application/json" id="state-frontend">` 블록 갱신
- 없으면: `${CLAUDE_SKILL_DIR}/template.html` 기반 전체 셸 생성 (`index.html`, `styles.css`, `app.js`)

**localStorage key:** `'{project_name}-plan-state-v1'`

**Each design item HTML structure:**
```html
<h3 id="fe-{cat}{N}">fe-{cat}{N}. 설계 결정 제목</h3>
<span class="tag tag-decision">결정</span>  <!-- 또는 tag-trade-off, tag-dependency -->
<span class="badge badge-{confirmed|proposed|alternative}">Confirmed</span>
<p>설명 — 설계 결정 내용 2~3문장</p>
<h4>근거</h4>
<p>왜 이 결정인지. 선택한 플랫폼/라이브러리와의 연관성.</p>
<div class="diagram-container"><pre class="mermaid">...</pre></div>  <!-- 해당하는 경우 -->
<table>...</table>  <!-- 해당하는 경우 -->
<div class="callout callout-{blue|orange|red}">
  <strong>트레이드오프:</strong> 대안과 비교한 선택 이유
</div>
```

**Issue ID patterns:**
- 화면/컴포넌트: `fe-comp1`, `fe-comp2`, ...
- 상태 관리: `fe-state1`, `fe-state2`, ...
- 라우팅: `fe-route1`, `fe-route2`, ...
- API 연동: `fe-api1`, `fe-api2`, ...
- 디자인 시스템: `fe-token1`, `fe-token2`, ...

**panel-frontend structure:**
```html
<div class="tab-panel" id="panel-frontend">
  <h1>FE 설계</h1>
  <div class="meta">...</div>
  <div class="filter-bar" id="filterBar-frontend">...</div>
  <h2 id="part-fe-comp">A. 화면/컴포넌트 계층</h2>
  <h2 id="part-fe-state">B. 상태 관리</h2>
  <h2 id="part-fe-route">C. 네비게이션/라우팅</h2>
  <h2 id="part-fe-api">D. API 연동 레이어</h2>
  <h2 id="part-fe-token">E. 디자인 시스템</h2>
  <h2 id="fe-summary">요약</h2>
  <h2 id="fe-changelog">Changelog</h2>
</div>
```

## Rules

- 모든 설계 내용은 사용자의 언어에 맞춰 작성. 한국어 문서면 한국어, 영어면 영어.
- 화면 디자인/레이아웃의 심미적 판단은 하지 않음 — 구조와 아키텍처에 집중.
- 선택한 플랫폼과 라이브러리에 맞는 구체적인 구현 방법 제시.
- BE 설계 문서가 있으면 API 엔드포인트와의 정합성 반드시 검증.
- 이전 Phase FE 설계 문서가 있으면 확장/변경 포인트 명시.

## Review Cycle

HTML 리뷰 → JSON export → 반영 (메모는 decision-log에만 기록, body 수정 없음)

**문서 작성이 필요하면:** `/write-doc frontend {json경로} {원본문서경로}` 를 별도로 실행하세요.
리뷰 사이클이 충분히 진행된 후, 또는 팀 회의 직후 문서화가 필요한 시점에 호출합니다.

## JSON Apply Rules

JSON export 파일 적용 시:
- Issue body는 어떤 경우에도 수정하지 않음
- 모든 메모는 decision-log entry로만 기록

### Decision log format

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

### Sidebar rebuild
JSON 적용 후 사이드바를 status-based collapsible groups로 재구성.

### Version bump
MINOR 버전 올리고 변경사항 changelog 항목 추가.

## Versioning & Changelog

**Version format:** `MAJOR.MINOR.PATCH`
- **MAJOR** — 분석 범위 또는 섹션 구조 변경
- **MINOR** — 설계 아이템 추가/제거/대폭 수정
- **PATCH** — 문구 수정, 상태 변경, 결론 조정

초기 분석: v1.0.0. Changelog는 요약 테이블 뒤, `<h2 id="fe-changelog">` 위치.
