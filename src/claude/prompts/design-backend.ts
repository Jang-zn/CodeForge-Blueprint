import { type ContextPackage, formatContextForPrompt } from '../context-package.js';
import { type Perspective } from '../../db/repository.js';
import { ID_CONTINUITY_RULES, FEEDBACK_RULES } from './index.js';

// 기본 관점 (DB 없을 때 폴백)
const DEFAULT_PERSPECTIVES = [
  { id_prefix: 'be-api', name: 'API 설계', prompt_instruction: 'MVP에서 FE 개발을 차단하지 않는 최소 API 계약을 설계하라. 엔드포인트를 줄이고, 인증 단순화, 에러 포맷 통일에 집중하라' },
  { id_prefix: 'be-db', name: 'DB 스키마', prompt_instruction: '핵심 가치를 증명하는 데 필요한 최소 엔티티와 관계만 설계하라. 과도한 정규화 없이 실제 쿼리 패턴 중심으로 스키마를 잡아라' },
  { id_prefix: 'be-infra', name: '인프라', prompt_instruction: '솔로 개발자가 새벽 2시 장애에도 혼자 진단하고 복구할 수 있는 가장 단순한 배포 구조를 설계하라. 관리형 서비스를 우선 사용하고 자체 운영 컴포넌트를 최소화하라' },
  { id_prefix: 'be-lib', name: '라이브러리/의존성', prompt_instruction: '라이브러리 선택 시 구현 속도와 장기 유지보수 부담을 현실적으로 평가하라. 유지보수가 중단된 라이브러리, 과도한 추상화, 솔로 개발자에게 불필요한 복잡성을 지적하라' },
  { id_prefix: 'be-svc', name: '서비스 레이어', prompt_instruction: '솔로 개발자가 6개월 후에도 읽고 수정할 수 있는 서비스 레이어를 설계하라. 과도한 추상화 없이 유스케이스별 흐름이 한눈에 보이는 구조를 잡아라' },
];

export function buildBackendPrompt(ctx: ContextPackage, perspectives?: Perspective[]): string {
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

  return `당신은 시니어 백엔드 아키텍트입니다.
아래 frozen 검토(review), UX 설계(design-ux), 그리고 현재 요청 문서들을 분석하여 백엔드 아키텍처를 ${activePerspectives.length}개 섹션으로 설계하세요.

## 설계 섹션

${sectionLines}

## 구조화된 설계 출력 규칙

다음 3개 섹션의 구조화된 데이터를 생성하세요:

### Entities (데이터 모델)
각 엔티티는 id(entity-xxx), name, description, fields(name, type, required)로 구성

### State Machines (상태 전이)
각 상태 머신은 id(sm-xxx), entityId, states 목록, transitions(from, to, trigger)로 구성

### Endpoints (API 계약)
각 엔드포인트는 id(ep-xxx), method, path, purpose, requestBody, responseBody, auth, roles, relatedScreenIds, relatedEntityIds로 구성

## 출력 형식

반드시 아래 JSON 형식으로만 출력하세요:

\`\`\`json
{
  "entities": [
    {
      "id": "entity-record",
      "name": "Record",
      "description": "사용자의 기록 데이터",
      "fields": [
        { "name": "id", "type": "string", "required": true },
        { "name": "title", "type": "string", "required": true },
        { "name": "createdAt", "type": "datetime", "required": true }
      ]
    }
  ],
  "stateMachines": [
    {
      "id": "sm-record",
      "entityId": "entity-record",
      "states": ["draft", "saved", "archived"],
      "transitions": [
        { "from": "draft", "to": "saved", "trigger": "submit" },
        { "from": "saved", "to": "archived", "trigger": "archive" }
      ]
    }
  ],
  "endpoints": [
    {
      "id": "ep-create-record",
      "method": "POST",
      "path": "/records",
      "purpose": "새 기록 생성",
      "requestBody": ["title", "rating"],
      "responseBody": ["id", "title", "createdAt"],
      "auth": "required",
      "roles": ["end-user"],
      "relatedScreenIds": ["screen-record-form"],
      "relatedEntityIds": ["entity-record"]
    }
  ],
  "issues": [
    {
      "id": "be-api1",
      "basis_issue_id": "be-api1",
      "category": "BE-API",
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
- category는 해당 관점의 id_prefix 대문자 (예: BE-API, BE-DB...)
- tag: "decision" | "trade-off" | "dependency"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "red" (P0) | "orange" (P1) | "blue" (P2)
- 각 섹션당 최소 2개, 최대 5개 항목
- **엔티티 ID 규칙**: entity- prefix (예: entity-record, entity-user)
- **상태머신 ID 규칙**: sm- prefix (예: sm-record, sm-workflow)
- **엔드포인트 ID 규칙**: ep- prefix (예: ep-create-record, ep-list-records)
- UX에서 요구하지 않는 API를 과하게 만들지 말 것
- auth/role/error 규약은 생략하지 말 것
- MVP 구현 가능을 우선하고 과도한 미래 확장성 지향 금지
${FEEDBACK_RULES}
- <context:ai-guide>의 기술 제약/원칙을 설계에 반영하세요
- <context:glossary>가 있다면 용어를 일관되게 사용하세요
- <context:decisions>의 기존 결정과 충돌하지 않도록 하세요
- PRD에서 실제로 도출 가능한 설계만 포함 (억지로 만들지 말 것)
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
