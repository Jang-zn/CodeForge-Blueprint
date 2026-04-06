# CodeForge Blueprint

아이디어를 구조화된 PRD, 백엔드/프론트엔드 아키텍처, 다음 버전 기능 제안서로 만들어주는 로컬 브라우저 대시보드. AI CLI를 백엔드로 사용합니다.

## 요구사항

- Node.js 18+
- AI CLI 중 하나 이상 설치:

| CLI | 설치 |
|-----|------|
| [Claude Code CLI](https://docs.anthropic.com/en/claude-code) | `npm install -g @anthropic-ai/claude-code` |
| [Codex CLI](https://github.com/openai/codex) | `npm install -g @openai/codex` |

## 사용법

```bash
# 인자 없이 실행 — 브라우저에서 폴더 선택
npx codeforge-blueprint

# 폴더를 미리 지정해서 바로 시작
npx codeforge-blueprint ~/projects/my-app

# 포트 지정
npx codeforge-blueprint --port 4000
```

대시보드가 자동으로 브라우저에서 열립니다. 폴더를 지정하지 않으면 VS Code처럼 폴더 선택 화면이 표시되며, 최근 항목을 클릭하거나 경로를 직접 입력해 워크스페이스를 열 수 있습니다. 생성된 파일은 모두 `{workspace}/docs/` 에 저장됩니다.

## 파이프라인

```
Init (PRD 생성/코드베이스 스캔) → 기획 리뷰 → BE 설계 → FE 설계 → 다음버전 기능 제안 → 문서 생성 (폴더 단위)
```

### Init — PRD 생성 (3가지 방식)

| 방식 | 설명 | AI 토큰 |
|------|------|---------|
| **가이드 폼** | 서비스 유형·타겟·수익 모델·기술 스택·상세 기획을 폼에 입력 → AI가 PRD 초안 생성 | 사용 |
| **기획서 임포트** | 이미 작성된 `.md`/`.txt` 기획서 파일을 불러오기 | 없음 |
| **코드베이스 스캔** | 이미 코드가 있는 프로젝트 → 코드 구조를 분석해 PRD + 온보딩 문서를 역추출 | 사용 |

**코드베이스 스캔**은 2단계로 동작합니다:
1. **Phase 1 (스캔)** — 파일시스템만 읽어 프로젝트 구조·의존성·README를 분석 (토큰 0)
2. **Phase 2 (생성)** — 사용자 확인 후 AI가 PRD + 온보딩 가이드 작성 (섹션 10개, 코드 구조 투어 포함)

생성되는 PRD에는 **신규 팀원 온보딩 가이드**(코드베이스 구조, 핵심 데이터 흐름, 개발 컨벤션, 자주 쓰는 명령어, TODO 목록)가 포함됩니다.

### 분석 파이프라인

1. **기획 리뷰** — AI가 PRD를 6가지 관점(기획 정합성, 수익/과금, 사용자 획득/유지, 구현 가능성, 운영 확장성, 법적/규제)으로 분석. 브라우저에서 각 이슈의 상태와 메모를 직접 관리
2. **BE / FE 설계** — 백엔드(API, DB, 인프라, 라이브러리, 서비스 레이어)와 프론트엔드(컴포넌트, 상태 관리, 라우팅, API 연동, 디자인 시스템) 아키텍처 분석
3. **다음버전** — 마케팅, 운영, 서비스 기획, 기술 4가지 관점의 다음 버전 기능 제안. 기획 리뷰에서 보류된 항목이 자동으로 포함됨
4. **반영하기** — 리뷰 결과 반영: 결정 로그 기록, 보류 항목 다음버전 탭으로 이동, 버전 업

### 문서 생성 (폴더 단위)

문서 생성 시 단일 대형 파일이 아닌 **폴더 단위로 섹션별 파일을 분리**하여 독립적인 리뷰가 가능합니다:

```
docs/backend-v1.0.0/
├── index.md              ← 목차 + 아키텍처 개요
├── 01-api-design.md      ← API 설계
├── 02-db-schema.md       ← DB 스키마 + ERD (Mermaid)
├── 03-infra.md           ← 인프라
├── 04-libraries.md       ← 라이브러리
├── 05-service-layer.md   ← 서비스 레이어
├── 06-needs-review.md    ← 검토 필요 항목
└── 07-deferred.md        ← 다음 Phase 이관
```

각 파일은 독립적으로 읽을 수 있으며, `index.md`에서 모든 섹션으로의 상대 링크 목차를 제공합니다.

## 모델 선택

헤더 드롭다운에서 AI 백엔드를 언제든 전환할 수 있습니다. 선택 사항은 서버 재시작 후에도 유지됩니다.

**Claude 모델** (Claude Code CLI 필요):
- Claude Sonnet 4.6 *(기본값)*
- Claude Opus 4.6

**Codex 모델** (Codex CLI 필요):
- GPT-5.4

설치되지 않은 CLI의 옵션은 자동으로 비활성화됩니다.

## 워크스페이스 구조

```
~/projects/my-app/              ← 워크스페이스 루트
├── docs/
│   ├── .codeforge/
│   │   └── data.db             ← SQLite (이슈, 결정 로그, 버전, 모델 설정)
│   ├── prd-v0.1.0.md           ← 초기 PRD
│   ├── review-v1.1.0/          ← 기획 리뷰 반영 (폴더)
│   │   ├── index.md
│   │   ├── 01-service-overview.md
│   │   ├── 02-target-users.md
│   │   └── ...
│   ├── backend-v1.0.0/         ← BE 설계 (폴더)
│   │   ├── index.md
│   │   ├── 01-api-design.md
│   │   └── ...
│   ├── frontend-v1.0.0/        ← FE 설계 (폴더)
│   └── features-v1.0.0/        ← 다음버전 (폴더)
└── ...
```

## 개발

```bash
git clone https://github.com/your-org/codeforge-blueprint
cd codeforge-blueprint
npm install

# dev 모드 실행 (빌드 불필요)
npm run dev -- ~/projects/my-app

# 빌드
npm run build

# 테스트
npm test
```

## 아키텍처

```
로컬 서버 (Hono + @hono/node-server)
├── 정적 파일 서빙 (대시보드)
├── REST API (워크스페이스, 이슈 CRUD, 잡 폴링)
├── Provider Spawner
│   ├── Claude CLI  (claude -p --output-format json)
│   └── Codex CLI   (codex exec --json --full-auto --ephemeral)
└── SQLite (better-sqlite3)
        ↕ REST API                    ↕ child_process.spawn
  브라우저 대시보드               AI CLI (Claude / Codex)
  (리뷰 / 상태 관리)              (분석 및 문서 생성)
```

**런타임 의존성 (4개):** `hono`, `@hono/node-server`, `better-sqlite3`, `open`

## 라이선스

MIT
