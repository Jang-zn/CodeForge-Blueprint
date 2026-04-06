---
name: write-doc
description: |
  리뷰 사이클이 끝난 후 최종 문서를 폴더 단위로 작성합니다. 섹션별 파일로 분리하여 독립적 리뷰가 가능합니다.
  TRIGGER when: /write-doc 직접 호출, "문서 만들어줘", "기획서 업데이트", "설계 문서 작성" 등.
  DO NOT TRIGGER when: HTML 리포트 생성, 리뷰 사이클 진행, JSON import/export.
argument-hint: [type: review|backend|frontend|features] [path to exported JSON] [path to original document(s)]
---

## 개요

이 스킬은 HTML 리포트의 리뷰 결과(JSON export)를 바탕으로 최종 MD 문서를 **폴더 단위**로 작성합니다.
HTML 전체를 파싱하지 않고 JSON export 파일만 읽으므로 빠르고 토큰 효율적입니다.
각 섹션은 독립 파일로 분리되어 개별 리뷰와 부분 업데이트가 용이합니다.

## Step 1: 입력 수집

`$ARGUMENTS` 파싱:
1. **type** — `review` | `backend` | `frontend` | `features`
2. **JSON export 경로** — 해당 탭에서 내보낸 JSON 파일 경로
3. **원본 문서 경로** — type에 따라 다름:
   - `review`: 현재 기획서 MD 경로
   - `backend`: 기획서 + 기술스택 문서 경로
   - `frontend`: 기획서 경로
   - `features`: 기획서 + BE/FE 설계 문서 경로

경로가 없거나 파일이 없으면 사용자에게 요청.

## Step 2: 파일 읽기

- JSON export 파일 전체 읽기
- 원본 문서(들) 전체 읽기
- JSON에서 각 아이템의 status, memo 추출

## Step 3: 폴더 생성

출력 폴더 경로 결정:
```
{doc_dir}/{project_name}_plan/{tab}-v{N}/
```

- `{doc_dir}` — 원본 문서와 같은 디렉토리 또는 `{project_name}_plan/` 상위 폴더
- `{tab}` — type과 동일 (`review`, `backend`, `frontend`, `features`)
- `{N}` — 해당 탭의 다음 버전 번호 (기존 폴더가 있으면 +1)
- `mkdir -p`로 생성

## Step 4: index.md 작성

```markdown
# {project_name} {docType} v{N}

> {한 줄 요약}

## 목차

- [서비스 개요](./01-service-overview.md) — 비전, 문제 정의, 핵심 가치
- [타겟 사용자](./02-target-users.md) — 페르소나 및 시나리오
...

## 서비스 요약

{6~10문장 요약. 문장별 줄바꿈.}

## 작성 정보

- 작성일: {YYYY-MM-DD}
- 버전: v{N}
- 탭: {tab}
- 확정 항목: {resolved_count}건
- 보류 항목: {deferred_count}건
```

## Step 5: 섹션 파일 작성

각 파일은 독립적으로 읽을 수 있어야 한다:

- 첫 줄: `# 섹션 제목`
- 내용이 없는 섹션(해당 이슈가 0건)은 **건너뜀** — 파일 미생성
- 코드 블록에 언어 태그 필수 (` ```ts `, ` ```sql `)
- 다이어그램은 Mermaid 사용
- 상대경로만 사용 (`./other.md`, `./index.md`)
- 파일 마지막: `[← 목차로](./index.md)` 네비게이션 링크

---

### type별 섹션 구조

**type: review — 갱신된 기획서**

입력: 기획서 + review 탭 JSON export

```
index.md               — 버전 헤더 + 서비스 요약 (6~10문장) + 목차
01-service-overview.md — 서비스 개요 (비전, 문제, 가치)
02-target-users.md     — 타겟 사용자
03-service-scope.md    — 서비스 범위 (MVP)
04-feature-spec.md     — 기능 명세 (resolved 반영)
05-revenue-model.md    — 수익 모델
06-tech-stack.md       — 기술 스택
07-deployment.md       — 배포/운영 환경
08-constraints.md      — 제약/리스크
09-kpi.md              — 성공 지표
10-deferred.md         — 향후 검토 사항 (deferred 항목)
```

