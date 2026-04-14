import { type ContextPackage, formatContextForPrompt } from '../context-package.js';
import { type Perspective } from '../../db/repository.js';
import { ID_CONTINUITY_RULES, FEEDBACK_RULES } from './index.js';

// 기본 관점 (DB 없을 때 폴백)
const DEFAULT_PERSPECTIVES = [
  { id_prefix: 'ux-flow', name: '핵심 사용자 플로우', prompt_instruction: 'MVP에서 사용자가 핵심 가치를 경험하는 경로를 1~3개 플로우로 명확히 하라. 각 플로우에서 필수 스크린과 사용자 의사결정을 식별하라' },
  { id_prefix: 'ux-screen', name: '화면 설계', prompt_instruction: 'MVP 플로우에 필요한 모든 화면을 정의하라. 각 화면의 목적, 핵심 액션, 로딩/성공/에러 상태, 엣지 케이스 처리를 명시하라' },
  { id_prefix: 'ux-role', name: '역할별 UX 분리', prompt_instruction: '일반 사용자 UX와 관리자 UX를 명확히 구분하라. 관리 화면은 별도 섹션으로 설계하고, 각 역할의 주요 작업 흐름을 정의하라' },
  { id_prefix: 'ux-state', name: '상태 및 예외 처리', prompt_instruction: '각 화면에서 발생 가능한 비정상 상태(로딩 중, 권한 없음, 데이터 비어있음, 네트워크 오류)를 식별하고 사용자 메시지를 설계하라' },
  { id_prefix: 'ux-gap', name: 'UX 리스크 및 미정 사항', prompt_instruction: '플로우 상의 ambiguity, 사용자 이탈 지점, 운영 비용이 높은 UX, 검증되지 않은 가정을 지적하라' },
];

export function buildUxPrompt(ctx: ContextPackage, perspectives?: Perspective[]): string {
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

  return `당신은 시니어 UX 기획자이자 서비스 설계자입니다.
아래 문서들을 분석하여 UX 구조(플로우, 화면, 상태)를 ${activePerspectives.length}개 섹션으로 설계하세요.

## 설계 섹션

${sectionLines}

## 출력 형식

반드시 아래 JSON 형식으로만 출력하세요:

\`\`\`json
{
  "mode": "UX",
  "issues": [
    {
      "id": "ux-flow1",
      "basis_issue_id": "ux-flow1",
      "category": "UX-FLOW",
      "title": "이슈 제목",
      "tag": "flow-gap",
      "priority": "P1",
      "description": "이슈 상세 설명 (2-4문장)",
      "evidence": "PRD에서 발견한 구체적 근거",
      "conclusion": "권장 해결 방향",
      "callout_type": "orange"
    }
  ],
  "flows": [
    {
      "id": "flow-primary-record",
      "name": "핵심 기록 생성 플로우",
      "goal": "사용자가 핵심 기능을 완료하는 경로",
      "actor": "end-user",
      "priority": "must",
      "entryCondition": "플로우 시작 조건",
      "successOutcome": "플로우 성공 시 결과",
      "steps": [
        {
          "order": 1,
          "screenId": "screen-home",
          "action": "홈에서 '기록하기' CTA 클릭",
          "decisionType": "action"
        }
      ]
    }
  ],
  "screens": [
    {
      "id": "screen-record-form",
      "name": "기록 작성",
      "type": "form",
      "role": "end-user",
      "priority": "must",
      "flowIds": ["flow-primary-record"],
      "purpose": "사용자 입력 수집 및 기록 저장",
      "entryPoints": ["홈 CTA"],
      "primaryActions": ["저장", "취소"],
      "requiredData": ["title", "content"],
      "apiCandidates": ["POST /records"],
      "complexity": "medium"
    }
  ],
  "screenStates": [
    {
      "screenId": "screen-record-form",
      "stateType": "loading",
      "condition": "form 제출 후 서버 응답 대기 중",
      "userMessage": "저장 중입니다. 잠시만 기다려주세요.",
      "operatorAction": null
    }
  ],
  "openQuestions": [
    {
      "id": "oq-ux-1",
      "title": "확인 필요한 설계 결정",
      "impact": "이 의사결정이 미치는 영향"
    }
  ]
}
\`\`\`

**규칙:**
- id 패턴: ${idPatternLines}
${ID_CONTINUITY_RULES}
- category는 해당 관점의 id_prefix 대문자 (예: UX-FLOW, UX-SCREEN...)
- tag: "flow-gap" | "screen-missing" | "ux-risk" | "role-gap" | "edge-case"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "red" (P0) | "orange" (P1) | "blue" (P2)
- 각 섹션당 최소 2개, 최대 5개 항목

**플로우 설계:**
- flow 필드: id(flow- prefix 필수), name, goal, actor(end-user|admin|operator), priority(must|should|could), entryCondition, successOutcome, steps[]
- steps[]: order(1부터 시작), screenId, action, decisionType(action|decision|system)
- MVP에 필수적인 플로우만 정의 (1~3개 권장)

**화면 설계:**
- screen 필드: id(screen- prefix 필수), name, type(page|form|list|detail|modal|system), role(end-user|admin|operator), priority(must|should|could), flowIds[], purpose, entryPoints[], primaryActions[], requiredData[], apiCandidates[], complexity(low|medium|high)
- 관리자 화면은 role="admin"으로 명확히 표시
- 각 화면에 최소 2개 primaryActions 포함

**상태 설계:**
- screenState 필드: screenId, stateType(default|empty|loading|success|error|permission), condition, userMessage, operatorAction
- empty: 데이터 없음, loading: 진행 중, success: 완료, error: 실패, permission: 권한 없음
- 각 화면마다 최소 3가지 상태(default, loading, error) 정의

${FEEDBACK_RULES}
- <context:ai-guide>가 있다면 UX 원칙을 분석에 반영하세요
- <context:glossary>가 있다면 용어를 동일하게 사용하세요
- <context:base-document>의 review baseline이 있다면 반드시 참조하여 일관성 유지
- 실제 MVP에서 필요한 화면만 우선 정의 (나중에 추가 가능한 것은 openQuestions에)
- 화면 없이 처리되는 시스템 처리와 별도 UI가 필요한 운영 행위 구분
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
