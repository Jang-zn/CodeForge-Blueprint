import { type ContextPackage, formatContextForPrompt } from '../context-package.js';

export function buildFeaturesPrompt(ctx: ContextPackage): string {
  const contextBlock = formatContextForPrompt(ctx);

  const deferredSection = ctx.decisions?.length
    ? `\n## 기획 리뷰에서 보류된 항목 (다음 버전 후보)\n${ctx.decisions.map(d =>
        `- [${d.date}] ${d.memo}${d.reason ? `: ${d.reason}` : ''}`
      ).join('\n')}\n위 항목들을 다음 버전 기능으로 발전시킬 수 있는지 각 관점에서 평가하고, 가능하면 제안에 포함하세요.\n`
    : '';

  return `당신은 시니어 프로덕트 매니저입니다.
아래 문서들을 분석하여 다음 버전 기능을 4개 관점에서 제안하세요.

## 분석 관점

**마케팅 관점 (FT-MKT)**: 바이럴 루프, 레퍼럴 프로그램, 브랜드 포지셔닝, 유저 그로스 드라이버, 시즌/이벤트 기능
**운영 관점 (FT-OPS)**: 자동화 도구, 운영 모니터링 대시보드, CS 효율화, 비용 절감, 어뷰징 방지, 내부 관리 도구
**서비스 기획 관점 (FT-SVC)**: 사용자 여정 갭 메우기, 리텐션 훅, 인게이지먼트 루프, 커뮤니티 기능, 개인화/추천
**기술 관점 (FT-TECH)**: 인프라 확장, 성능 최적화, 데이터 파이프라인, A/B 테스트 인프라, 기술 부채 해소
${deferredSection}
## 출력 형식

반드시 아래 JSON 형식으로만 출력하세요:

\`\`\`json
{
  "issues": [
    {
      "id": "ft-mkt1",
      "category": "FT-MKT",
      "title": "기능 제목",
      "tag": "marketing",
      "priority": "P1",
      "description": "기능 설명 및 사용자 스토리 (2-3문장)",
      "evidence": "현재 PRD 또는 서비스 구조에서 도출한 근거",
      "conclusion": "build | skip | defer — 이유",
      "callout_type": "green"
    }
  ]
}
\`\`\`

**규칙:**
- id 패턴: ft-mkt1~9, ft-ops1~9, ft-svc1~9, ft-tech1~9
- tag: "marketing" | "ops" | "service" | "tech"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "green" (build) | "orange" (defer) | "red" (skip)
- 각 관점당 최소 2개, 최대 5개 항목
- <context:ai-guide>의 우선순위 기준/금지사항을 반드시 반영하세요
- <context:glossary>가 있다면 용어를 일관되게 사용하세요
- conclusion은 반드시 "build", "skip", "defer" 중 하나로 시작하고 그 이유를 작성
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
