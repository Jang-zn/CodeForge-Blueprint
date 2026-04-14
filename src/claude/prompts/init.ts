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

// ===== 인터뷰 블록 구조 (Phase 4) =====

export interface InterviewQuestion {
  id: string;
  text: string;
  placeholder?: string;
  required: boolean;
  type?: 'text' | 'multiline' | 'multiselect' | 'radio';
  options?: Array<{ value: string; label: string }>;
}

export interface InterviewBlock {
  blockIndex: number;
  title: string;
  description: string;
  questions: InterviewQuestion[];
  hint?: string;
}

export interface InterviewResponse {
  blockIndex: number;
  totalBlocks: number;
  questions: InterviewQuestion[];
  hint?: string;
  nextUrl?: string;
}

/** 인터뷰 메타데이터: PRD 생성 시 프롬프트에 주입되는 구조화 정보 */
export interface InterviewMeta {
  primaryUser?: string;           // 앱을 매일 사용하는 사람 (1순위 사용자)
  secondaryUser?: string;         // 2순위 사용자
  primaryGoal?: string;           // 사용자가 얻으려고 하는 주요 목표
  firstValueMoment?: string;      // 사용자가 첫 가치를 느끼는 순간
  repeatAction?: string;          // 가장 자주 반복할 핵심 행동
  offlineConnection?: string;     // 오프라인 행위와의 연결고리
  mustHaveFeatures?: string[];    // MVP에 반드시 필요한 기능
  niceToHaveFeatures?: string[];  // 미뤄도 되는 기능
  riskFlags?: string[];           // 불명확하거나 위험한 항목
  adminNeeded?: boolean;          // 관리자 기능 필요 여부
  monetizationPoint?: string;     // 돈이 들어오거나 나가는 지점
  platformPriority?: 'mobile' | 'desktop' | 'web' | 'multi';
}

