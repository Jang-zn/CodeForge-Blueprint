export interface InitFormData {
  projectName: string;
  tagline: string;
  serviceType: string;
  // 서비스 동작 방식 (비개발자 친화 질문)
  dataStorage: string;        // 'none' | 'local' | 'server' | 'unknown'
  needAccount: string;        // 'none' | 'optional' | 'required' | 'unknown'
  multiUser: string;          // 'solo' | 'read-only' | 'interactive' | 'realtime' | 'unknown'
  usageEnvironment: string[]; // ['desktop-web', 'mobile-app', 'mobile-web', 'desktop-app', 'unknown']
  needNotification: string;   // 'none' | 'email' | 'push' | 'realtime' | 'unknown'
  hasPayment: string;         // 'none' | 'subscription' | 'p2p' | 'unknown'
  // 서비스 성격
  targets: string[];
  revenues: string[];
  features: string[];
  // 기술 선호도 (선택, 개발자용)
  feTech: string[];
  beTech: string[];
  storageTech: string[];
  detail: string;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  'web-fullstack': '웹 서비스 (풀스택)',
  'web-frontend': '웹 서비스 (FE 단독 — 서버 없음)',
  'pwa': 'PWA (웹앱 — 설치 가능, 오프라인 지원)',
  'mobile': '모바일 앱 (iOS + Android)',
  'ios': 'iOS 앱',
  'android': 'Android 앱',
  'desktop': '데스크톱 앱',
  'cli': 'CLI / 터미널 도구',
  'script': '스크립트 / 매크로',
  'api': 'API / 백엔드 단독',
  'extension': '브라우저 확장',
  'sdk': 'SDK / 라이브러리',
  'game': '게임',
  'unknown': '미정',
};

const DEPLOY_TARGET_LABELS: Record<string, string> = {
  'web-browser': '웹 브라우저 (OS 무관)',
  'ios': 'iOS',
  'android': 'Android',
  'windows': 'Windows',
  'macos': 'macOS',
  'linux': 'Linux',
  'cross-platform': '크로스 플랫폼',
  'server-only': '서버 전용',
  'unknown': '미정',
};

const TARGET_LABELS: Record<string, string> = {
  b2c: '일반 소비자 (B2C)',
  b2b: '기업 고객 (B2B)',
  developer: '개발자',
  internal: '내부 운영용',
  personal: '개인 도구 (혼자 사용)',
};

const REVENUE_LABELS: Record<string, string> = {
  freemium: '프리미엄 (무료+유료)',
  subscription: '구독제',
  onetime: '일회성 결제',
  ads: '광고 기반',
  commission: '커미션/수수료',
  opensource: '오픈소스 (무료)',
  donation: '기부/후원',
  undecided: '미정',
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
  auth: '인증/보안',
  location: '위치/지도',
  settings: '설정/개인화',
  offline: '오프라인 지원',
};

const DATA_STORAGE_LABELS: Record<string, string> = {
  none: '저장 불필요 (보여주기만 하면 됨)',
  local: '내 기기에만 저장 (다른 기기에선 안 보여도 됨)',
  server: '서버에 저장 (어디서든 접근 가능)',
  unknown: '미정',
};

const NEED_ACCOUNT_LABELS: Record<string, string> = {
  none: '필요 없음 (누구나 바로 사용)',
  optional: '선택 사항 (로그인 시 더 많은 기능)',
  required: '필수 (로그인 없으면 사용 불가)',
  unknown: '미정',
};

const MULTI_USER_LABELS: Record<string, string> = {
  solo: '나 혼자만 사용',
  'read-only': '다른 사람 것을 볼 수 있음 (읽기 위주)',
  interactive: '서로 주고받음 (글, 댓글, 공유)',
  realtime: '실시간으로 함께 (채팅, 동시 편집)',
  unknown: '미정',
};

const USAGE_ENV_LABELS: Record<string, string> = {
  'desktop-web': '컴퓨터 웹 브라우저',
  'mobile-app': '스마트폰 앱 (앱스토어 설치)',
  'mobile-web': '스마트폰 웹 (브라우저 접속)',
  'desktop-app': 'PC 프로그램 (윈도우/맥 설치)',
  unknown: '미정',
};

const NEED_NOTIFICATION_LABELS: Record<string, string> = {
  none: '알림 불필요',
  email: '이메일 알림 (주문 확인, 비밀번호 재설정 등)',
  push: '앱 푸시 알림 (새 메시지, 배송 상태 등)',
  realtime: '실시간 알림 (채팅, 주식 가격 변동 등)',
  unknown: '미정',
};

const HAS_PAYMENT_LABELS: Record<string, string> = {
  none: '없음',
  subscription: '유료 구독/결제 (사용자가 돈을 냄)',
  p2p: '사용자 간 거래 (사용자끼리 돈을 주고받음)',
  unknown: '미정',
};

const STORAGE_LABELS: Record<string, string> = {
  localstorage: 'LocalStorage / SessionStorage',
  indexeddb: 'IndexedDB',
  filesystem: '파일 시스템',
  'sqlite-local': 'SQLite (로컬)',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
  firebase: 'Firebase / Firestore',
  supabase: 'Supabase',
  'no-storage': '저장소 불필요',
  'storage-unknown': '미정',
};

const FE_TECH_LABELS: Record<string, string> = {
  react: 'React / Next.js',
  vue: 'Vue / Nuxt',
  svelte: 'Svelte / SvelteKit',
  angular: 'Angular',
  vanilla: 'Vanilla JS / HTML',
  flutter: 'Flutter',
  swift: 'Swift / SwiftUI',
  kotlin: 'Kotlin / Jetpack Compose',
  'react-native': 'React Native',
  electron: 'Electron',
  tauri: 'Tauri',
  'fe-unknown': '미정',
};

