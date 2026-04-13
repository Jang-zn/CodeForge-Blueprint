import { type ContextPackage, formatContextForPrompt } from '../context-package.js';
import { type Perspective } from '../../db/repository.js';
import { ID_CONTINUITY_RULES, FEEDBACK_RULES } from './index.js';

// 기본 관점 (DB 없을 때 폴백)
const DEFAULT_PERSPECTIVES = [
  { id_prefix: 'ft-mkt', name: '마케팅 관점', prompt_instruction: '핵심 가치가 검증된 이후에 의미 있는 마케팅/성장 기능을 제안하라. 검증 전에는 바이럴 루프보다 직접 연결이 더 효과적임을 판단하라' },
  { id_prefix: 'ft-ops', name: '운영 관점', prompt_instruction: '각 기능 제안이 솔로 개발자의 운영 부담을 늘리는지 판단하라. 자동화로 먼저 해결 가능한 운영 문제를 우선 제안하라' },
  { id_prefix: 'ft-svc', name: '서비스 기획 관점', prompt_instruction: '핵심 가치 경험을 직접 강화하는 기능인지 판단하라. 기능 추가보다 기존 문제 해결을 강화하는 방향이 우선임을 기준으로 제안하라' },
  { id_prefix: 'ft-tech', name: '기술 관점', prompt_instruction: '기술 부채 해소나 리팩토링이 실제 다음 사용자 기능 개발의 병목을 제거하는지 판단하라. 리팩토링 욕구와 실제 제품 리스크를 구분하라' },
];

export function buildFeaturesPrompt(ctx: ContextPackage, perspectives?: Perspective[]): string {
  const contextBlock = formatContextForPrompt(ctx);

  const deferredSection = ctx.decisions?.length
    ? `\n## 기획 리뷰에서 보류된 항목 (다음 버전 후보)\n${ctx.decisions.map(d =>
        `- [${d.date}] ${d.memo}${d.reason ? `: ${d.reason}` : ''}`
      ).join('\n')}\n위 항목들을 다음 버전 기능으로 발전시킬 수 있는지 각 관점에서 평가하고, 가능하면 제안에 포함하세요.\n`
    : '';

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

  return `당신은 시니어 프로덕트 매니저입니다.
아래 문서들을 분석하여 다음 버전 기능을 ${activePerspectives.length}개 관점에서 제안하세요.

## 분석 관점

${sectionLines}
${deferredSection}
## 출력 형식

반드시 아래 JSON 형식으로만 출력하세요:

\`\`\`json
{
  "issues": [
    {
      "id": "ft-mkt1",
      "basis_issue_id": "ft-mkt1",
      "category": "FT-MKT",
      "title": "기능 제목",
      "tag": "marketing",
      "priority": "P1",
      "description": "기능 설명 및 사용자 스토리 (2-3문장)",
      "evidence": "현재 PRD 또는 서비스 구조에서 도출한 근거",
      "conclusion": "build | shrink | experiment | defer | skip — 이유",
      "callout_type": "green"
    }
  ]
}
\`\`\`

**규칙:**
- id 패턴: ${idPatternLines}
${ID_CONTINUITY_RULES}
- category는 해당 관점의 id_prefix 대문자 (예: FT-MKT, FT-OPS...)
- tag: "marketing" | "ops" | "service" | "tech"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "green" (build) | "blue" (shrink) | "orange" (experiment) | "grey" (defer) | "red" (skip)
- 각 관점당 최소 2개, 최대 5개 항목
${FEEDBACK_RULES}
- <context:ai-guide>의 우선순위 기준/금지사항을 반드시 반영하세요
- <context:glossary>가 있다면 용어를 일관되게 사용하세요
- conclusion은 반드시 "build"(다음 사이클에 만들 기능), "shrink"(축소 형태로 만들 기능), "experiment"(실험으로 먼저 검증할 기능), "defer"(이후 버전으로 미룰 기능), "skip"(안 만드는 게 나은 기능) 중 하나로 시작하고 그 이유를 작성
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
