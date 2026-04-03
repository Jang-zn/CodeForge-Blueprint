---
name: write-doc
description: |
  리뷰 사이클(HTML 확인 → JSON export → import 반영)이 끝난 후, 또는 팀 회의 직후처럼 문서화가 필요한 시점에 명시적으로 호출하여 최종 MD 문서를 작성합니다.
  TRIGGER when: (1) /write-doc 직접 호출. (2) 사용자가 "문서 만들어줘", "기획서 업데이트", "설계 문서 작성" 등을 요청할 때.
  DO NOT TRIGGER when: HTML 리포트 생성, 리뷰 사이클 진행, JSON import/export 작업.
argument-hint: [type: review|backend|frontend|features] [path to exported JSON] [path to original document(s)]
---

## 개요

이 스킬은 HTML 리포트의 리뷰 결과(JSON export)를 바탕으로 최종 MD 문서를 작성합니다.
HTML 전체를 파싱하지 않고 JSON export 파일만 읽으므로 빠르고 토큰 효율적입니다.

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

## Step 3: type별 문서 작성

---

**type: review — 갱신된 기획서 MD**

입력: 기획서 + review 탭 JSON export

작성 규칙:
- JSON에서 `resolved` 상태 아이템 목록 추출
- 각 resolved 아이템의 memo를 참고해 기획서의 해당 섹션에 결정사항 반영
- 기존 기획서 구조(섹션/서브섹션)를 그대로 유지하되 내용만 갱신
- 문서 상단에 버전 헤더 추가:
  ```markdown
  ## v{N+1} 서비스 요약
  (6~10 문장으로 서비스 전체 요약. 문장별 줄바꿈.)
  ```
- `deferred` 아이템은 "Phase 2 이관" 주석으로 해당 섹션에 표시
- `dismissed` 아이템은 반영하지 않음
- 출력 파일명: `{project_name}_requirements_v{N+1}.md` (원본 파일과 같은 디렉토리)

---

**type: backend — BE 설계 문서 MD**

입력: 기획서 + 기술스택 문서 + backend 탭 JSON export

작성 규칙:
- JSON에서 `resolved` + `confirmed` 배지 아이템 추출 (설계 확정 항목)
- `proposed` 상태는 "검토 필요" 섹션으로 분리
- `deferred` 아이템은 "다음 Phase 설계 이관" 섹션으로 분리
- 문서 구조:
  ```
  # {project_name} BE 설계 문서 v{N}
  
  ## 개요
  (기술 스택 요약, 아키텍처 패턴)
  
  ## A. API 설계
  (be-api 확정 아이템)
  
  ## B. DB 스키마
  (be-db 확정 아이템 + ERD mermaid 코드블록)
  
  ## C. 인프라
  (be-infra 확정 아이템)
  
  ## D. 라이브러리
  (be-lib 확정 아이템)
  
  ## E. 서비스 레이어
  (be-svc 확정 아이템)
  
  ## 검토 필요 항목
  ## 다음 Phase 이관 항목
  ```
- 출력 파일명: `{project_name}_be_design_v{N}.md` (JSON과 같은 디렉토리 또는 `{project_name}_plan/`)

---

**type: frontend — FE 설계 문서 MD**

입력: 기획서 + frontend 탭 JSON export

작성 규칙: BE와 동일 구조, 카테고리는 fe-comp/fe-state/fe-route/fe-api/fe-token
- 문서 구조:
  ```
  # {project_name} FE 설계 문서 v{N}
  
  ## 개요
  (플랫폼, 주요 라이브러리)
  
  ## A. 화면/컴포넌트 계층
  ## B. 상태 관리
  ## C. 네비게이션/라우팅
  ## D. API 연동 레이어
  ## E. 디자인 시스템
  
  ## 검토 필요 항목
  ## 다음 Phase 이관 항목
  ```
- 출력 파일명: `{project_name}_fe_design_v{N}.md`

---

**type: features — Phase N+1 기획서 초안 MD**

입력: 현재 기획서 + BE/FE 설계 문서 + features 탭 JSON export

작성 규칙:
- JSON에서 `resolved` 상태 아이템(= 채택 결정) 추출
- 현재 기획서의 서비스 개요/아키텍처/정책을 계승
- 채택된 기능을 관점별로 정리하여 새 기능 섹션 추가
- 문서 상단:
  ```markdown
  ## Phase N+1 서비스 요약
  (6~10 문장. Phase N 완료 후 고도화 방향 서술. 문장별 줄바꿈.)
  ```
- `deferred` 아이템은 "Phase N+2 이관 후보" 섹션으로 분리
- 출력 파일명: `{project_name}_requirements_phase{N+1}_draft.md`

---

## Step 4: 완료 보고

작성된 파일 경로와 포함된 아이템 수(반영/검토필요/이관) 간략 보고.

---

## 규칙

- JSON의 `memo` 내용은 결정 근거로만 활용하고 문서에 그대로 복붙하지 않음 — 자연스러운 문서 문체로 녹여 씀
- 에이전트 미사용 (JSON + 원본 문서 읽고 직접 작성, 토큰 효율 우선)
- 문서 내용은 사용자 언어(한국어/영어) 따름
- 기존 파일이 있으면 덮어쓰지 않고 버전 번호 올려서 새 파일 생성
