import { type ContextPackage, formatContextForPrompt } from '../context-package.js';
import { type Perspective } from '../../db/repository.js';
import { ID_CONTINUITY_RULES, FEEDBACK_RULES } from './index.js';

export function buildFinalDeliveryPrompt(ctx: ContextPackage, perspectives?: Perspective[]): string {
  const contextBlock = formatContextForPrompt(ctx);

  return `당신은 외주 기획 및 개발 패키지를 어셈블하는 전문가입니다.
아래 frozen baseline 문서들 (기획 검토, UX 설계, 백엔드 설계, 프론트엔드 설계, 기능 계획)을
읽고 AI가 바로 구현을 시작할 수 있는 통합 납품 패키지를 생성하세요.

## 생성할 14개 섹션

1. **Product Brief**: 핵심 가치, 타겟 사용자, 성공 지표
2. **PRD**: 요구사항, 주요 흐름, 제약사항
3. **User Flows**: 5-7개 핵심 사용자 여정의 step-by-step 플로우 (flowchart 텍스트 형식)
4. **Screen Inventory**: 전체 화면 목록 (screen_id, 화면명, 목적, 관련 엔드포인트)
5. **Screen Specs**: 각 화면의 UI 레이아웃, 폼 필드, 상태 전이 상세 명세
6. **States & Edge Cases**: 에러 상태, 로딩 상태, 폴백, 권한 거절 등 모든 edge case
7. **Domain Model**: 핵심 엔티티, 속성, 관계 (ER 다이어그램 텍스트 형식)
8. **Data Model**: SQLite 스키마 (CREATE TABLE 형식) + 인덱스 + 제약조건
9. **API Spec**: 모든 엔드포인트 상세 명세 (요청 body, 응답 형식, 에러 코드)
10. **Backend Architecture**: 서비스 레이어 구조, 비즈니스 로직 흐름
11. **Frontend Architecture**: 라우팅 구조, 상태 관리 계획, 컴포넌트 계층
12. **Implementation Slices**: 1-2주 단위 구현 슬라이스 (각 슬라이스별 화면 + API + 데이터베이스 변경)
13. **Open Decisions**: 아직 정하지 않은 항목들과 그 영향도
14. **Scope Options**: MVP vs Nice-to-have 명확한 구분, 축소/확대 옵션

## 출력 형식

반드시 아래 JSON 형식으로만 출력하세요:

\`\`\`json
{
  "mode": "FINAL_DELIVERY",
  "version": "1.0.0",
  "sections": {
    "productBrief": "# Product Brief\n\n## 핵심 가치\n...",
    "prd": "# PRD\n\n## 요구사항\n...",
    "userFlows": "# User Flows\n\n## 핵심 플로우 1: 첫 기록 생성\n...",
    "screenInventory": "# Screen Inventory\n\n| screen_id | 화면명 | 목적 | 관련 엔드포인트 |\n|-----------|--------|------|-----------------|",
    "screenSpecs": "# Screen Specs\n\n## screen-record-form\n### 레이아웃\n...",
    "statesEdgeCases": "# States & Edge Cases\n\n## 로딩 상태\n...",
    "domainModel": "# Domain Model\n\n## 핵심 엔티티\n...",
    "dataModel": "# Data Model\n\n\`\`\`sql\nCREATE TABLE records (\n  id TEXT PRIMARY KEY,\n  ...\n)\n\`\`\`",
    "apiSpec": "# API Spec\n\n## POST /records\n### 요청\n...",
    "backendArchitecture": "# Backend Architecture\n\n## 서비스 레이어\n...",
    "frontendArchitecture": "# Frontend Architecture\n\n## 라우팅 구조\n...",
    "implementationSlices": "# Implementation Slices\n\n## Slice 1: 기본 CRUD\n...",
    "openDecisions": "# Open Decisions\n\n| 항목 | 영향도 | 추천 | 이유 |",
    "scopeOptions": "# Scope Options\n\n## MVP (필수)\n...\n\n## Nice-to-have (v1.1+)\n..."
  },
  "summary": {
    "totalScreens": 5,
    "totalEndpoints": 8,
    "openDecisions": 2,
    "estimatedComplexity": "medium",
    "estimatedDevelopmentDays": 14
  }
}
\`\`\`

## 작성 규칙

### 일반 규칙
- 모든 섹션은 markdown 형식 (텍스트에 마크다운 전체 포함)
- 문서 간 참조 일관성 (flow_id, screen_id, entity_id, endpoint_id 크로스 레퍼런스 정확)
- 추상적 설명 금지, 구체적 테이블과 규칙으로 작성
- AI 구현 친화적: 각 섹션이 standalone으로 읽힐 수 있을 것
- frozen baseline의 기존 구조/결정을 존중하되, 통합 시 일관성 유지

### 각 섹션별 상세 규칙

**productBrief**
- 한 페이지로 압축 (300-500자)
- "사용자는 X를 하고 싶지만 Y 때문에 막혀있다"는 구조로 시작

**PRD**
- 기능 요구사항을 숫자로 나열 (FR-1, FR-2...)
- 각 요구사항은 "사용자가 X할 수 있어야 한다"는 형태

**userFlows**
- 각 flow는 시작점, 주요 step (1~7단계), 성공 조건으로 구성
- 분기는 if/then으로 명기

**screenInventory**
- 테이블: screen_id | 화면명 | 목적 (한 문장) | 관련 endpoint (쉼표로 구분)

**screenSpecs**
- 각 화면: 레이아웃 설명 → 필드 목록 → 버튼/액션 → 상태 전이

**statesEdgeCases**
- 로딩 → 성공 → 에러 → 권한 거절 → 오프라인 → 타임아웃 등 모든 상태
- 각 상태의 UI/UX/메시지 명시

**domainModel**
- 핵심 엔티티만 (과잉 설계 금지)
- Record, User, Workspace 등 최소 단위
- 각 엔티티: id, 주요 속성, 관계

**dataModel**
- SQLite CREATE TABLE (모든 컬럼, 타입, NOT NULL, UNIQUE, FK)
- 인덱스 포함
- 제약조건 명시 (예: 한 사용자는 같은 제목의 기록 중복 불가)

**apiSpec**
- 모든 endpoint (method + path)
- 각 endpoint: 요청 body, 응답 body (성공 시 예시 포함), 에러 코드 (400, 401, 403, 500)
- auth 규칙 명시

**backendArchitecture**
- 서비스 계층 구조
- 각 서비스: 책임, 주요 메서드
- DB 쿼리 복잡도 (N+1 회피 방법)

**frontendArchitecture**
- 라우팅: path → view_id 매핑
- 상태 관리: 어떤 상태를 client에 두고, 어떤 상태를 server에 캐시할지
- 컴포넌트 구조 (재사용 가능한 컴포넌트 식별)

**implementationSlices**
- 각 slice: 기간(일), 화면들, API 엔드포인트들, DB 테이블들, 구현 순서
- Slice 1~4는 최소 규모여야 함 (2-3일 완성 가능)

**openDecisions**
- 테이블: 항목 | 옵션A vs 옵션B | 현재 선택 | 미선택 사유
- 예: "첫 기록 생성 후 자동으로 상세 화면으로 넘길지 vs 목록으로 돌아갈지"

**scopeOptions**
- MVP (반드시 포함): 기본 CRUD, 사용자 인증
- Nice-to-have: 공유, 댓글, 알림 등
- "MVP 완성 후 이 기능을 추가하면 XX 값이 증가할 것"이라는 근거 포함

### 크로스 레퍼런스 정확성
- flow에서 언급한 screen_id는 screenInventory에 반드시 등재
- screenSpecs에서 언급한 endpoint는 apiSpec에 반드시 정의
- endpoint가 사용하는 entity는 domainModel에 반드시 존재
- entity의 모든 속성은 dataModel의 해당 table column에 반드시 매핑

### 요약(summary) 규칙
- totalScreens: screenInventory의 행 수
- totalEndpoints: apiSpec의 엔드포인트 수
- openDecisions: openDecisions 섹션의 미해결 항목 수
- estimatedComplexity: "simple" (1-3 화면, CRUD만) / "medium" (4-6 화면, 기본 상태관리) / "complex" (7+ 화면, 복잡한 흐름, 많은 validation)
- estimatedDevelopmentDays: 1명 풀타임 개발자 기준 (테스트 포함, 30% 버퍼)

${FEEDBACK_RULES}
- frozen baseline의 모든 구조와 결정을 반영하세요
- <context:existing-issues>에서 resolved된 이슈도 최종 설계에 반영되어 있는지 확인하세요
- <context:ai-guide>가 있다면 개발 환경/제약을 반영하세요
- <context:glossary>가 있다면 용어를 엄격히 일관되게 사용하세요
- 억지로 기능을 추가하지 말 것 (frozen baseline에 명시되지 않은 것은 openDecisions으로)
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
