import { type ContextPackage, formatContextForPrompt } from '../context-package.js';

export function buildBackendPrompt(ctx: ContextPackage): string {
  const contextBlock = formatContextForPrompt(ctx);

  return `당신은 시니어 백엔드 아키텍트입니다.
아래 문서들을 분석하여 백엔드 아키텍처를 5개 섹션으로 설계하세요.

## 설계 섹션

**A. API 설계 (BE-API)**: REST 엔드포인트 정의, HTTP 메서드/URL/요청-응답 스키마, 인증 레벨, 페이지네이션 전략, 에러 포맷
**B. DB 스키마 (BE-DB)**: 도메인별 엔티티, 컬럼 정의(타입/인덱스/제약), ERD 관계, 소프트 딜리트 적용 여부, 마이그레이션 전략
**C. 인프라 (BE-INFRA)**: 배포 토폴로지, 메시지 큐/이벤트 설계, 캐시 전략(캐시 대상/TTL/무효화), 파일 스토리지
**D. 라이브러리 (BE-LIB)**: 추가 필요 라이브러리, 버전 호환성 이슈, 선택 근거 및 트레이드오프
**E. 서비스 레이어 (BE-SVC)**: 핵심 유스케이스 및 처리 흐름, 레이어 구조, 트랜잭션 경계, 도메인 이벤트

## 출력 형식

반드시 아래 JSON 형식으로만 출력하세요:

\`\`\`json
{
  "issues": [
    {
      "id": "be-api1",
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
- id 패턴: be-api1~9, be-db1~9, be-infra1~9, be-lib1~9, be-svc1~9
- tag: "decision" | "trade-off" | "dependency"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "red" (P0) | "orange" (P1) | "blue" (P2)
- 각 섹션당 최소 2개, 최대 5개 항목
- <context:ai-guide>의 기술 제약/원칙을 설계에 반영하세요
- <context:glossary>가 있다면 용어를 일관되게 사용하세요
- <context:decisions>의 기존 결정과 충돌하지 않도록 하세요
- PRD에서 실제로 도출 가능한 설계만 포함 (억지로 만들지 말 것)
- JSON만 출력, 다른 텍스트 없음

## 문서 컨텍스트

${contextBlock}`;
}
