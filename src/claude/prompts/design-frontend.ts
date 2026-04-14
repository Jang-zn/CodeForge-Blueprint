import { type ContextPackage, formatContextForPrompt } from '../context-package.js';
import { type Perspective } from '../../db/repository.js';
import { ID_CONTINUITY_RULES, FEEDBACK_RULES } from './index.js';

// 기본 관점 (DB 없을 때 폴백)
const DEFAULT_PERSPECTIVES = [
  { id_prefix: 'fe-comp', name: '화면/컴포넌트 계층', prompt_instruction: 'v1에 꼭 필요한 화면만 남기고, 핵심 사용자 여정 중심으로 컴포넌트를 구성하라. 화면 수를 줄이고 재사용 컴포넌트를 식별하라' },
  { id_prefix: 'fe-state', name: '상태 관리', prompt_instruction: '사용자 행동 흐름이 끊기지 않도록 최소한의 상태 모델을 정의하라. 불필요한 글로벌 상태를 줄이고, 서버 상태 캐시로 대체 가능한 클라이언트 상태를 식별하라' },
  { id_prefix: 'fe-route', name: '네비게이션/라우팅', prompt_instruction: '신규 사용자가 핵심 가치를 경험하기까지 탭/화면 이동을 최소화하는 라우팅 구조를 설계하라. 불필요한 중간 화면을 제거하라' },
  { id_prefix: 'fe-api', name: 'API 연동 레이어', prompt_instruction: 'API 실패 시 사용자 경험이 망가지지 않도록 에러 상태, 재시도, 폴백 메시지를 설계하라. 로딩/성공/실패 상태를 사용자 관점에서 설계하라' },
  { id_prefix: 'fe-token', name: '디자인 시스템', prompt_instruction: '디자이너 없이 혼자 일관된 UI를 빠르게 만들 수 있는 최소 디자인 규칙을 정의하라. 기존 UI 라이브러리를 최대한 활용하고 커스텀을 최소화하라' },
];

export function buildFrontendPrompt(ctx: ContextPackage, perspectives?: Perspective[]): string {
  const contextBlock = formatContextForPrompt(ctx);

  const activePerspectives = perspectives && perspectives.length > 0
    ? perspectives
    : DEFAULT_PERSPECTIVES;

  const perspectiveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const sectionLines = activePerspectives.map((p, i) => {
    const letter = perspectiveLetters[i] ?? String(i + 1);
    const prefix = p.id_prefix.toUpperCase();
    return `**${letter}. ${p.name} (${prefix})**: ${p.prompt_instruction}`;
  }).join('\n');

  const idPatternLines = activePerspectives.map(p => {
    return `${p.id_prefix}1~${p.id_prefix}9`;
  }).join(', ');

  return `당신은 시니어 프론트엔드 아키텍트입니다.
아래 frozen 검토(review), UX 설계(design-ux), 백엔드 설계(design-backend), 그리고 현재 요청 문서들을 분석하여 프론트엔드 아키텍처를 ${activePerspectives.length}개 섹션으로 설계하세요.

## 설계 섹션

${sectionLines}

## 구조화된 설계 출력 규칙

다음 4개 섹션의 구조화된 데이터를 생성하세요:

### Routes (라우팅)
각 라우트는 id(route-xxx), path, viewId, auth로 구성

### Views (화면 논리)
각 뷰는 id(view-xxx), screenId, name, purpose, primaryActions, formFields로 구성

### API Bindings (뷰-API 연결)
각 바인딩은 viewId, endpointId, trigger, successAction, errorAction으로 구성

### UI States (상태 표현)
각 UI 상태는 viewId, stateType(loading|error|idle|success), behavior로 구성

## 출력 형식

반드시 아래 JSON 형식으로만 출력하세요:

\`\`\`json
{
  "routes": [
    {
      "id": "route-record-create",
      "path": "/records/new",
      "viewId": "view-record-form",
      "auth": "required"
    }
  ],
  "views": [
    {
      "id": "view-record-form",
      "screenId": "screen-record-form",
      "name": "기록 작성 페이지",
      "purpose": "사용자가 새로운 기록을 작성하고 저장하는 페이지",
      "primaryActions": ["submitRecord", "cancelCreate"],
      "formFields": [
        { "name": "title", "required": true, "validation": "min:1" },
        { "name": "rating", "required": false, "validation": "range:1-5" }
      ]
    }
  ],
  "apiBindings": [
    {
      "viewId": "view-record-form",
      "endpointId": "ep-create-record",
      "trigger": "submitRecord",
      "successAction": "navigate:screen-record-success",
      "errorAction": "show-inline-error"
    }
  ],
  "uiStates": [
    {
      "viewId": "view-record-form",
      "stateType": "loading",
      "behavior": "submit 버튼 비활성화와 로딩 표시"
    },
    {
      "viewId": "view-record-form",
      "stateType": "error",
      "behavior": "입력값 유지, 에러 메시지 표시, 재시도 허용"
    }
  ],
  "issues": [
    {
      "id": "fe-comp1",
      "basis_issue_id": "fe-comp1",
      "category": "FE-COMP",
      "title": "설계 결정 제목",
      "tag": "decision",
      "priority": "P1",
      "description": "설계 결정 내용 (2-3문장)",
      "evidence": "PRD에서 도출한 근거",
      "conclusion": "트레이드오프 및 선택 이유",
      "callout_type": "blue"
    }
  ]
}
\`\`\`

**규칙:**
- id 패턴: ${idPatternLines}
${ID_CONTINUITY_RULES}
- category는 해당 관점의 id_prefix 대문자 (예: FE-COMP, FE-STATE...)
- tag: "decision" | "trade-off" | "dependency"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "red" (P0) | "orange" (P1) | "blue" (P2)
- 각 섹션당 최소 2개, 최대 5개 항목
- **라우트 ID 규칙**: route- prefix (예: route-record-create, route-list-records)
- **뷰 ID 규칙**: view- prefix (예: view-record-form, view-record-detail)
- backend 계약이 없는 가상 API 만들지 말 것 (endpoints와 반드시 매핑)
- 화면 책임과 컴포넌트 내부 구조를 혼동하지 말 것
- 폼 검증, 실패 복구, 권한 거절 상태는 필수 포함
${FEEDBACK_RULES}
- <context:ref-items>가 있다면 반드시 설계에 반영하세요
- <context:ai-guide>의 기술 제약/톤/원칙을 설계에 반영하세요
- <context:glossary>가 있다면 용어를 일관되게 사용하세요
- PRD에서 실제로 도출 가능한 설계만 포함
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
