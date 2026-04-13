import { type ContextPackage, formatContextForPrompt } from '../context-package.js';
import { type Perspective } from '../../db/repository.js';
import { ID_CONTINUITY_RULES } from './index.js';

// 기본 관점 (DB 없을 때 폴백)
const DEFAULT_PERSPECTIVES = [
  { id_prefix: 'a', name: '기획 정합성', prompt_instruction: '정책/정의 간 충돌, 미정의 항목, 논리적 모순, 범위 중복, 서비스 정체성 혼란을 검토하라' },
  { id_prefix: 'b', name: 'MVP 범위', prompt_instruction: '핵심 가치 외 과잉 기능, Nice-to-have의 Must-have 혼입, 첫 출시 과부하 위험을 검토하라' },
  { id_prefix: 'c', name: '구현 현실성', prompt_instruction: '기술 스택 미지정, 외부 의존성 리스크, 타임라인 현실성, 솔로 개발자 실행 가능성을 검토하라' },
  { id_prefix: 'd', name: '운영 부담', prompt_instruction: '런칭 후 수동 작업, CS 부하, 콘텐츠 운영 필요성, 모니터링 복잡도를 검토하라' },
  { id_prefix: 'e', name: '사용자 가치 명확성', prompt_instruction: '핵심 사용자 여정, 가치 전달 명확성, 첫 경험 설계, 이탈 지점을 검토하라' },
  { id_prefix: 'f', name: '출시 리스크', prompt_instruction: '규제/법적 이슈, 경쟁 포지셔닝, 시장 타이밍, 초기 트랙션 전략을 검토하라' },
];

export function buildReviewPlanPrompt(ctx: ContextPackage, perspectives?: Perspective[]): string {
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
    return `${p.id_prefix}1~${p.id_prefix}9 (${p.name})`;
  }).join(', ');

  return `당신은 시니어 프로덕트 매니저 겸 기획 검토 전문가입니다.
아래 문서들을 분석해서 모순, 사각지대, 운영 리스크를 찾아내세요.

## 분석 지시사항

${activePerspectives.length}개 관점으로 병렬 분석을 수행하세요. 각 관점에서 새로운 이슈만 발굴하세요.

${sectionLines}

## 출력 형식

반드시 아래 JSON 형식으로 출력하세요:

\`\`\`json
{
  "mode": "A",
  "issues": [
    {
      "id": "a1",
      "basis_issue_id": "a1",
      "category": "A",
      "title": "이슈 제목",
      "tag": "contradiction",
      "priority": "P1",
      "description": "이슈 상세 설명 (2-4문장)",
      "evidence": "PRD에서 발견한 구체적 근거 (인용 또는 설명)",
      "conclusion": "권장 해결 방향",
      "callout_type": "red"
    }
  ],
  "refItems": [
    "FE 구현 시 고려할 참고사항 1",
    "FE 구현 시 고려할 참고사항 2"
  ]
}
\`\`\`

**규칙:**
- id 패턴: ${idPatternLines}
${ID_CONTINUITY_RULES}
- category는 해당 관점의 id_prefix 대문자 (예: A, B, C...)
- tag: "contradiction" | "blind" | "risk"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "red" (P0) | "orange" (P1) | "blue" (P2)
- 각 관점당 최소 2개, 최대 5개 이슈
- refItems: FE 구현 시 고려할 참고사항 (이슈가 아닌 구현 힌트)
- <context:user-feedback>가 있다면 반드시 반영: "확정" 방향을 따르고, "삭제"된 이슈는 재생산 금지, "보류" 주제는 건너뛰세요
- <context:ai-guide>가 있다면 그 원칙을 분석 기준에 반영하세요
- <context:glossary>가 있다면 용어를 동일하게 사용하세요
- 실제 발견된 이슈만 포함 (억지로 이슈를 만들지 말 것)
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
