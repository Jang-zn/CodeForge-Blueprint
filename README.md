# CodeForge Blueprint

아이디어를 구조화된 PRD, 백엔드/프론트엔드 아키텍처, 다음 버전 기능 제안서로 만들어주는 AI 기획 도구. **데스크톱 앱 설치** 또는 **CLI 실행** 두 가지 방식을 지원합니다.

---

## 목차

- [설치 & 실행](#설치--실행)
- [요구사항](#요구사항)
- [파이프라인 — 전체 흐름](#파이프라인--전체-흐름)
- [탭별 상세 기능](#탭별-상세-기능)
- [이슈 관리 (Draft / Applied)](#이슈-관리-draft--applied)
- [리뷰 사이클](#리뷰-사이클)
- [결정 타임라인 & 히스토리](#결정-타임라인--히스토리)
- [분석 관점 커스터마이징](#분석-관점-커스터마이징)
- [문서 생성](#문서-생성)
- [모델 선택](#모델-선택)
- [워크스페이스 구조](#워크스페이스-구조)
- [앱 데이터 경로](#앱-데이터-경로)
- [개발](#개발)
- [아키텍처](#아키텍처)
- [라이선스](#라이선스)

---

## 설치 & 실행

### 방법 1: 데스크톱 앱 (권장)

[Releases](../../releases) 페이지에서 OS에 맞는 설치 파일을 다운로드합니다.

| OS | 파일 |
|----|------|
| macOS (Apple Silicon) | `CodeForge Blueprint-x.x.x-arm64.dmg` |
| macOS (Intel) | `CodeForge Blueprint-x.x.x.dmg` |
| Windows | `CodeForge Blueprint Setup x.x.x.exe` |

> macOS는 터미널에서 `uname -m` 실행 — `arm64`면 Apple Silicon, `x86_64`면 Intel.

> **macOS — "열지 않음" 경고:** 앱 공증이 없어서 Gatekeeper가 차단합니다.
> **시스템 설정 → 개인 정보 보호 및 보안** 하단의 **"그래도 열기"**를 클릭하세요.

> 직접 빌드: `npm install && npm run electron:build -- --mac` (또는 `--win`)

### 방법 2: CLI + 브라우저

```bash
# 인자 없이 실행 — 브라우저에서 폴더 선택
npx codeforge-blueprint

# 폴더를 미리 지정해서 바로 시작
npx codeforge-blueprint ~/projects/my-app

# 포트 지정
npx codeforge-blueprint --port 4000
```

---

## 요구사항

- **Node.js 18+**
- AI CLI 중 하나 이상 설치 + **해당 서비스 구독 필요**:

| CLI | 설치 | 구독 |
|-----|------|------|
| [Claude Code CLI](https://docs.anthropic.com/en/claude-code) | `npm install -g @anthropic-ai/claude-code` | [Anthropic Max 플랜](https://www.anthropic.com/pricing) 또는 API 키 |
| [Codex CLI](https://github.com/openai/codex) | `npm install -g @openai/codex` | [OpenAI Pro/Plus 플랜](https://openai.com/pricing) 또는 API 키 |

> **참고:** CLI 설치만으로는 동작하지 않습니다. 각 CLI에서 인증(`claude login` / `codex auth`)을 완료해야 AI 기능을 사용할 수 있습니다.

데스크톱 앱에서는 시작 시 CLI 설치 여부를 자동 감지합니다 (macOS Finder/Dock 실행 시에도 PATH 자동 해결).

---

## 파이프라인 — 전체 흐름

```
Init (PRD 생성)
  │
  ▼
기획 리뷰 ──analyze──▶ 이슈 검토 ──apply──▶ 문서 생성
  │                                            │
  ▼                                            ▼
BE 설계 ───analyze──▶ 이슈 검토 ──apply──▶ 문서 생성
  │                                            │
  ▼                                            ▼
FE 설계 ───analyze──▶ 이슈 검토 ──apply──▶ 문서 생성
  │                                            │
  ▼                                            ▼
다음버전 ──analyze──▶ 이슈 검토 ──apply──▶ 문서 생성
```

각 탭은 **분석 → 검토 → 반영 → 문서 생성**의 사이클을 반복하며, 이전 탭의 결과가 다음 탭의 컨텍스트에 자동 포함됩니다.

### Init — PRD 생성 (3가지 방식)

| 방식 | 설명 | AI 토큰 |
|------|------|---------|
| **가이드 폼** | 서비스 유형·타겟·수익 모델·기술 스택·상세 기획을 5단계 폼에 입력 → AI가 PRD 초안 생성 | 사용 |
| **기획서 임포트** | 이미 작성된 `.md`/`.txt` 기획서 파일을 불러오기 | 없음 |
| **코드베이스 스캔** | 이미 코드가 있는 프로젝트 → 코드 구조를 분석해 PRD + 온보딩 문서를 역추출 | 사용 |

**가이드 폼 5단계:**

1. **프로젝트 기본 정보** — 이름, 한 줄 소개, 서비스 유형 (웹 풀스택, 모바일, CLI, 게임 등 14종)
2. **사업 모델** — 타겟 사용자(B2C/B2B/개발자/사내/개인), 수익 모델(8종), 핵심 기능 영역(13종)
3. **서비스 동작** — 데이터 저장, 로그인, 다중 사용자, 이용 환경, 알림, 결제 등 (초보자 친화적 설명 포함)
4. **상세 기획** — 자유 서술 (필수, AI 프롬프트의 핵심 입력)
5. **기술 선호** — FE/BE/스토리지 기술 선택 (선택사항, 개발자용)

**코드베이스 스캔 2단계:**

1. **Phase 1 (스캔)** — 파일시스템만 읽어 프로젝트 구조·의존성·README를 분석 (토큰 0)
2. **Phase 2 (생성)** — 사용자 확인 후 AI가 PRD + 온보딩 가이드 작성 (섹션 10개, 코드 구조 투어 포함)

내장 템플릿 5종(SaaS, 이커머스, 콘텐츠 플랫폼, 사내 도구, 사이드 프로젝트)이 서비스 유형에 따라 자동 제안됩니다.

---

## 탭별 상세 기능

### 1. 기획 리뷰 (Plan Review)

PRD를 다각도로 분석하여 개선 이슈를 도출합니다.

**기본 분석 관점 (6개):**
- 기획 정합성 — 서비스 목표·기능·가치의 논리적 일관성
- MVP 범위 — 최소 기능 범위의 적절성
- 구현 가능성 — 기술적 실현 가능성 점검
- 운영 부담 — 런칭 후 운영/확장성
- 사용자 가치 명확성 — 핵심 가치 전달 여부
- 런치 리스크 — 초기 출시 위험 요소

분석 후 각 이슈에 대해 **확정/검토중/보류/삭제** 상태를 판단하고, "반영하기"로 확정합니다. 보류된 항목은 자동으로 **다음버전** 탭으로 이동합니다.

### 2. BE 설계 (Backend Design)

기획 리뷰 결과를 기반으로 백엔드 아키텍처를 분석합니다.

**분석 관점 (5개):** API 설계, DB 스키마, 인프라, 라이브러리, 서비스 레이어

**생성 문서 섹션:**
- API 설계, DB 스키마 + ERD (Mermaid), 인프라, 라이브러리, 서비스 레이어, 검토 필요 항목, 다음 Phase 이관

### 3. FE 설계 (Frontend Design)

BE 설계 결과까지 포함한 컨텍스트로 프론트엔드 아키텍처를 분석합니다.

**분석 관점 (5개):** 컴포넌트 계층, 상태 관리, 라우팅, API 연동, 디자인 시스템

### 4. 다음버전 (Features / Next Version)

이전 탭들에서 보류된 항목 + 새로운 기능 제안을 종합합니다.

**분석 관점 (4개):** 마케팅, 운영, 서비스 기획, 기술

**전용 상태 시스템:**

다음버전 탭은 일반 이슈 상태(확정/보류/삭제) 외에 추가 상태를 지원합니다:

| 상태 | 설명 |
|------|------|
| `candidate` (Build 후보) | 다음 버전에 포함 검토 대상 |
| `promoted` (승격) | 다음 버전에 확정 반영 |
| `archived` (보관) | 현재는 제외, 기록만 남김 |

이 상태들은 다른 탭(기획 리뷰/BE/FE)에서는 사용할 수 없으며, 서버가 탭별 상태 유효성을 검증합니다.

---

## 이슈 관리 (Draft / Applied)

이슈의 상태 변경은 **즉시 반영되지 않습니다.** Draft(초안)와 Applied(확정) 두 단계로 분리되어 안전하게 관리됩니다.

### 흐름

```
이슈 상태/메모 변경  →  Draft (issue_preview)에 저장
        │
        ▼
  "반영하기" 클릭  →  Issues 테이블에 확정 반영
                      + 결정 로그 기록
                      + 보류 항목 → 다음버전 자동 이동
                      + 탭 버전 번호 증가
```

### 주요 동작

- **상태 변경 시**: 브라우저에서 즉시 UI가 반영되지만, 실제 데이터는 `issue_preview` 테이블에 임시 저장
- **새로고침해도 유지**: Draft는 DB에 저장되므로 새로고침 후에도 변경 전/후를 구분 가능
- **Draft 되돌리기**: 상태를 원래 applied 상태로 되돌리면 draft 자동 삭제
- **반영 전 분석/생성 차단**: 미반영 draft가 있으면 "분석하기"와 "문서 생성"이 비활성화됨 → 반영하기를 먼저 실행해야 함
- **반영 미리보기**: "반영하기" 전에 변경 내역과 전후 메트릭을 미리 확인 가능

### 상태 목록

| 상태 | 라벨 | 설명 |
|------|------|------|
| `pending` | 미검토 | 아직 판단하지 않은 이슈 |
| `reviewing` | 검토중 | 검토 진행 중 (메모로 의견 기록) |
| `resolved` | 확정 | 이 방향으로 진행 확정 |
| `deferred` | 보류 | 다음 버전으로 이관 |
| `dismissed` | 삭제 | 이 이슈를 문서에서 제외 |
| `candidate` | Build 후보 | (다음버전 탭 전용) 포함 검토 대상 |
| `promoted` | 승격 | (다음버전 탭 전용) 확정 반영 |
| `archived` | 보관 | (다음버전 탭 전용) 제외, 기록 보관 |

---

## 리뷰 사이클

각 탭은 **분석 → 반영 → 문서 생성**을 하나의 사이클로 추적합니다. 화면 우측 하단 FAB 영역에 현재 사이클 번호가 표시됩니다.

### 사이클 상태 전이

```
[신규/재시작]
     │
     ▼
  analyzing  ── 분석 실패 ──▶  failed
     │
     ▼ (분석 완료 + 반영하기)
  applied    ── 재분석 ──▶  새 사이클 생성 (rollover)
     │
     ▼ (문서 생성)
  completed
```

- **analyzing**: AI 분석 진행 중. 같은 탭에서 재분석하면 기존 analyzing 사이클을 재사용
- **applied**: 이슈 결정이 반영됨. 이 상태에서 다시 분석하면 **새 사이클** 생성 (rollover)
- **completed**: 문서까지 생성 완료. 사이클에 생성된 문서 ID가 연결됨
- **failed**: 분석 실패 시 사이클이 닫힘. 재시도 시 새 사이클 생성

각 결정 로그에는 어떤 사이클에서 발생했는지 `cycle_id`가 기록되어, 나중에 사이클 단위로 판단 이력을 추적할 수 있습니다.

---

## 결정 타임라인 & 히스토리

### 이슈별 타임라인

각 이슈의 "히스토리" 버튼을 클릭하면 해당 이슈의 **스냅샷 + 결정 로그**를 시간순으로 통합한 타임라인을 확인할 수 있습니다.

- **스냅샷**: AI가 분석할 때마다 이슈의 당시 상태(제목, 내용, 우선순위 등)를 자동 캡처
- **결정 로그**: 사용자가 "반영하기"를 실행할 때마다 상태 변경 + 메모가 기록됨
- 같은 날짜 내에서는 생성 순서(seq)로 안정 정렬

### 전역 결정 타임라인 (사이드바 "결정 타임라인" 탭)

모든 탭에 걸친 결정 이력을 필터링하여 조회할 수 있습니다:

- 탭별 필터 (기획 리뷰 / BE / FE / 다음버전)
- 상태별 필터 (확정 / 보류 / 삭제 등)
- 날짜 범위 필터
- 페이지네이션
- 결정 통계 (탭별/상태별 집계)
- 보류 항목 리마인더

---

## 분석 관점 커스터마이징

각 분석 탭(기획 리뷰·BE·FE·다음버전)에서 AI가 분석할 관점을 직접 제어할 수 있습니다.

- **기본 관점** — 잠금(🔒) 표시, 항상 활성. 비활성화 불가
- **커스텀 관점 추가** — `+ 커스텀 관점 추가` 버튼으로 이름·설명을 입력해 새 관점 생성
- **토글** — 각 관점을 켜고 끄면 다음 분석 시 해당 관점이 포함/제외
- **병렬 분석** — 활성화된 관점 수만큼 AI 프로세스를 병렬로 생성하여 동시 분석
- **내보내기** — 관점 변경 시 `perspectives.json`이 워크스페이스에 자동 저장 (팀 공유/백업)

---

## 문서 생성

문서 생성 시 단일 대형 파일이 아닌 **폴더 단위로 섹션별 파일을 분리**합니다:

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

**탭별 문서 구조:**

| 탭 | 섹션 수 | 주요 섹션 |
|----|---------|----------|
| 기획 리뷰 | 10 | 서비스 개요, 타겟 사용자, 서비스 범위, 기능 명세, 수익 모델, 기술 스택, 배포, 제약/리스크, KPI, 보류 항목 |
| BE 설계 | 7 | API 설계, DB 스키마+ERD, 인프라, 라이브러리, 서비스 레이어, 검토 필요, 다음 Phase |
| FE 설계 | 7 | 컴포넌트 계층, 상태 관리, 라우팅, API 연동, 디자인 시스템, 검토 필요, 다음 Phase |
| 다음버전 | 5 | 마케팅, 운영, 서비스, 기술, Phase N+2 후보 |

- 각 파일은 독립적으로 읽을 수 있도록 작성됨
- 버전 관리: 반영하기 → 문서 생성 시마다 버전 자동 증가 (v1.0.0, v1.1.0, ...)
- 문서 관리 탭에서 이전 버전과 diff 비교 가능

---

## 모델 선택

헤더 드롭다운에서 AI 백엔드를 언제든 전환할 수 있습니다. 선택은 재시작 후에도 유지됩니다.

| Provider | 모델 | CLI 필요 | 최대 프롬프트 |
|----------|------|----------|-------------|
| Claude | Claude Sonnet 4.6 *(기본)* | Claude Code CLI | ~200K 문자 |
| Claude | Claude Opus 4.6 | Claude Code CLI | ~200K 문자 |
| Codex | GPT-5.4 | Codex CLI | ~120K 문자 |

설치되지 않은 CLI의 옵션은 자동으로 비활성화됩니다.

---

## 워크스페이스 구조

```
~/projects/my-app/              ← 워크스페이스 루트
├── docs/
│   ├── .codeforge/
│   │   ├── data.db             ← SQLite (이슈, 결정 로그, 사이클, 스냅샷, 관점, 용어집)
│   │   └── perspectives.json   ← 분석 관점 내보내기 (자동 갱신)
│   ├── prd-v0.1.0.md           ← 초기 PRD
│   ├── review-v1.1.0/          ← 기획 리뷰 반영 문서 (폴더)
│   │   ├── index.md
│   │   ├── 01-service-overview.md
│   │   └── ...
│   ├── backend-v1.0.0/         ← BE 설계 문서 (폴더)
│   ├── frontend-v1.0.0/        ← FE 설계 문서 (폴더)
│   └── features-v1.0.0/        ← 다음버전 문서 (폴더)
└── (프로젝트 코드...)
```

---

## 앱 데이터 경로

| 실행 방식 | 앱 데이터(sessions, recents) |
|----------|------------------------------|
| 데스크톱 앱 (macOS) | `~/Library/Application Support/CodeForge Blueprint/` |
| 데스크톱 앱 (Windows) | `%APPDATA%\CodeForge Blueprint\` |
| CLI 브라우저 | `~/.codeforge-blueprint/` |

기존 CLI 모드로 사용 중이었다면 데스크톱 앱 최초 실행 시 `app.db`를 자동으로 새 경로로 복사합니다.

---

## 개발

```bash
git clone https://github.com/your-org/codeforge-blueprint
cd codeforge-blueprint
npm install
```

### 빌드 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | CLI + 브라우저 모드 개발 실행 (tsx, 빌드 불필요) |
| `npm run electron:dev` | Electron 데스크톱 앱 개발 실행 |
| `npm run build` | TypeScript 컴파일 + 에셋 복사 |
| `npm run electron:build` | 배포 패키지 생성 (`release/` 디렉토리에 DMG/NSIS) |
| `npm test` | 전체 테스트 실행 (247 tests) |

### 패키징 빌드

```bash
# macOS DMG (arm64 + x64 각각 생성)
npm run electron:build -- --mac

# Windows NSIS 설치 파일
npm run electron:build -- --win

# 양쪽 모두
npm run electron:build
```

빌드 결과물은 `release/` 디렉토리에 생성됩니다. `electron:build` 후 `npm rebuild better-sqlite3`가 자동 실행되어 Node.js용 네이티브 모듈이 복원됩니다.

### 환경변수

| 변수 | 설명 |
|------|------|
| `CODEFORGE_MOCK_PROVIDER=1` | AI 대신 mock 응답 사용 (테스트용) |
| `CODEFORGE_ELECTRON=1` | Electron 모드 (자동 설정) |
| `CODEFORGE_APP_DATA_DIR` | 앱 데이터 디렉토리 오버라이드 |
| `CODEFORGE_BLUEPRINT_HOME` | app.db 경로 오버라이드 (테스트용) |

### 프로젝트 구조

```
src/
├── cli.ts                    ← CLI 엔트리포인트
├── electron/main.ts          ← Electron 엔트리포인트
├── workspace.ts              ← 워크스페이스 관리
├── codebase-scanner.ts       ← 코드베이스 → PRD 역추출 스캐너
├── server/
│   ├── index.ts              ← Hono 서버 (라우트 마운트)
│   ├── context.ts            ← 요청 컨텍스트 (DB, 워크스페이스, 세션)
│   ├── recommendation.ts     ← 이슈 추천 엔진
│   ├── analysis-schema.ts    ← 분석 결과 검증 스키마
│   └── routes/
│       ├── workspace.ts      ← 워크스페이스 열기/닫기/설정
│       ├── init.ts           ← PRD 생성 (폼/임포트/코드스캔)
│       ├── analyze.ts        ← AI 분석 실행
│       ├── issues.ts         ← 이슈 CRUD + 타임라인 + 사이클
│       ├── apply.ts          ← Draft → Applied 반영
│       ├── apply-preview.ts  ← 반영 미리보기
│       ├── generate.ts       ← 문서 생성 + 다운로드
│       ├── perspectives.ts   ← 분석 관점 CRUD
│       ├── decisions.ts      ← 결정 타임라인 + 통계
│       ├── documents.ts      ← 문서 타입 관리
│       ├── glossary.ts       ← 용어집 CRUD
│       └── jobs.ts           ← 잡 폴링 + 취소
├── claude/
│   ├── provider.ts           ← AI 프로바이더 디스패치 (Claude/Codex)
│   ├── capabilities.ts       ← 모델별 스펙 정의
│   ├── context-package.ts    ← 프롬프트 컨텍스트 조립
│   ├── log-extractor.ts      ← 스트리밍 JSONL 파서
│   ├── process-registry.ts   ← 실행 중 프로세스 관리/취소
│   └── prompts/
│       ├── init.ts           ← PRD 생성 프롬프트
│       ├── review-plan.ts    ← 기획 리뷰 프롬프트
│       ├── design-backend.ts ← BE 설계 프롬프트
│       ├── design-frontend.ts← FE 설계 프롬프트
│       └── plan-features.ts  ← 다음버전 프롬프트
├── db/
│   ├── schema.ts             ← DDL + 마이그레이션 (V2~V43)
│   ├── repository.ts         ← 모든 DB 쿼리/타입/데이터 접근
│   ├── index.ts              ← DB 열기/닫기/마이그레이션 적용
│   └── app-db.ts             ← 글로벌 app.db 관리
├── dashboard/
│   ├── index.html            ← SPA HTML (워크스페이스 피커 + 6탭 대시보드)
│   ├── app.js                ← 대시보드 로직 (~2100줄)
│   └── styles.css            ← 다크 테마 CSS
└── templates/                ← 서비스 유형별 PRD 템플릿 (5종)
```

---

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  실행 모드                                           │
│  ├── Electron (데스크톱 앱)                          │
│  │   └── main.ts → BrowserWindow → localhost:<port>  │
│  └── CLI (브라우저)                                  │
│      └── cli.ts → open() → 기본 브라우저             │
└───────────────────┬─────────────────────────────────┘
                    │
        Hono 서버 (@hono/node-server)
        ├── 정적 파일 서빙 (대시보드 SPA)
        ├── REST API /api/*
        │   ├── 워크스페이스 (세션, recents, 폴더 피커)
        │   ├── 이슈 CRUD / Draft-Applied 관리
        │   ├── 분석 (탭별 관점 병렬 실행)
        │   ├── 리뷰 사이클 추적
        │   ├── 문서 생성 / 버전 관리
        │   ├── 분석 관점(Perspectives) CRUD
        │   ├── 결정 타임라인 / 스냅샷
        │   └── 용어집 / 잡 폴링
        ├── Provider Spawner
        │   ├── Claude CLI  (claude -p --output-format stream-json)
        │   └── Codex CLI   (codex exec --json --full-auto --ephemeral)
        └── SQLite (better-sqlite3)
            ├── app.db    ← 글로벌 (세션, recents)
            └── data.db   ← 워크스페이스별
                ├── issues, issue_preview (Draft/Applied)
                ├── decision_logs (결정 이력)
                ├── issue_snapshots (스냅샷)
                ├── review_cycles (사이클 추적)
                ├── perspectives, active_perspectives
                ├── documents (생성된 문서 메타)
                ├── changelogs (변경 이력)
                ├── glossary (용어집)
                └── jobs (비동기 잡 상태)
```

**런타임 의존성 (5개):** `hono`, `@hono/node-server`, `better-sqlite3`, `fix-path`, `open`

---

## 라이선스

MIT