export interface InitPrdOutput {
  prd: string;                    // PRD 마크다운
  meta: InterviewMeta;            // 구조화 메타데이터
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

function PRD_TEMPLATE_SKELETON(projectName: string | undefined, techStackSection: string): string {
  return `# ${projectName || '프로젝트명'} PRD v0.1.0

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
[서비스 성공을 측정할 핵심 지표]`;
}

/**
 * Phase 4 인터뷰 답변에서 구조화 메타데이터 추출
 * interviewAnswers: Record<questionId, string | string[]> — 각 질문 ID별 답변
 */
export function extractInterviewMeta(interviewAnswers: Record<string, string | string[]>): InterviewMeta {
  return {
    primaryUser: String(interviewAnswers['q-end-user'] ?? '').substring(0, 150),
    secondaryUser: undefined, // Block 2의 '2순위'에서 추출 가능
    primaryGoal: String(interviewAnswers['q-repeat-action'] ?? '').substring(0, 150),
    firstValueMoment: String(interviewAnswers['q-first-value'] ?? '').substring(0, 150),
    repeatAction: String(interviewAnswers['q-repeat-action'] ?? '').substring(0, 150),
    offlineConnection: String(interviewAnswers['q-offline-link'] ?? '').substring(0, 200),
    riskFlags: [],
    adminNeeded: String(interviewAnswers['q-admin-needed'] ?? '').includes('yes'),
    monetizationPoint: String(interviewAnswers['q-monetization'] ?? '').substring(0, 150),
    platformPriority: (interviewAnswers['q-platform-priority'] ?? 'multi') as any,
  };
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
${PRD_TEMPLATE_SKELETON(data.projectName, techStackSection)}
\`\`\`

위 구조를 채워서 완성된 PRD 마크다운만 출력하세요. 추가 설명이나 메타 코멘트 없이 PRD 문서 내용만 출력합니다.`;
}

export function buildCodebasePrdPrompt(scanContext: string): string {
  return `당신은 시니어 프로덕트 매니저 겸 테크 리드입니다.

아래는 기존 코드베이스를 자동 스캔한 결과입니다(디렉토리 구조 + 주요 파일 발췌 + 의존성). 이 스캔 결과만을 바탕으로, 이 코드베이스를 처음 접하는 신규 팀원이 프로젝트 전체를 이해할 수 있도록, 두 가지를 겸한 상세 문서를 작성하세요:
(1) PRD — 이 제품이 무엇이고 무엇을 해결하는지
(2) 개발자 온보딩 가이드 — 코드베이스 구조, 실행 방법, 컨벤션

## 작성 원칙
- 스캔 결과를 출발점으로 삼되, 핵심 소스 파일을 직접 읽어 더 깊이 분석하세요. 서브에이전트를 활용해 여러 파일/모듈을 병렬로 분석하면 더 빠릅니다.
- 구현된 기능만 기술하세요. 미구현 기능은 추측하지 마세요. README에만 언급된 것은 [TBD] 표시하세요.
- 각 섹션을 충분한 깊이로 서술하세요. 간략한 한 줄 요약은 금지합니다. 직접 읽은 소스 파일에서 관찰한 구체적인 증거를 들어 서술하세요.
- 파일에서 확인되지 않는 정보는 절대 만들어내지 마세요. 추측하지 말고 [TBD]로 표시하세요.
- 파일 접근, 권한 요청, 도구 사용 등의 메타 코멘트를 출력하지 마세요. 최종 출력은 PRD 마크다운 문서만 출력하세요.

---

## 코드베이스 분석 결과

${scanContext}

---

## 출력 형식

아래 구조로 PRD + 온보딩 가이드 마크다운 문서를 작성하세요. 각 섹션의 지시사항에 따라 구체적으로 작성하되, 불명확한 부분은 [TBD]로 표시하세요.

\`\`\`markdown
# {프로젝트명} PRD v0.1.0

## 1. 서비스 개요
### 1.1 서비스 비전
[코드와 README에서 파악한 이 프로젝트의 목적 — 구체적으로]
### 1.2 문제 정의
[이 프로젝트가 해결하려는 문제]
### 1.3 핵심 가치 제안
[사용자가 얻는 가치]

## 2. 타겟 사용자
### 2.1 주요 페르소나
[코드/README에서 파악한 대상 사용자 — 구체적으로]
### 2.2 사용자 시나리오
[핵심 사용 흐름]

## 3. 현재 구현 상태 (as-is)
### 3.1 구현된 기능 목록
[각 기능: 이름, 설명, 관련 코드 위치 힌트]
### 3.2 미구현/계획 중 기능
[README에 언급되었으나 코드에서 확인 안 된 것 — [TBD] 표시]

## 4. 기능 명세
[각 핵심 기능별 상세 명세: 기능명, 설명, 사용자 흐름, 예외 처리, 구현 힌트]

## 5. 수익 모델
[코드/README에서 파악한 수익 구조 — 불명확하면 "파악 불가"]

## 6. 기술 스택 및 아키텍처
### 6.1 기술 스택
[감지된 의존성 목록 + 각 라이브러리의 역할 설명]
### 6.2 시스템 아키텍처
[엔트리포인트, 모듈 구조, 데이터 흐름 — 코드에서 관찰한 것]
### 6.3 데이터 저장
[DB 스키마, 저장 방식]

## 7. 배포 및 실행 환경
### 7.1 로컬 실행 방법
[package.json scripts / Makefile / README에서 추출]
### 7.2 환경 변수
[.env.example 기반 전체 목록 + 각 변수의 역할]
### 7.3 인프라 / 배포
[Dockerfile, docker-compose 기반]

## 8. 제약 사항 및 리스크
[코드에서 파악한 기술 부채, 미완성 부분, 알려진 이슈]

## 9. 성공 지표 (KPI)
[README나 코드에서 파악한 성공 기준 — 불명확하면 추정치 제시]

## 10. 신규 팀원 온보딩 가이드
### 10.1 코드베이스 구조 한눈에 보기
[각 디렉토리/파일의 역할 상세 설명]
### 10.2 핵심 데이터 흐름
[요청 → 처리 → 응답 흐름을 코드 기반으로 설명]
### 10.3 개발 컨벤션
[코드에서 관찰된 네이밍, 에러 처리, 패턴 등]
### 10.4 자주 쓰는 명령어
[실행, 빌드, 테스트, 배포 명령어]
### 10.5 현재 알려진 TODO / 개선 포인트
[코드에서 관찰된 TODO, FIXME, 미완성 부분]
\`\`\`

위 구조를 채워서 완성된 PRD + 온보딩 가이드 마크다운만 출력하세요. 추가 설명이나 메타 코멘트 없이 문서 내용만 출력합니다.`;
}

// ===== 인터뷰 블록 정의 (Phase 4 — 외주 PM 대응) =====

/** 7개 질문 블록을 반환 */
export function getInterviewBlocks(): InterviewBlock[] {
  return [
    {
      blockIndex: 0,
      title: 'Block 1. 프로젝트 개요',
      description: '서비스의 기본 정보와 목표를 파악합니다.',
      questions: [
        {
          id: 'q-project-name',
          text: '프로젝트명은 무엇인가요?',
          placeholder: '예: 나만의 독서 기록 앱, AI 이미지 생성기',
          required: true,
          type: 'text',
        },
        {
          id: 'q-one-line',
          text: '한 줄로 설명한다면?',
          placeholder: '예: 읽은 책을 간단히 기록하고 친구들과 나눌 수 있는 앱',
          required: true,
          type: 'text',
        },
        {
          id: 'q-why-build',
          text: '누가 왜 이 서비스를 만들려고 하나요?',
          placeholder: '예: 책을 읽고 쉽게 기록하고 싶은 개인 욕구 / 책 커뮤니티 구축 사업',
          required: true,
          type: 'multiline',
        },
        {
          id: 'q-reference',
          text: '참고할 만한 레퍼런스 서비스가 있나요?',
          placeholder: '예: Goodreads (기능), Instagram (UI/UX), Substack (사용자 경험)',
          required: false,
          type: 'multiline',
        },
      ],
      hint: '이 블록에서 수집한 정보는 PRD 1장(서비스 개요)으로 전개됩니다.',
    },

    {
      blockIndex: 1,
      title: 'Block 2. 고객과 사용자',
      description: '누가 이 서비스를 사용할지, 누가 돈을 낼지 정의합니다.',
      questions: [
        {
          id: 'q-payer',
          text: '실제 돈을 내는 사람은 누구인가요?',
          placeholder: '예: 개인 사용자, B2B 기업, 광고주, 또는 없음(무료)',
          required: true,
          type: 'text',
        },
        {
          id: 'q-end-user',
          text: '실제로 사용하는 사람은 누구인가요?',
          placeholder: '예: 20~35세 직장인, 학생, 기업 운영팀',
          required: true,
          type: 'text',
        },
        {
          id: 'q-admin-needed',
          text: '관리자나 운영자가 필요한가요?',
          placeholder: '예: 아니요 / 네, 콘텐츠 심사용 / 네, 사용자 관리용',
          required: true,
          type: 'radio',
          options: [
            { value: 'no', label: '아니요 (필요 없음)' },
            { value: 'yes-moderation', label: '네, 콘텐츠 심사/관리 필요' },
            { value: 'yes-operations', label: '네, 사용자/결제/시스템 운영 필요' },
            { value: 'unknown', label: '미정' },
          ],
        },
        {
          id: 'q-user-priority',
          text: '1순위와 2순위 사용자는?',
          placeholder: '예: 1순위=개인 책 애독가, 2순위=독서 커뮤니티 운영자',
          required: true,
          type: 'multiline',
        },
      ],
      hint: '명확한 사용자 정의가 없으면 나중에 기능 범위가 뭉개집니다.',
    },

    {
      blockIndex: 2,
      title: 'Block 3. 핵심 시나리오 (가장 중요)',
      description: '사용자가 첫 가치를 느끼고, 반복할 행동을 정의합니다. 이것이 UX 설계의 기준이 됩니다.',
      questions: [
        {
          id: 'q-first-value',
          text: '사용자가 처음 들어와서 얻는 첫 가치는?',
          placeholder: '예: 첫 책을 기록한 직후 / 다른 사람의 서평을 본 직후 / 책 추천을 받은 직후',
          required: true,
          type: 'multiline',
        },
        {
          id: 'q-repeat-action',
          text: '사용자가 가장 자주 반복할 핵심 행동은?',
          placeholder: '예: 읽은 책 기록 추가 / 서평 작성 / 친구 책 평가하기 / 추천 책 둘러보기',
          required: true,
          type: 'text',
        },
        {
          id: 'q-before-after',
          text: '서비스 사용 전후로 무엇이 달라지나요?',
          placeholder: '예: 전) 읽은 책을 기억하지 못함 → 후) 읽은 책 기록 + 언제든 회상 가능',
          required: true,
          type: 'multiline',
        },
        {
          id: 'q-offline-link',
          text: '오프라인 행위와 연결되나요?',
          placeholder: '예: 서점 방문, 대출, 모임, SNS 공유 등 오프라인/온라인 연결 지점',
          required: false,
          type: 'multiline',
        },
      ],
      hint: '⭐ 이 블록이 가장 중요합니다. 모호하면 UX가 무너집니다. 최대한 구체적으로 작성하세요.',
    },

    {
      blockIndex: 3,
      title: 'Block 4. 기능과 범위',
      description: 'MVP 범위를 명확하게 합니다. 필수/선택/위험 기능을 구분합니다.',
      questions: [
        {
          id: 'q-must-have',
          text: '첫 출시(MVP)에서 꼭 필요한 기능은?',
          placeholder: '예: 기록 작성, 기록 조회, 기본 검색 (SNS 공유는 v2에서)',
          required: true,
          type: 'multiline',
        },
        {
          id: 'q-nice-to-have',
          text: '있으면 좋지만 미뤄도 되는 기능은?',
          placeholder: '예: 광고제거(유료), 고급 분석, 커뮤니티 채팅',
          required: true,
          type: 'multiline',
        },
        {
          id: 'q-danger-zone',
          text: '절대 복잡해지면 안 되는 영역은?',
          placeholder: '예: 로그인 (간단하게), 결제 (일단 수동 관리)',
          required: false,
          type: 'multiline',
        },
        {
          id: 'q-admin-features',
          text: '관리자 기능이 필요한가요? 있다면?',
          placeholder: '예: 아니요 / 네, 사용자 차단 기능 / 네, 결제 현황 조회',
          required: false,
          type: 'multiline',
        },
      ],
      hint: '복잡도 관리가 성공의 핵심입니다.',
    },

    {
      blockIndex: 4,
      title: 'Block 5. 데이터와 상태',
      description: '무엇을 저장하고, 어떻게 표현할지 정의합니다.',
      questions: [
        {
          id: 'q-data-model',
          text: '무엇을 저장하는가?',
          placeholder: '예: 책 제목, 저자, 읽은 날짜, 별점, 서평 텍스트, 이미지',
          required: true,
          type: 'multiline',
        },
        {
          id: 'q-critical-data',
          text: '어떤 데이터가 가장 중요한가?',
          placeholder: '예: 읽은 책 목록(PK), 별점/서평은 선택사항',
          required: true,
          type: 'multiline',
        },
        {
          id: 'q-write-permission',
          text: '누가 수정할 수 있는가?',
          placeholder: '예: 자신의 기록만 수정 가능, 관리자는 모든 것 가능',
          required: true,
          type: 'text',
        },
        {
          id: 'q-empty-state',
          text: '비어 있을 때 무엇을 보여줄까?',
          placeholder: '예: "첫 책을 기록해보세요" 가이드, 예시 데이터, 튜토리얼',
          required: true,
          type: 'multiline',
        },
        {
          id: 'q-error-handling',
          text: '실패했을 때 어떻게 대응하나?',
          placeholder: '예: 오프라인 임시 저장, 재시도, 동기화 충돌 해결',
          required: false,
          type: 'multiline',
        },
      ],
      hint: '데이터 모델이 튼튼하면 개발이 빨라집니다.',
    },

    {
      blockIndex: 5,
      title: 'Block 6. 수익과 운영',
      description: '비즈니스 모델과 운영 흐름을 정의합니다.',
      questions: [
        {
          id: 'q-monetization',
          text: '돈이 들어오거나 나가는 지점은?',
          placeholder: '예: 없음(MVP) / 구독료 $4.99/월 / 결제 수수료 / 광고 수익',
          required: true,
          type: 'text',
        },
        {
          id: 'q-daily-ops',
          text: '운영자가 매일 해야 하는 일은?',
          placeholder: '예: 콘텐츠 심사, 고객 지원, 결제 처리',
          required: false,
          type: 'multiline',
        },
        {
          id: 'q-manual-work',
          text: '자동화할 수 없는 수동 작업은?',
          placeholder: '예: 신고 접수 검토, 정책 위반 계정 정지, 환불 처리',
          required: false,
          type: 'multiline',
        },
        {
          id: 'q-notifications',
          text: '어떤 이벤트에 알림이 필요한가?',
          placeholder: '예: 주문 확인, 새 메시지, 배송 상태, 결제 실패',
          required: false,
          type: 'multiline',
        },
      ],
      hint: '운영 비용과 시간 투입을 과소평가하지 마세요.',
    },

    {
      blockIndex: 6,
      title: 'Block 7. 플랫폼과 제약',
      description: '기술적 제약과 플랫폼 선택을 정의합니다.',
      questions: [
        {
          id: 'q-platform-priority',
          text: '모바일 우선? 데스크톱 우선?',
          placeholder: '예: 모바일 우선 (앱), 데스크톱 우선 (웹), 둘 다 중요 (반응형 웹)',
          required: true,
          type: 'radio',
          options: [
            { value: 'mobile', label: '모바일 우선 (iOS/Android 앱)' },
            { value: 'mobile-web', label: '모바일 웹 우선 (반응형)' },
            { value: 'desktop', label: '데스크톱 우선 (웹 또는 프로그램)' },
            { value: 'multi', label: '둘 다 중요 (모바일 + 데스크톱 동시)' },
            { value: 'unknown', label: '미정' },
          ],
        },
        {
          id: 'q-auth-constraint',
          text: '로그인/보안 제약은?',
          placeholder: '예: 로그인 없음 (1인용), 간단 이메일만 (비용절감), 소셜로그인 필수',
          required: true,
          type: 'text',
        },
        {
          id: 'q-sensitivity',
          text: '결제/개인정보/규제 민감도는?',
          placeholder: '예: 높음(결제수단 저장) / 중간(일반 개인정보) / 낮음(공개 데이터)',
          required: true,
          type: 'radio',
          options: [
            { value: 'high', label: '높음 (결제, 금융, 의료 정보 포함)' },
            { value: 'medium', label: '중간 (개인정보, 이메일 저장)' },
            { value: 'low', label: '낮음 (공개 데이터만)' },
            { value: 'unknown', label: '미정' },
          ],
        },
        {
          id: 'q-external-service',
          text: '외부 서비스 연동이 필요한가?',
          placeholder: '예: 없음 / 결제(Stripe), 저장소(S3), 메일(SendGrid)',
          required: false,
          type: 'multiline',
        },
      ],
      hint: '플랫폼 선택이 기술 스택을 결정합니다.',
    },
  ];
}

/** 특정 블록의 질문 목록 반환 */
export function getInterviewBlock(blockIndex: number): InterviewBlock | null {
  const blocks = getInterviewBlocks();
  return blocks.find(b => b.blockIndex === blockIndex) ?? null;
}
