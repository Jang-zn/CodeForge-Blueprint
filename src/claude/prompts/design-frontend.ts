import { type ContextPackage, formatContextForPrompt } from '../context-package.js';

export function buildFrontendPrompt(ctx: ContextPackage): string {
  const contextBlock = formatContextForPrompt(ctx);

  return `당신은 시니어 프론트엔드 아키텍트입니다.
아래 문서들을 분석하여 프론트엔드 아키텍처를 5개 섹션으로 설계하세요.

## 설계 섹션

**A. 화면/컴포넌트 계층 (FE-COMP)**: 화면 인벤토리, 화면 계층 구조, 공용 컴포넌트 후보, 화면-컴포넌트 매핑
**B. 상태 관리 (FE-STATE)**: 글로벌/로컬 상태 경계, 도메인별 상태 형태, 서버 상태 캐시 전략, 낙관적 업데이트 대상
**C. 네비게이션/라우팅 (FE-ROUTE)**: 네비게이션 스택, 딥링크 스키마(모바일), 인증 게이트 라우트, 딥링크-화면 매핑
**D. API 연동 레이어 (FE-API)**: API 클라이언트 아키텍처, 공통 요청/응답 타입, 에러 핸들링 전략, 로딩/성공/실패 상태 관리
**E. 디자인 시스템 (FE-TOKEN)**: 컬러 토큰, 타이포그래피/스페이싱 스케일, 컴포넌트 변형, 다크모드 토큰, 반응형 브레이크포인트

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
- id 패턴: fe-comp1~9, fe-state1~9, fe-route1~9, fe-api1~9, fe-token1~9
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