const BE_TECH_LABELS: Record<string, string> = {
  'no-backend': '백엔드 없음 (FE 단독)',
  nodejs: 'Node.js / Express',
  fastify: 'Node.js / Fastify',
  python: 'Python / FastAPI',
  django: 'Python / Django',
  java: 'Java / Spring',
  go: 'Go',
  rust: 'Rust',
  dotnet: '.NET / C#',
  ruby: 'Ruby on Rails',
  php: 'PHP / Laravel',
  serverless: 'Serverless (Lambda 등)',
  'be-unknown': '미정',
};

function labels(map: Record<string, string>, keys: string[]): string {
  return keys.map(k => map[k] ?? k).join(', ') || '미선택';
}

export function buildInitPrompt(data: InitFormData): string {
  const noBackend = data.beTech.includes('no-backend') || data.serviceType === 'web-frontend';
  const isClientOnly = noBackend || ['cli', 'script', 'sdk'].includes(data.serviceType);

  const techSection = isClientOnly
    ? `**클라이언트 기술**: ${labels(FE_TECH_LABELS, data.feTech)}
**데이터 저장 방식**: ${labels(STORAGE_LABELS, data.storageTech)}
**백엔드**: 없음 (클라이언트 단독 동작)`
    : `**프론트엔드 기술**: ${labels(FE_TECH_LABELS, data.feTech)}
**백엔드 기술**: ${labels(BE_TECH_LABELS, data.beTech.filter(t => t !== 'no-backend'))}
**데이터 저장소**: ${labels(STORAGE_LABELS, data.storageTech)}`;

  const techStackSection = isClientOnly
    ? `## 6. 기술 스택 (안)
[클라이언트 기술 스택 및 데이터 저장 전략 — LocalStorage/IndexedDB/파일시스템 등 로컬 저장 방식 포함]`
    : `## 6. 기술 스택 (안)
[선택한 기술 스택 및 선택 이유 — 프론트엔드, 백엔드, DB 각각 기술하고 배포 대상 OS/환경 고려사항 포함]`;

  return `당신은 시니어 프로덕트 매니저입니다. 아래 서비스 아이디어를 바탕으로 구조화된 PRD(Product Requirements Document) 초안을 작성하세요.

## 입력 정보

**프로젝트명**: ${data.projectName || '미정'}
**서비스 한 줄 설명**: ${data.tagline || '미작성'}
**서비스 유형**: ${(SERVICE_TYPE_LABELS[data.serviceType] ?? data.serviceType) || '미선택'}
**주요 사용자**: ${labels(TARGET_LABELS, data.targets)}
**수익 모델**: ${labels(REVENUE_LABELS, data.revenues)}
**핵심 기능 영역**: ${labels(FEATURE_LABELS, data.features)}

### 서비스 동작 방식 (사용자 답변)
**데이터 저장**: ${DATA_STORAGE_LABELS[data.dataStorage] ?? '미선택'}
**계정/로그인**: ${NEED_ACCOUNT_LABELS[data.needAccount] ?? '미선택'}
**사용자 관계**: ${MULTI_USER_LABELS[data.multiUser] ?? '미선택'}
**사용 환경**: ${labels(USAGE_ENV_LABELS, data.usageEnvironment)}
**알림 방식**: ${NEED_NOTIFICATION_LABELS[data.needNotification] ?? '미선택'}
**결제/거래**: ${HAS_PAYMENT_LABELS[data.hasPayment] ?? '미선택'}

${techSection}

**상세 기획**:
${data.detail}

## PRD 작성 지침

아래 구조로 PRD 마크다운 문서를 작성하세요. 각 섹션은 입력 정보를 바탕으로 구체적으로 작성하되, 불명확한 부분은 TBD로 표시하세요.

**중요**: 입력 정보를 제공한 사람은 비개발자입니다. "서비스 동작 방식" 답변을 바탕으로 다음을 추론하여 PRD에 반영하세요:
- 배포 대상 플랫폼 (iOS, Android, 웹, 데스크톱 등) — 사용 환경 답변에서 도출
- 백엔드 아키텍처 필요 여부 — 데이터 저장 방식, 사용자 관계, 알림 요구에서 도출
- 데이터 저장 전략 (로컬 vs 클라우드, DB 유형) — 데이터 저장·계정 답변에서 도출
- 인증/계정 방식 (소셜 로그인, 이메일 등) — 로그인 필요 여부에서 도출
- 알림 인프라 (FCM, WebSocket, 이메일 서비스 등) — 알림 방식에서 도출
- 결제 연동 필요 여부 및 방식 — 결제 답변에서 도출
"기술 선호도"가 비어 있으면 서비스 특성에 맞는 최적의 기술 스택을 직접 추천하세요.
${isClientOnly ? '백엔드가 없는 클라이언트 단독 서비스이므로 로컬 데이터 관리, 오프라인 지원, 보안(클라이언트 사이드) 등을 기술하세요.' : ''}

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

${techStackSection}

## 7. 배포 및 운영 환경
[배포 대상 OS/플랫폼별 고려사항, 설치/배포 방식, 업데이트 전략]

## 8. 제약 사항 및 리스크
[기술적/비즈니스적 제약, 플랫폼별 제한사항, 주요 리스크]

## 9. 성공 지표 (KPI)
[서비스 성공을 측정할 핵심 지표]
\`\`\`

위 구조를 채워서 완성된 PRD 마크다운만 출력하세요. 추가 설명이나 메타 코멘트 없이 PRD 문서 내용만 출력합니다.`;
}
