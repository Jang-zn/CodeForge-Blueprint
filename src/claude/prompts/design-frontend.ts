import { type ContextPackage, formatContextForPrompt } from '../context-package.js';
import { type Perspective } from '../../db/repository.js';

// 기본 관점 (DB 없을 때 폴백)
const DEFAULT_PERSPECTIVES = [
  { id_prefix: 'fe-comp', name: '화면/컴포넌트 계층', prompt_instruction: '화면 인벤토리, 컴포넌트 계층 구조, 공용 컴포넌트 후보, 화면-컴포넌트 매핑을 설계하라' },
  { id_prefix: 'fe-state', name: '상태 관리', prompt_instruction: '글로벌/로컬 상태 경계, 도메인별 상태 형태, 서버 상태 캐시 전략, 낙관적 업데이트 대상을 설계하라' },
  { id_prefix: 'fe-route', name: '네비게이션/라우팅', prompt_instruction: '네비게이션 스택, 딥링크 스키마, 인증 게이트 라우트, 딥링크-화면 매핑을 설계하라' },
  { id_prefix: 'fe-api', name: 'API 연동 레이어', prompt_instruction: 'API 클라이언트 아키텍처, 공통 요청/응답 타입, 에러 핸들링 전략, 로딩/성공/실패 상태 관리를 설계하라' },
  { id_prefix: 'fe-token', name: '디자인 시스템', prompt_instruction: '컬러 토큰, 타이포그래피/스페이싱 스케일, 컴포넌트 변형, 다크모드 토큰, 반응형 브레이크포인트를 설계하라' },
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
아래 문서들을 분석하여 프론트엔드 아키텍처를 ${activePerspectives.length}개 섹션으로 설계하세요.

## 설계 섹션

${sectionLines}

## 출력 형식

반드시 아래 JSON 형식으로만 출력하세요:

\`\`\`json
{
  "issues": [
    {
      "id": "fe-comp1",
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
- category는 해당 관점의 id_prefix 대문자 (예: FE-COMP, FE-STATE...)
- tag: "decision" | "trade-off" | "dependency"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "red" (P0) | "orange" (P1) | "blue" (P2)
- 각 섹션당 최소 2개, 최대 5개 항목
- <context:ref-items>가 있다면 반드시 설계에 반영하세요
- <context:ai-guide>의 기술 제약/톤/원칙을 설계에 반영하세요
- <context:glossary>가 있다면 용어를 일관되게 사용하세요
- PRD에서 실제로 도출 가능한 설계만 포함
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