작성 규칙:
- JSON에서 `resolved` 상태 아이템 목록 추출
- 각 resolved 아이템의 memo를 참고해 해당 섹션에 결정사항 반영
- 기존 기획서 구조를 그대로 유지하되 내용만 갱신
- `deferred` 아이템은 `10-deferred.md`에 "향후 검토 사항"으로 정리
- `dismissed` 아이템은 반영하지 않음

---

**type: backend — BE 설계 문서**

입력: 기획서 + 기술스택 문서 + backend 탭 JSON export

```
index.md               — 아키텍처 개요 + 목차
01-api-design.md       — API 설계 (be-api 확정 항목)
02-db-schema.md        — DB 스키마 + ERD (mermaid)
03-infra.md            — 인프라 (be-infra 확정)
04-libraries.md        — 라이브러리 (be-lib 확정)
05-service-layer.md    — 서비스 레이어 (be-svc 확정)
06-needs-review.md     — 검토 필요 항목 (proposed)
07-deferred.md         — 다음 Phase 이관 (deferred)
```

작성 규칙:
- JSON에서 `resolved` + `confirmed` 배지 아이템 추출 (설계 확정 항목)
- `proposed` 상태는 `06-needs-review.md`로 분리
- `deferred` 아이템은 `07-deferred.md`로 분리

---

**type: frontend — FE 설계 문서**

입력: 기획서 + frontend 탭 JSON export

```
index.md               — 개요 + 목차
01-components.md       — 화면/컴포넌트 계층 (fe-comp)
02-state-management.md — 상태 관리 (fe-state)
03-routing.md          — 네비게이션/라우팅 (fe-route)
04-api-integration.md  — API 연동 레이어 (fe-api)
05-design-system.md    — 디자인 시스템 (fe-token)
06-needs-review.md     — 검토 필요 항목
07-deferred.md         — 다음 Phase 이관
```

작성 규칙: BE와 동일 패턴, 카테고리는 fe-comp/fe-state/fe-route/fe-api/fe-token

---

**type: features — Phase N+1 기획서 초안**

입력: 현재 기획서 + BE/FE 설계 문서 + features 탭 JSON export

```
index.md               — Phase N+1 서비스 요약 + 목차
01-marketing.md        — 마케팅 관점 (ft-mkt)
02-operations.md       — 운영 관점 (ft-ops)
03-service.md          — 서비스 관점 (ft-svc)
04-technical.md        — 기술 관점 (ft-tech)
05-deferred.md         — Phase N+2 이관 후보
```

작성 규칙:
- JSON에서 `resolved` 상태 아이템(= 채택 결정) 추출
- 현재 기획서의 서비스 개요/아키텍처/정책을 계승
- 채택된 기능을 관점별로 정리하여 새 기능 섹션 추가
- `deferred` 아이템은 `05-deferred.md`에 "Phase N+2 이관 후보"로 분리

---

## Step 6: 검증

1. index.md에서 링크한 파일이 모두 실제로 존재하는지 확인
2. 생성되지 않은 파일(내용 없어 건너뛴 섹션)이 있으면 index.md에서 해당 링크 제거
3. 하위 파일에 `[← 목차로](./index.md)` 네비게이션 링크가 있는지 확인

## Step 7: 완료 보고

폴더 트리와 아이템 수를 출력:
```
{project_name}_plan/{tab}-v{N}/
├── index.md               — 목차 및 개요
├── 01-api-design.md       — API 설계 (5건)
├── 02-db-schema.md        — DB 스키마 (3건)
└── ...

반영: {resolved_count}건 / 검토 필요: {proposed_count}건 / 이관: {deferred_count}건
```

---

## 규칙

- JSON의 `memo` 내용은 결정 근거로만 활용하고 문서에 그대로 복붙하지 않음 — 자연스러운 문서 문체로 녹여 씀
- 에이전트 미사용 (JSON + 원본 문서 읽고 직접 작성, 토큰 효율 우선)
- 문서 내용은 사용자 언어(한국어/영어) 따름
- 기존 폴더가 있으면 덮어쓰지 않고 버전 번호 올려서 새 폴더 생성
- 단일 파일 금지 — 반드시 index.md + 최소 1개 이상의 섹션 파일
- 한 파일 = 한 주제 (200~500줄 권장)
- 상대경로만 사용 (폴더 이동 시 깨지지 않도록)
