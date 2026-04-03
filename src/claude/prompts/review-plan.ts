import fs from 'fs';

export function buildReviewPlanPrompt(prdPath: string): string {
  const prdContent = fs.readFileSync(prdPath, 'utf-8');

  return `당신은 시니어 프로덕트 매니저 겸 기획 검토 전문가입니다.
아래 PRD를 분석해서 모순, 사각지대, 운영 리스크를 찾아내세요.

## 분석 지시사항

6개 관점으로 병렬 분석을 수행하세요. 각 관점에서 새로운 이슈만 발굴하세요.

**A. 기획 정합성**: 정책/정의 간 충돌, 미정의 항목, 논리적 모순, 범위 중복, 서비스 정체성 혼란
**B. 수익/과금 모델**: 과금 구조 모순, 무료/유료 경계 미정의, 크레딧 라이프사이클, 결제 환불 정책, 단위경제학
**C. 사용자 획득/유지**: 콜드스타트 전략, 콘텐츠 노출 알고리즘, 유입-소비 루프, 발견 경로, 리텐션 훅
**D. 구현 가능성**: 누락된 UX 플로우, 상태 관리 갭, 데이터 모델 모순, 비동기 처리 UX, 레이스 컨디션
**E. 운영 확장성**: 수동 프로세스 병목, 외부 데이터 의존성, 모더레이션 갭, SLA 강제 가능성
**F. 법적/규제 리스크**: 개인정보 동의 플로우, 외부 플랫폼 ToS 위반, 초상권, 계정 삭제 정책

## 출력 형식

반드시 아래 JSON 형식으로 출력하세요:

\`\`\`json
{
  "mode": "A",
  "issues": [
    {
      "id": "a1",
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
- id 패턴: a1~a9 (기획정합성), b1~b9 (수익), c1~c9 (사용자), d1~d9 (구현), e1~e9 (운영), f1~f9 (법적)
- tag: "contradiction" | "blind" | "risk"
- priority: "P0" (즉시) | "P1" (중요) | "P2" (검토)
- callout_type: "red" (P0) | "orange" (P1) | "blue" (P2)
- 각 관점당 최소 2개, 최대 5개 이슈
- refItems: FE 구현 시 고려할 참고사항 (이슈가 아닌 구현 힌트)
- 실제 발견된 이슈만 포함 (억지로 이슈를 만들지 말 것)
- JSON만 출력, 다른 텍스트 없음

## PRD 문서

${prdContent}`;
}
