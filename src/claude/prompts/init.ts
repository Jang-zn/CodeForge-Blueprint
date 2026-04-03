export interface InitFormData {
  projectName: string;
  tagline: string;
  serviceType: string;
  targets: string[];
  revenues: string[];
  features: string[];
  feTech: string[];
  beTech: string[];
  dbTech: string[];
  detail: string;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  web: '웹 서비스',
  mobile: '모바일 앱',
  desktop: '데스크톱 프로그램',
  cli: 'CLI 도구',
  api: 'API 서비스',
  extension: '브라우저 확장',
};

const TARGET_LABELS: Record<string, string> = {
  b2c: '일반 소비자 (B2C)',
  b2b: '기업 (B2B)',
  developer: '개발자',
  internal: '내부 운영용',
};

const REVENUE_LABELS: Record<string, string> = {
  freemium: '프리미엄 (무료+유료)',
  subscription: '구독제',
  onetime: '일회성 결제',
  ads: '광고 기반',
  commission: '커미션/수수료',
  opensource: '오픈소스 (무료)',
};

const FEATURE_LABELS: Record<string, string> = {
  content: '콘텐츠 생성/관리',
  social: '소셜/커뮤니티',
  search: '검색/탐색',
  payment: '결제/거래',
  messaging: '알림/메시징',
  analytics: '분석/대시보드',
  ai: 'AI/자동화',
  files: '파일/미디어 관리',
  scheduling: '일정/예약',
};

function labels(map: Record<string, string>, keys: string[]): string {
  return keys.map(k => map[k] ?? k).join(', ') || '미선택';
}

export function buildInitPrompt(data: InitFormData): string {
  return `당신은 시니어 프로덕트 매니저입니다. 아래 서비스 아이디어를 바탕으로 구조화된 PRD(Product Requirements Document) 초안을 작성하세요.

## 입력 정보

**프로젝트명**: ${data.projectName || '미정'}
**서비스 한 줄 설명**: ${data.tagline || '미작성'}
**서비스 유형**: ${(SERVICE_TYPE_LABELS[data.serviceType] ?? data.serviceType) || '미선택'}
**주요 사용자**: ${labels(TARGET_LABELS, data.targets)}
**수익 모델**: ${labels(REVENUE_LABELS, data.revenues)}
**핵심 기능 영역**: ${labels(FEATURE_LABELS, data.features)}
**프론트엔드 기술**: ${data.feTech.join(', ') || '미정'}
**백엔드 기술**: ${data.beTech.join(', ') || '미정'}
**데이터베이스**: ${data.dbTech.join(', ') || '미정'}

**상세 기획**:
${data.detail}

## PRD 작성 지침

아래 구조로 PRD 마크다운 문서를 작성하세요. 각 섹션은 입력 정보를 바탕으로 구체적으로 작성하되, 불명확한 부분은 TBD로 표시하세요.

\`\`\`markdown
# ${data.projectName || '프로젝트명'} PRD v0.1.0

## 1. 서비스 개요
### 1.1 서비스 비전
[한 문장 비전 서술]

### 1.2 문제 정의
[해결하려는 문제]

### 1.3 핵심 가치 제안
[사용자가 얻는 가치]

## 2. 타겟 사용자
### 2.1 주요 페르소나
[구체적인 사용자 페르소나 1-2개]

### 2.2 사용자 시나리오
[핵심 사용 시나리오]

## 3. 서비스 범위 (MVP)
### 3.1 포함 기능
[MVP에 포함되는 핵심 기능 목록]

### 3.2 제외 기능 (v2+)
[MVP에서 제외하고 이후 버전에서 다룰 기능]

## 4. 기능 명세
[각 핵심 기능별 상세 명세 - 기능명, 설명, 사용자 흐름, 예외 처리]

## 5. 수익 모델
[구체적인 과금 구조, 무료/유료 경계, 가격 정책]

## 6. 기술 스택 (안)
[선택한 기술 스택 및 선택 이유]

## 7. 제약 사항 및 리스크
[기술적/비즈니스적 제약, 주요 리스크]

## 8. 성공 지표 (KPI)
[서비스 성공을 측정할 핵심 지표]
\`\`\`

위 구조를 채워서 완성된 PRD 마크다운만 출력하세요. 추가 설명이나 메타 코멘트 없이 PRD 문서 내용만 출력합니다.`;
}
