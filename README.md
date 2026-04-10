# CodeForge Blueprint

아이디어를 구조화된 PRD, 백엔드/프론트엔드 아키텍처, 다음 버전 기능 제안서로 만들어주는 AI 기획 도구. **데스크톱 앱 설치** 또는 **CLI 실행** 두 가지 방식을 지원합니다.

## 설치 & 실행

### 방법 1: 데스크톱 앱 (권장)

[Releases](../../releases) 페이지에서 OS에 맞는 설치 파일을 다운로드합니다.

| OS | 파일 |
|----|------|
| macOS (Apple Silicon) | `CodeForge Blueprint-x.x.x-arm64.dmg` |
| macOS (Intel) | `CodeForge Blueprint-x.x.x.dmg` |
| Windows | `CodeForge Blueprint Setup x.x.x.exe` |

> macOS는 자신의 Mac 아키텍처에 맞는 DMG를 받으세요. 터미널에서 `uname -m` 실행 시 `arm64`면 Apple Silicon, `x86_64`면 Intel입니다.

DMG를 열어 `/Applications`에 드래그하거나, Windows에서는 설치 마법사를 실행합니다.

> 직접 빌드하려면: `npm install && npm run electron:build -- --mac` (또는 `--win`)

### 방법 2: CLI + 브라우저

```bash
# 인자 없이 실행 — 브라우저에서 폴더 선택
npx codeforge-blueprint

# 폴더를 미리 지정해서 바로 시작
npx codeforge-blueprint ~/projects/my-app

# 포트 지정
npx codeforge-blueprint --port 4000
```

## 요구사항

- Node.js 18+
- AI CLI 중 하나 이상 설치 + **해당 서비스 구독 필요**:

| CLI | 설치 | 구독 |
|-----|------|------|
| [Claude Code CLI](https://docs.anthropic.com/en/claude-code) | `npm install -g @anthropic-ai/claude-code` | [Anthropic Max 플랜](https://www.anthropic.com/pricing) 또는 API 키 |
| [Codex CLI](https://github.com/openai/codex) | `npm install -g @openai/codex` | [OpenAI Pro/Plus 플랜](https://openai.com/pricing) 또는 API 키 |

> **참고:** CLI 설치만으로는 동작하지 않습니다. 각 CLI에서 인증(`claude login` / `codex auth`)을 완료해야 AI 기능을 사용할 수 있습니다.

데스크톱 앱에서는 시작 시 CLI 설치 여부를 자동 감지합니다 (macOS Finder/Dock 실행 시에도 PATH 자동 해결).

---

## 앱 데이터 경로

| 실행 방식 | 앱 데이터(sessions, recents) |
|----------|------------------------------|
| 데스크톱 앱 (macOS) | `~/Library/Application Support/CodeForge Blueprint/` |
| 데스크톱 앱 (Windows) | `%APPDATA%\CodeForge Blueprint\` |
| CLI 브라우저 | `~/.codeforge-blueprint/` |

기존 CLI 모드로 사용 중이었다면 데스크톱 앱 최초 실행 시 `app.db`를 자동으로 새 경로로 복사합니다.

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

1. **기획 리뷰** — AI가 PRD를 기본 6가지 관점(기획 정합성, 수익/과금, 사용자 획득/유지, 구현 가능성, 운영 확장성, 법적/규제)으로 분석. 브라우저에서 각 이슈의 상태와 메모를 직접 관리. **커스텀 관점 추가** 가능 — 탭별로 분석 관점을 자유롭게 추가·비활성화·삭제
2. **BE / FE 설계** — 백엔드(API, DB, 인프라, 라이브러리, 서비스 레이어)와 프론트엔드(컴포넌트, 상태 관리, 라우팅, API 연동, 디자인 시스템) 아키텍처 분석
3. **다음버전** — 마케팅, 운영, 서비스 기획, 기술 4가지 관점의 다음 버전 기능 제안. 기획 리뷰에서 보류된 항목이 자동으로 포함됨
4. **반영하기** — 리뷰 결과 반영: 결정 로그 기록, 보류 항목 다음버전 탭으로 이동, 버전 업

#### 분석 관점 커스터마이징

각 분석 탭(기획 리뷰·BE·FE·다음버전)에서 분석에 사용할 관점을 직접 제어할 수 있습니다:

- **기본 관점** — 잠금 아이콘(🔒)이 표시되며 항상 활성. 비활성화 불가
- **커스텀 관점 추가** — `+ 커스텀 관점 추가` 버튼으로 이름·설명을 입력해 새 관점 생성
- **토글** — 각 관점을 켜고 끄면 다음 분석 실행 시 해당 관점이 포함/제외됨
- **내보내기** — 관점 변경 시 `perspectives.json`이 워크스페이스 `docs/.codeforge/`에 자동 저장됨 (팀 공유 또는 백업 용도)

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

## 모델 선택

헤더 드롭다운에서 AI 백엔드를 언제든 전환할 수 있습니다. 선택 사항은 재시작 후에도 유지됩니다.

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
│   │   └── ...
│   ├── backend-v1.0.0/         ← BE 설계 (폴더)
│   ├── frontend-v1.0.0/        ← FE 설계 (폴더)
│   └── features-v1.0.0/        ← 다음버전 (폴더)
└── ...
```

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
| `npm test` | 전체 테스트 실행 (214 tests) |

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
        │   ├── 이슈 CRUD / 잡 폴링
        │   ├── 문서 생성 / 버전 관리
        │   ├── 분석 관점(Perspectives) CRUD
        │   └── 결정 타임라인 / 용어집
        ├── Provider Spawner
        │   ├── Claude CLI  (claude -p --output-format stream-json)
        │   └── Codex CLI   (codex exec --json --full-auto --ephemeral)
        └── SQLite (better-sqlite3)
            ├── app.db    ← 글로벌 (세션, recents)
            └── data.db   ← 워크스페이스별 (이슈, 문서, 결정 로그)
```

**런타임 의존성 (5개):** `hono`, `@hono/node-server`, `better-sqlite3`, `fix-path`, `open`

## 라이선스

MIT
