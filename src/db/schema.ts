export const MIGRATION_V2_SQL = `
ALTER TABLE workspace ADD COLUMN provider_model TEXT DEFAULT 'claude:claude-sonnet-4-6';
`;

export const MIGRATION_V3_SQL = `
ALTER TABLE jobs ADD COLUMN log TEXT;
`;

export const MIGRATION_V4_SQL = `
ALTER TABLE workspace ADD COLUMN source_prd_path TEXT;
`;

export const MIGRATION_V5_SQL = `
ALTER TABLE issues ADD COLUMN assignee TEXT;
`;

export const MIGRATION_V6_SQL = `
ALTER TABLE issues ADD COLUMN updated_by TEXT;
`;

export const MIGRATION_V7_SQL = `
ALTER TABLE issues ADD COLUMN applied_at TEXT;
`;

export const MIGRATION_V8_SQL = `
ALTER TABLE issues ADD COLUMN source_run_id TEXT;
`;

export const MIGRATION_V9_SQL = `
ALTER TABLE issues ADD COLUMN confidence REAL;
`;

export const MIGRATION_V10_SQL = `
ALTER TABLE jobs ADD COLUMN tab TEXT;
`;

export const MIGRATION_V11_SQL = `
ALTER TABLE jobs ADD COLUMN session_id TEXT;
`;

export const MIGRATION_V12_SQL = `
ALTER TABLE jobs ADD COLUMN capability TEXT;
`;

export const MIGRATION_V13_SQL = `
ALTER TABLE jobs ADD COLUMN run_key TEXT;
`;

export const MIGRATION_V14_SQL = `
ALTER TABLE jobs ADD COLUMN source_version TEXT;
`;

export const MIGRATION_V15_SQL = `
ALTER TABLE jobs ADD COLUMN workspace_root TEXT;
`;

export const MIGRATION_V16_SQL = `
ALTER TABLE jobs ADD COLUMN cancel_requested_at TEXT;
`;

export const MIGRATION_V17_SQL = `
ALTER TABLE jobs ADD COLUMN superseded_by TEXT;
`;

export const MIGRATION_V18_SQL = `
ALTER TABLE jobs ADD COLUMN result_path TEXT;
`;

export const MIGRATION_V19_SQL = `
ALTER TABLE decision_logs ADD COLUMN old_status TEXT;
`;

export const MIGRATION_V20_SQL = `
ALTER TABLE decision_logs ADD COLUMN tab TEXT;
`;

export const MIGRATION_V21_SQL = `
CREATE TABLE IF NOT EXISTS doc_types (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  template_sections TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
`;

export const MIGRATION_V22_SQL = `
ALTER TABLE documents ADD COLUMN doc_type TEXT;
`;

export const MIGRATION_V23_SQL = `
ALTER TABLE documents ADD COLUMN summary TEXT;
`;

export const MIGRATION_V24_SQL = `
CREATE TABLE IF NOT EXISTS doc_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  section_key TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(document_id, section_key)
);
`;

export const MIGRATION_V25_SQL = `
CREATE TABLE IF NOT EXISTS glossary_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  category TEXT,
  aliases TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V26_SQL = `
ALTER TABLE decision_logs ADD COLUMN reason TEXT;
`;

export const MIGRATION_V27_SQL = `
ALTER TABLE jobs ADD COLUMN input_tokens INTEGER;
`;

export const MIGRATION_V28_SQL = `
ALTER TABLE jobs ADD COLUMN output_tokens INTEGER;
`;

export const MIGRATION_V29_SQL = `
ALTER TABLE jobs ADD COLUMN cache_creation_tokens INTEGER;
`;

export const MIGRATION_V30_SQL = `
ALTER TABLE jobs ADD COLUMN cache_read_tokens INTEGER;
`;

export const MIGRATION_V31_SQL = `
DROP TABLE IF EXISTS perspectives;
CREATE TABLE IF NOT EXISTS perspectives (
  id TEXT PRIMARY KEY,
  tab TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  is_locked INTEGER DEFAULT 0,
  prompt_instruction TEXT NOT NULL,
  skill_checklist TEXT,
  id_prefix TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);
`;

export const MIGRATION_V32_SQL = `
ALTER TABLE issues ADD COLUMN decision_at TEXT;
`;

export const MIGRATION_V33_SQL = `
ALTER TABLE issues ADD COLUMN decision_quality TEXT;
`;

export const MIGRATION_V34_SQL = `
CREATE TABLE IF NOT EXISTS issue_preview (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL,
  preview_status TEXT NOT NULL,
  preview_memo TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(issue_id)
);
`;

export const MIGRATION_V35_SQL = `
CREATE TABLE IF NOT EXISTS project_meta (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  start_path TEXT,
  project_type TEXT,
  launch_purpose TEXT,
  tech_nature TEXT,
  current_stage TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`;

export const MIGRATION_V36_SQL = `
CREATE TABLE IF NOT EXISTS review_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab TEXT NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  base_doc_id INTEGER REFERENCES documents(id),
  status TEXT DEFAULT 'pending',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
`;

export const MIGRATION_V37_SQL = `
CREATE TABLE IF NOT EXISTS active_perspectives (
  perspective_id TEXT NOT NULL REFERENCES perspectives(id),
  tab TEXT NOT NULL,
  PRIMARY KEY (perspective_id, tab)
);
`;

export const MIGRATION_V38_SQL = `
UPDATE perspectives SET
  description = CASE id
    WHEN 'backend-api-design' THEN 'MVP에서 API 경계를 최소화하고 FE 개발을 차단하지 않는 계약 설계'
    WHEN 'backend-db-schema' THEN '핵심 데이터 흐름 검증을 위한 최소 데이터 모델'
    WHEN 'backend-infrastructure' THEN '1인이 배포하고 장애 진단 가능한 가장 단순한 운영 구조'
    WHEN 'backend-libraries' THEN '구현 속도 vs 장기 유지보수 현실적 트레이드오프'
    WHEN 'backend-service-layer' THEN '1인이 읽고 수정 가능한 유스케이스 단위 구조'
    WHEN 'frontend-component-hierarchy' THEN 'v1 화면을 줄이고 핵심 사용자 여정 중심 컴포넌트 구성'
    WHEN 'frontend-state-management' THEN '사용자 행동 흐름이 끊기지 않을 최소 상태 모델 정의'
    WHEN 'frontend-navigation-routing' THEN '핵심 가치 경험까지의 경로를 최단으로'
    WHEN 'frontend-api-integration' THEN 'API 실패가 사용자 경험을 망치지 않는 상태/메시지 설계'
    WHEN 'frontend-design-system' THEN '디자이너 없이 일관된 UI를 빠르게 만들기 위한 최소 규칙'
    WHEN 'features-marketing' THEN '핵심 가치가 검증된 이후에만 적용. 공유/초대 루프, SEO, 초기 트랙션'
    WHEN 'features-operations' THEN '기능 추가가 솔로 운영 부담을 늘리는지 판단. 자동화 먼저 해야 하는지'
    WHEN 'features-service-planning' THEN '핵심 가치 경험을 강화하는 기능인지 판단. 문제 해결 강화 > 기능 추가'
    WHEN 'features-technical' THEN '내부 개선이 다음 사용자 기능 병목을 제거하는지 판단. 리팩토링 욕구 ≠ 제품 리스크'
    ELSE description
  END,
  prompt_instruction = CASE id
    WHEN 'backend-api-design' THEN 'MVP에서 FE 개발을 차단하지 않는 최소 API 계약을 설계하라. 엔드포인트를 줄이고, 인증 단순화, 에러 포맷 통일에 집중하라'
    WHEN 'backend-db-schema' THEN '핵심 가치를 증명하는 데 필요한 최소 엔티티와 관계만 설계하라. 과도한 정규화 없이 실제 쿼리 패턴 중심으로 스키마를 잡아라'
    WHEN 'backend-infrastructure' THEN '솔로 개발자가 새벽 2시 장애에도 혼자 진단하고 복구할 수 있는 가장 단순한 배포 구조를 설계하라. 관리형 서비스를 우선 사용하고 자체 운영 컴포넌트를 최소화하라'
    WHEN 'backend-libraries' THEN '라이브러리 선택 시 구현 속도와 장기 유지보수 부담을 현실적으로 평가하라. 유지보수가 중단된 라이브러리, 과도한 추상화, 솔로 개발자에게 불필요한 복잡성을 지적하라'
    WHEN 'backend-service-layer' THEN '솔로 개발자가 6개월 후에도 읽고 수정할 수 있는 서비스 레이어를 설계하라. 과도한 추상화 없이 유스케이스별 흐름이 한눈에 보이는 구조를 잡아라'
    WHEN 'frontend-component-hierarchy' THEN 'v1에 꼭 필요한 화면만 남기고, 핵심 사용자 여정 중심으로 컴포넌트를 구성하라. 화면 수를 줄이고 재사용 컴포넌트를 식별하라'
    WHEN 'frontend-state-management' THEN '사용자 행동 흐름이 끊기지 않도록 최소한의 상태 모델을 정의하라. 불필요한 글로벌 상태를 줄이고, 서버 상태 캐시로 대체 가능한 클라이언트 상태를 식별하라'
    WHEN 'frontend-navigation-routing' THEN '신규 사용자가 핵심 가치를 경험하기까지 탭/화면 이동을 최소화하는 라우팅 구조를 설계하라. 불필요한 중간 화면을 제거하라'
    WHEN 'frontend-api-integration' THEN 'API 실패 시 사용자 경험이 망가지지 않도록 에러 상태, 재시도, 폴백 메시지를 설계하라. 로딩/성공/실패 상태를 사용자 관점에서 설계하라'
    WHEN 'frontend-design-system' THEN '디자이너 없이 혼자 일관된 UI를 빠르게 만들 수 있는 최소 디자인 규칙을 정의하라. 기존 UI 라이브러리를 최대한 활용하고 커스텀을 최소화하라'
    WHEN 'features-marketing' THEN '핵심 가치가 검증된 이후에 의미 있는 마케팅/성장 기능을 제안하라. 검증 전에는 바이럴 루프보다 직접 연결이 더 효과적임을 판단하라'
    WHEN 'features-operations' THEN '각 기능 제안이 솔로 개발자의 운영 부담을 늘리는지 판단하라. 자동화로 먼저 해결 가능한 운영 문제를 우선 제안하라'
    WHEN 'features-service-planning' THEN '핵심 가치 경험을 직접 강화하는 기능인지 판단하라. 기능 추가보다 기존 문제 해결을 강화하는 방향이 우선임을 기준으로 제안하라'
    WHEN 'features-technical' THEN '기술 부채 해소나 리팩토링이 실제 다음 사용자 기능 개발의 병목을 제거하는지 판단하라. 리팩토링 욕구와 실제 제품 리스크를 구분하라'
    ELSE prompt_instruction
  END
WHERE id IN (
  'backend-api-design','backend-db-schema','backend-infrastructure','backend-libraries','backend-service-layer',
  'frontend-component-hierarchy','frontend-state-management','frontend-navigation-routing','frontend-api-integration','frontend-design-system',
  'features-marketing','features-operations','features-service-planning','features-technical'
);
`;

export const MIGRATION_V39_SQL = `
CREATE TABLE IF NOT EXISTS issue_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL,
  title TEXT NOT NULL,
  html_content TEXT NOT NULL,
  category TEXT,
  tag TEXT,
  priority TEXT,
  status TEXT,
  memo TEXT,
  source_run_id TEXT,
  confidence REAL,
  snapshot_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_snapshots_issue ON issue_snapshots(issue_id);
`;

// V39 이전 중간 브랜치에서 status/memo 없이 issue_snapshots가 생성된 경우 보정 (컬럼별 독립 실행)
export const MIGRATION_V40_SQL = `ALTER TABLE issue_snapshots ADD COLUMN status TEXT;`;
export const MIGRATION_V40B_SQL = `ALTER TABLE issue_snapshots ADD COLUMN memo TEXT;`;

// V41: 마커 마이그레이션 (실제 데이터 이전은 openDb()에서 TypeScript로 처리)
export const MIGRATION_V41_SQL = `CREATE TABLE IF NOT EXISTS _migration_v41_done (id INTEGER PRIMARY KEY)`;

// V42: review_cycles에 result_doc_id 컬럼 추가 (생성 문서 추적)
export const MIGRATION_V42_SQL = `ALTER TABLE review_cycles ADD COLUMN result_doc_id INTEGER REFERENCES documents(id);`;

// V43: decision_logs에 cycle_id 컬럼 추가 (사이클 추적)
export const MIGRATION_V43_SQL = `ALTER TABLE decision_logs ADD COLUMN cycle_id INTEGER REFERENCES review_cycles(id);`;

// V44: tab_versions와 issues 테이블의 CHECK 제약 확장 ('ux' 탭 추가)
export const MIGRATION_V44_SQL = `
DROP TABLE IF EXISTS tab_versions_new;
CREATE TABLE tab_versions_new (
  tab TEXT PRIMARY KEY CHECK(tab IN ('review','ux','backend','frontend','features')),
  version TEXT DEFAULT '1.0.0'
);
INSERT OR IGNORE INTO tab_versions_new SELECT * FROM tab_versions;
DROP TABLE tab_versions;
ALTER TABLE tab_versions_new RENAME TO tab_versions;

DROP TABLE IF EXISTS issues_new;
CREATE TABLE issues_new (
  id TEXT PRIMARY KEY,
  tab TEXT NOT NULL CHECK(tab IN ('review','ux','backend','frontend','features')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  html_content TEXT NOT NULL,
  tag TEXT,
  priority TEXT,
  badge TEXT,
  status TEXT DEFAULT 'pending',
  memo TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  origin_id TEXT,
  assignee TEXT,
  updated_by TEXT,
  applied_at TEXT,
  source_run_id TEXT,
  confidence REAL,
  decision_at TEXT,
  decision_quality TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO issues_new SELECT * FROM issues;
DROP TABLE issues;
ALTER TABLE issues_new RENAME TO issues;
`;

// V45: stage_baselines 테이블 추가 (Phase 1 기능)
export const MIGRATION_V45_SQL = `
CREATE TABLE IF NOT EXISTS stage_baselines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab TEXT NOT NULL,
  version TEXT NOT NULL,
  doc_snapshot TEXT,
  frozen_at TEXT DEFAULT (datetime('now')),
  superseded_at TEXT,
  superseded_by INTEGER REFERENCES stage_baselines(id)
);
CREATE INDEX IF NOT EXISTS idx_stage_baselines_tab ON stage_baselines(tab);
`;

export interface PerspectiveSeed {
  id: string;
  tab: string;
  name: string;
  description: string;
  category: string;
  is_locked: number;
  prompt_instruction: string;
  skill_checklist: string;
  id_prefix: string;
  sort_order: number;
}

export const PERSPECTIVE_SEEDS: PerspectiveSeed[] = [
  // ===== REVIEW TAB — 기본 6개 (locked) =====
  { id: 'review-planning-consistency', tab: 'review', name: '기획 정합성', description: '정책/정의 간 충돌, 미정의 항목, 논리적 모순, 범위 중복, 서비스 정체성 혼란', category: 'default', is_locked: 1, prompt_instruction: '정책/정의 간 충돌, 미정의 항목, 논리적 모순, 범위 중복, 서비스 정체성 혼란을 검토하라', skill_checklist: JSON.stringify(['서비스 정의가 한 문장으로 명확히 표현 가능한가?', '동일한 개념이 문서 내에서 다른 용어로 혼용되는가?', '정책 간 상충 조항이 있는가?', '범위(in-scope)와 비범위(out-of-scope)가 명확히 구분되는가?', '각 기능의 의존성이 명확히 정의되어 있는가?', '미정의 상태로 남겨진 정책이나 규칙이 있는가?']), id_prefix: 'a', sort_order: 0 },
  { id: 'review-mvp-scope', tab: 'review', name: 'MVP 범위', description: '핵심 가치 외 과잉 기능, Nice-to-have의 Must-have 혼입, 첫 출시 과부하 위험', category: 'default', is_locked: 1, prompt_instruction: '핵심 가치 외 과잉 기능, Nice-to-have의 Must-have 혼입, 첫 출시 과부하 위험을 검토하라', skill_checklist: JSON.stringify(['MVP 핵심 기능이 3개 이하로 압축 가능한가?', 'Nice-to-have 기능이 Must-have로 분류되어 있지 않은가?', '첫 출시에서 제외할 수 있는 기능이 포함되어 있는가?', '사용자가 핵심 가치를 경험하는 데 불필요한 단계가 있는가?', '경쟁 서비스 대비 차별점이 MVP에 명확히 포함되어 있는가?']), id_prefix: 'b', sort_order: 1 },
  { id: 'review-implementation-realism', tab: 'review', name: '구현 현실성', description: '기술 스택 미지정, 외부 의존성 리스크, 타임라인 현실성, 솔로 개발자 실행 가능성', category: 'default', is_locked: 1, prompt_instruction: '기술 스택 미지정, 외부 의존성 리스크, 타임라인 현실성, 솔로 개발자 실행 가능성을 검토하라', skill_checklist: JSON.stringify(['현재 팀 역량으로 구현 가능한 기술 스택인가?', '외부 API/서비스 의존성이 서비스 안정성에 영향을 주는가?', '제시된 타임라인이 실현 가능한가?', '솔로 개발자 또는 소규모 팀이 유지보수 가능한 복잡도인가?', '기술 학습 곡선이 일정에 반영되어 있는가?']), id_prefix: 'c', sort_order: 2 },
  { id: 'review-ops-burden', tab: 'review', name: '운영 부담', description: '런칭 후 수동 작업, CS 부하, 콘텐츠 운영 필요성, 모니터링 복잡도', category: 'default', is_locked: 1, prompt_instruction: '런칭 후 수동 작업, CS 부하, 콘텐츠 운영 필요성, 모니터링 복잡도를 검토하라', skill_checklist: JSON.stringify(['런칭 후 매일 수동으로 해야 하는 작업이 있는가?', '사용자 CS 처리에 얼마나 많은 시간이 필요한가?', '콘텐츠/데이터를 지속적으로 업데이트해야 하는 부분이 있는가?', '장애 감지 및 대응 체계가 계획되어 있는가?', '운영 도구(어드민, 모니터링)가 계획에 포함되어 있는가?']), id_prefix: 'd', sort_order: 3 },
  { id: 'review-user-value-clarity', tab: 'review', name: '사용자 가치 명확성', description: '핵심 사용자 여정, 가치 전달 명확성, 첫 경험 설계, 이탈 지점', category: 'default', is_locked: 1, prompt_instruction: '핵심 사용자 여정, 가치 전달 명확성, 첫 경험 설계, 이탈 지점을 검토하라', skill_checklist: JSON.stringify(['사용자가 서비스를 처음 사용했을 때 핵심 가치를 몇 분 안에 경험하는가?', '온보딩 흐름이 사용자 목표에 맞게 설계되어 있는가?', '사용자가 이탈할 가능성이 높은 지점이 식별되었는가?', '핵심 사용자 여정(happy path)이 명확히 정의되어 있는가?', 'Edge case와 오류 상황에서의 사용자 경험이 고려되어 있는가?']), id_prefix: 'e', sort_order: 4 },
  { id: 'review-launch-risk', tab: 'review', name: '출시 리스크', description: '규제/법적 이슈, 경쟁 포지셔닝, 시장 타이밍, 초기 트랙션 전략', category: 'default', is_locked: 1, prompt_instruction: '규제/법적 이슈, 경쟁 포지셔닝, 시장 타이밍, 초기 트랙션 전략을 검토하라', skill_checklist: JSON.stringify(['서비스와 관련된 법적/규제 이슈가 검토되었는가?', '경쟁 서비스 대비 차별화 포인트가 명확한가?', '초기 사용자를 획득하는 구체적인 전략이 있는가?', '시장 진입 시점이 적절한가?', '출시 실패 시 피벗 또는 철수 기준이 있는가?']), id_prefix: 'f', sort_order: 5 },
  // ===== REVIEW TAB — 선택 관점들 =====
  { id: 'review-monetization', tab: 'review', name: '수익화 모델', description: '과금 구조, 무료/유료 경계, 가격 책정 전략', category: 'optional', is_locked: 0, prompt_instruction: '과금 구조 모순, 무료/유료 경계 미정의, 가격 전략의 현실성을 검토하라', skill_checklist: JSON.stringify(['수익 모델이 명확히 정의되어 있는가?', '무료와 유료 기능의 경계가 사용자 관점에서 합리적인가?', '가격 책정이 시장과 경쟁 서비스를 고려하였는가?', '구독 vs 일회성 결제 중 어떤 모델이 적합한지 검토되었는가?']), id_prefix: 'rv-mon', sort_order: 10 },
  { id: 'review-legal-risk', tab: 'review', name: '법적 리스크', description: '개인정보, 저작권, 규제 준수, 약관', category: 'optional', is_locked: 0, prompt_instruction: '개인정보 처리, 저작권, 규제 준수, 서비스 약관의 리스크를 검토하라', skill_checklist: JSON.stringify(['개인정보 수집 항목과 처리 방침이 명확한가?', '서드파티 콘텐츠 사용 시 저작권 이슈가 없는가?', '해당 산업의 규제 요구사항이 파악되었는가?', '서비스 이용약관과 개인정보처리방침이 계획되어 있는가?']), id_prefix: 'rv-legal', sort_order: 11 },
  { id: 'review-solo-sustainability', tab: 'review', name: '솔로 지속가능성', description: '1인 운영 가능성, 번아웃 리스크, 자동화 계획', category: 'optional', is_locked: 0, prompt_instruction: '솔로 개발자가 장기간 운영 가능한지, 번아웃 없이 지속할 수 있는지 검토하라', skill_checklist: JSON.stringify(['1인이 전체 시스템을 유지보수할 수 있는 복잡도인가?', '반복 작업의 자동화 계획이 있는가?', '비용(서버, SaaS 도구)이 수익 이전에도 감당 가능한가?', '개발자 경험(DX)이 좋아서 작업이 즐거운가?']), id_prefix: 'rv-solo', sort_order: 12 },
  { id: 'review-first-release-readiness', tab: 'review', name: '첫 출시 준비도', description: '출시 체크리스트, 최소 품질 기준, 피드백 수집 계획', category: 'optional', is_locked: 0, prompt_instruction: '첫 출시를 위한 최소 품질 기준과 준비 상태를 검토하라', skill_checklist: JSON.stringify(['출시 전 필수 완료 항목(체크리스트)이 정의되어 있는가?', '초기 사용자 피드백을 수집하는 방법이 계획되어 있는가?', '치명적 버그 대응 프로세스가 있는가?', '출시 후 첫 주 모니터링 계획이 있는가?']), id_prefix: 'rv-launch', sort_order: 13 },
  { id: 'review-scope-reduction', tab: 'review', name: '범위 축소 기회', description: '추가 삭제 가능한 기능, 단순화 기회', category: 'optional', is_locked: 0, prompt_instruction: '삭제하거나 단순화할 수 있는 기능과 범위를 찾아라', skill_checklist: JSON.stringify(['없애도 핵심 가치가 유지되는 기능이 있는가?', '더 간단하게 구현할 수 있는 기능이 있는가?', '외부 서비스로 대체할 수 있는 자체 구현 기능이 있는가?', '나중 버전으로 미룰 수 있는 기능이 있는가?']), id_prefix: 'rv-reduce', sort_order: 14 },
  { id: 'review-value-impl-alignment', tab: 'review', name: '가치-구현 정합성', description: '기획 의도와 실제 코드 구현의 일치 여부', category: 'codebase', is_locked: 0, prompt_instruction: '기획에서 의도한 핵심 가치가 실제 코드에 올바르게 구현되어 있는지 검토하라', skill_checklist: JSON.stringify(['코드베이스가 PRD에 명시된 핵심 기능을 완전히 구현하는가?', '구현된 기능 중 PRD에 없는 것이 있는가(scope bloat)?', '삭제되었어야 할 기능이 여전히 코드에 남아있는가?']), id_prefix: 'rv-cb1', sort_order: 20 },
  { id: 'review-structural-complexity', tab: 'review', name: '구조적 복잡도', description: '솔로 개발자가 유지보수하기 어려운 구조적 복잡성', category: 'codebase', is_locked: 0, prompt_instruction: '코드베이스의 구조적 복잡도가 솔로 유지보수에 적합한지 검토하라', skill_checklist: JSON.stringify(['의존성 그래프가 순환 없이 명확한가?', '모듈 경계가 명확하고 책임이 분리되어 있는가?', '전역 상태나 공유 뮤터블 상태가 최소화되어 있는가?']), id_prefix: 'rv-cb2', sort_order: 21 },
  // ===== BACKEND TAB — 기본 5개 (locked) =====
  { id: 'backend-api-design', tab: 'backend', name: 'API 설계', description: 'MVP에서 API 경계를 최소화하고 FE 개발을 차단하지 않는 계약 설계', category: 'default', is_locked: 1, prompt_instruction: 'MVP에서 FE 개발을 차단하지 않는 최소 API 계약을 설계하라. 엔드포인트를 줄이고, 인증 단순화, 에러 포맷 통일에 집중하라', skill_checklist: JSON.stringify(['RESTful 리소스 네이밍과 HTTP 메서드가 일관적인가?', '인증(JWT, OAuth 등)과 인가 레이어가 설계되었는가?', '페이지네이션 전략(커서/오프셋)이 결정되었는가?', '에러 응답 포맷이 일관성 있게 정의되었는가?', 'API 버저닝 전략이 있는가?', 'Rate limiting 계획이 있는가?']), id_prefix: 'be-api', sort_order: 0 },
  { id: 'backend-db-schema', tab: 'backend', name: 'DB 스키마', description: '핵심 데이터 흐름 검증을 위한 최소 데이터 모델', category: 'default', is_locked: 1, prompt_instruction: '핵심 가치를 증명하는 데 필요한 최소 엔티티와 관계만 설계하라. 과도한 정규화 없이 실제 쿼리 패턴 중심으로 스키마를 잡아라', skill_checklist: JSON.stringify(['핵심 엔티티와 그 속성이 모두 정의되었는가?', '엔티티 간 관계(1:N, M:N)가 명확한가?', '인덱스 전략이 쿼리 패턴을 고려하여 설계되었는가?', '마이그레이션 전략(스키마 버전 관리)이 있는가?', '소프트 딜리트가 필요한 엔티티가 식별되었는가?', '데이터 규모 예상과 파티셔닝 계획이 있는가?']), id_prefix: 'be-db', sort_order: 1 },
  { id: 'backend-infrastructure', tab: 'backend', name: '인프라', description: '1인이 배포하고 장애 진단 가능한 가장 단순한 운영 구조', category: 'default', is_locked: 1, prompt_instruction: '솔로 개발자가 새벽 2시 장애에도 혼자 진단하고 복구할 수 있는 가장 단순한 배포 구조를 설계하라. 관리형 서비스를 우선 사용하고 자체 운영 컴포넌트를 최소화하라', skill_checklist: JSON.stringify(['배포 환경(클라우드, 서버리스, 컨테이너)이 결정되었는가?', '캐시 레이어(Redis, CDN 등)가 필요한 지점이 식별되었는가?', '비동기 처리가 필요한 작업에 메시지 큐가 고려되었는가?', '월간 인프라 비용이 추정되었는가?', 'CI/CD 파이프라인이 계획되어 있는가?', '스케일링 전략(수평/수직)이 있는가?']), id_prefix: 'be-infra', sort_order: 2 },
  { id: 'backend-libraries', tab: 'backend', name: '라이브러리/의존성', description: '구현 속도 vs 장기 유지보수 현실적 트레이드오프', category: 'default', is_locked: 1, prompt_instruction: '라이브러리 선택 시 구현 속도와 장기 유지보수 부담을 현실적으로 평가하라. 유지보수가 중단된 라이브러리, 과도한 추상화, 솔로 개발자에게 불필요한 복잡성을 지적하라', skill_checklist: JSON.stringify(['핵심 라이브러리 선택이 장기 유지보수를 고려하였는가?', '라이브러리 간 버전 충돌 가능성이 검토되었는가?', '불필요한 라이브러리를 직접 구현으로 대체할 수 있는가?', '라이선스 호환성이 확인되었는가?', '번들 크기/메모리 영향이 검토되었는가?']), id_prefix: 'be-lib', sort_order: 3 },
  { id: 'backend-service-layer', tab: 'backend', name: '서비스 레이어', description: '1인이 읽고 수정 가능한 유스케이스 단위 구조', category: 'default', is_locked: 1, prompt_instruction: '솔로 개발자가 6개월 후에도 읽고 수정할 수 있는 서비스 레이어를 설계하라. 과도한 추상화 없이 유스케이스별 흐름이 한눈에 보이는 구조를 잡아라', skill_checklist: JSON.stringify(['비즈니스 로직이 컨트롤러/라우터에서 분리되어 있는가?', '핵심 유스케이스 흐름이 명확히 정의되었는가?', '트랜잭션 경계가 올바르게 설정되었는가?', '구조화된 로깅 전략이 있는가?', '에러 처리와 예외 상황 흐름이 정의되었는가?']), id_prefix: 'be-svc', sort_order: 4 },
  // ===== BACKEND TAB — 선택 10개 =====
  { id: 'backend-auth', tab: 'backend', name: '인증/인가', description: '세션 관리, OAuth, RBAC, 멀티테넌시 권한', category: 'optional', is_locked: 0, prompt_instruction: '인증/인가 심화 설계: OAuth 플로우, RBAC, 세션 관리, 토큰 갱신 전략을 설계하라', skill_checklist: JSON.stringify(['OAuth 2.0 플로우가 올바르게 구현되는가?', 'RBAC(역할 기반 접근 제어) 모델이 설계되었는가?', '토큰 갱신(refresh) 전략이 있는가?', '멀티테넌시 시나리오에서 데이터 격리가 보장되는가?']), id_prefix: 'be-auth', sort_order: 10 },
  { id: 'backend-realtime', tab: 'backend', name: '실시간 통신', description: 'WebSocket, SSE, 실시간 알림', category: 'optional', is_locked: 0, prompt_instruction: '실시간 통신 요구사항, WebSocket vs SSE 선택, 연결 관리 전략을 설계하라', skill_checklist: JSON.stringify(['실시간이 필요한 기능이 식별되었는가?', 'WebSocket vs SSE vs 폴링 중 적합한 방식이 선택되었는가?', '연결 관리(reconnect, heartbeat)가 설계되었는가?', '실시간 메시지 순서 보장이 필요한지 검토되었는가?']), id_prefix: 'be-rt', sort_order: 11 },
  { id: 'backend-payment', tab: 'backend', name: '결제/구독', description: '결제 게이트웨이, 구독 관리, 웹훅 처리', category: 'optional', is_locked: 0, prompt_instruction: '결제 게이트웨이 연동, 구독 라이프사이클, 웹훅 처리, 환불 정책을 설계하라', skill_checklist: JSON.stringify(['결제 게이트웨이(Stripe 등) 연동 방식이 결정되었는가?', '구독 업그레이드/다운그레이드/취소 플로우가 설계되었는가?', '웹훅 수신 및 멱등성 처리가 계획되었는가?', '환불 및 분쟁 처리 프로세스가 있는가?']), id_prefix: 'be-pay', sort_order: 12 },
  { id: 'backend-search', tab: 'backend', name: '검색/인덱싱', description: '전문 검색, 필터링, 인덱스 전략', category: 'optional', is_locked: 0, prompt_instruction: '검색 요구사항, 전문 검색 vs DB 검색, 인덱싱 전략을 설계하라', skill_checklist: JSON.stringify(['전문 검색(Elasticsearch 등) vs DB 검색 중 어떤 방식이 적합한가?', '검색 인덱스 업데이트 전략이 있는가?', '필터/정렬 조합이 쿼리 성능을 고려하여 설계되었는가?']), id_prefix: 'be-search', sort_order: 13 },
  { id: 'backend-file', tab: 'backend', name: '파일/미디어', description: '파일 업로드, 저장소, 이미지 처리', category: 'optional', is_locked: 0, prompt_instruction: '파일 업로드 방식, 클라우드 저장소 연동, 이미지 리사이징, CDN 설계를 수행하라', skill_checklist: JSON.stringify(['파일 업로드 방식(직접 vs Presigned URL)이 결정되었는가?', '클라우드 저장소(S3 등) 버킷 구조가 설계되었는가?', '이미지 리사이징/최적화 파이프라인이 있는가?', 'CDN 연동 계획이 있는가?']), id_prefix: 'be-file', sort_order: 14 },
  { id: 'backend-batch', tab: 'backend', name: '배치/스케줄링', description: '배치 작업, 크론잡, 비동기 큐', category: 'optional', is_locked: 0, prompt_instruction: '배치 작업 목록, 스케줄 전략, 실패 재시도, 모니터링 계획을 설계하라', skill_checklist: JSON.stringify(['반복 실행이 필요한 작업이 식별되었는가?', '배치 실패 시 재시도 전략이 있는가?', '장시간 배치의 타임아웃 처리가 설계되었는가?']), id_prefix: 'be-batch', sort_order: 15 },
  { id: 'backend-testing', tab: 'backend', name: '테스트 전략', description: '단위/통합/E2E 테스트, 테스트 DB, 커버리지', category: 'optional', is_locked: 0, prompt_instruction: '테스트 피라미드, 테스트 DB 전략, CI에서의 테스트 실행 계획을 설계하라', skill_checklist: JSON.stringify(['단위/통합/E2E 테스트 비율이 계획되었는가?', '테스트용 DB 격리 전략이 있는가?', '테스트 커버리지 목표가 설정되었는가?']), id_prefix: 'be-test', sort_order: 16 },
  { id: 'backend-ai', tab: 'backend', name: 'AI 연동', description: 'LLM API 연동, 프롬프트 관리, 비용 제어', category: 'optional', is_locked: 0, prompt_instruction: 'AI/LLM API 연동 아키텍처, 프롬프트 버전 관리, 토큰 비용 제어를 설계하라', skill_checklist: JSON.stringify(['LLM API 선택(OpenAI, Anthropic 등)이 결정되었는가?', '프롬프트 버전 관리 전략이 있는가?', '토큰 사용량 모니터링과 비용 제어 계획이 있는가?', 'AI 응답 캐싱 전략이 있는가?']), id_prefix: 'be-ai', sort_order: 17 },
  { id: 'backend-monitoring', tab: 'backend', name: '모니터링/옵저버빌리티', description: '로그, 메트릭, 알림, 트레이싱', category: 'optional', is_locked: 0, prompt_instruction: '로그 수집, 메트릭, 알림 임계값, 분산 트레이싱 설계를 수행하라', skill_checklist: JSON.stringify(['구조화된 로그가 중앙 수집되는가?', '핵심 비즈니스 메트릭(DAU, 에러율 등)이 모니터링되는가?', '임계값 초과 시 알림(Slack, PagerDuty 등)이 설정되는가?']), id_prefix: 'be-mon', sort_order: 18 },
  { id: 'backend-security', tab: 'backend', name: '보안', description: 'OWASP, SQL Injection, XSS, 시크릿 관리', category: 'optional', is_locked: 0, prompt_instruction: 'OWASP Top 10 대응, 시크릿 관리, 입력값 검증, 보안 헤더 설계를 수행하라', skill_checklist: JSON.stringify(['SQL Injection, XSS, CSRF 방어가 계획되었는가?', '시크릿(API 키, DB 패스워드)이 환경변수로 안전하게 관리되는가?', '입력값 유효성 검사가 서버에서 이루어지는가?', '보안 헤더(CORS, CSP, HSTS)가 설정되는가?']), id_prefix: 'be-sec', sort_order: 19 },
  { id: 'backend-mvp-simplification', tab: 'backend', name: 'MVP 백엔드 단순화', description: 'MVP에서 제거 가능한 백엔드 복잡성, 관리형 서비스 대체', category: 'optional', is_locked: 0, prompt_instruction: 'MVP 단계에서 제거하거나 외부 서비스로 대체할 수 있는 백엔드 복잡성을 식별하라. 자체 구현 vs 관리형 서비스 트레이드오프를 평가하라', skill_checklist: JSON.stringify(['직접 구현 대신 SaaS/관리형 서비스로 대체 가능한 컴포넌트가 있는가?', 'MVP에서 필요 없는 복잡한 아키텍처(마이크로서비스, 메시지 큐 등)가 포함되어 있는가?', '솔로 개발자가 운영하기 어려운 기술 선택이 있는가?']), id_prefix: 'be-mvp', sort_order: 20 },
  { id: 'backend-external-service', tab: 'backend', name: '외부 서비스 대체', description: '직접 구현 vs 외부 서비스 위임 판단', category: 'optional', is_locked: 0, prompt_instruction: '직접 구현하려는 기능 중 외부 서비스(인증, 결제, 이메일, 스토리지 등)로 위임하면 개발/운영 시간을 크게 줄일 수 있는 항목을 찾아라', skill_checklist: JSON.stringify(['인증을 Auth0/Clerk 등으로 위임할 수 있는가?', '이메일 발송을 외부 서비스로 위임할 수 있는가?', '파일 스토리지를 S3/R2 등으로 위임할 수 있는가?', '검색을 Algolia/Typesense로 위임할 수 있는가?']), id_prefix: 'be-ext', sort_order: 21 },
  { id: 'backend-ops-cost', tab: 'backend', name: '운영 비용/장애 대응', description: '월간 인프라 비용, 장애 감지, 1인 대응 가능성', category: 'optional', is_locked: 0, prompt_instruction: '월간 인프라 비용이 수익 이전에도 감당 가능한지, 장애 발생 시 솔로 개발자 혼자 감지하고 대응할 수 있는 구조인지 평가하라', skill_checklist: JSON.stringify(['월간 인프라 비용이 MVP 단계에서 감당 가능한 수준인가?', '장애 발생 시 알림을 받는 모니터링이 최소한으로 갖춰졌는가?', '장애 대응에 전문 인프라 지식이 필요한 컴포넌트가 있는가?', '장애 시 데이터 백업/복구 계획이 있는가?']), id_prefix: 'be-ops', sort_order: 22 },
  { id: 'backend-replaceable-structure', tab: 'backend', name: '교체 용이 구조', description: '기술 스택 교체 가능성, 벤더 락인 회피', category: 'optional', is_locked: 0, prompt_instruction: '현재 기술 선택 중 나중에 교체하기 어려운 벤더 락인 요소를 식별하라. 추상화 레이어로 교체 가능성을 높이는 방법을 제안하라', skill_checklist: JSON.stringify(['특정 클라우드 벤더에 강하게 묶인 API 사용이 있는가?', '데이터베이스 교체가 필요할 때 마이그레이션 비용이 얼마나 될까?', 'ORM/추상화 레이어로 DB 교체 가능성을 높일 수 있는가?']), id_prefix: 'be-repl', sort_order: 23 },
  // ===== FRONTEND TAB — 기본 5개 (locked) =====
  { id: 'frontend-component-hierarchy', tab: 'frontend', name: '컴포넌트 계층', description: 'v1 화면을 줄이고 핵심 사용자 여정 중심 컴포넌트 구성', category: 'default', is_locked: 1, prompt_instruction: 'v1에 꼭 필요한 화면만 남기고, 핵심 사용자 여정 중심으로 컴포넌트를 구성하라. 화면 수를 줄이고 재사용 컴포넌트를 식별하라', skill_checklist: JSON.stringify(['모든 화면/페이지가 인벤토리로 정리되었는가?', '컴포넌트 계층(Page > Layout > Section > Component > Atom)이 명확한가?', '재사용 가능한 공용 컴포넌트가 식별되었는가?', '컴포넌트 명명 규칙이 일관성 있는가?']), id_prefix: 'fe-comp', sort_order: 0 },
  { id: 'frontend-state-management', tab: 'frontend', name: '상태 관리', description: '사용자 행동 흐름이 끊기지 않을 최소 상태 모델 정의', category: 'default', is_locked: 1, prompt_instruction: '사용자 행동 흐름이 끊기지 않도록 최소한의 상태 모델을 정의하라. 불필요한 글로벌 상태를 줄이고, 서버 상태 캐시로 대체 가능한 클라이언트 상태를 식별하라', skill_checklist: JSON.stringify(['글로벌 상태와 로컬 상태의 경계가 명확한가?', '서버 상태 캐싱 라이브러리(React Query, SWR 등) 사용이 결정되었는가?', '낙관적 업데이트가 필요한 인터랙션이 식별되었는가?', '상태 정규화 전략이 있는가?']), id_prefix: 'fe-state', sort_order: 1 },
  { id: 'frontend-navigation-routing', tab: 'frontend', name: '네비게이션/라우팅', description: '핵심 가치 경험까지의 경로를 최단으로', category: 'default', is_locked: 1, prompt_instruction: '신규 사용자가 핵심 가치를 경험하기까지 탭/화면 이동을 최소화하는 라우팅 구조를 설계하라. 불필요한 중간 화면을 제거하라', skill_checklist: JSON.stringify(['라우트 구조가 정보 아키텍처를 반영하는가?', '인증 필요 라우트에 가드가 설정되어 있는가?', '딥링크가 필요한 경우 URL 구조가 설계되었는가?', '404/에러 페이지 처리가 계획되었는가?']), id_prefix: 'fe-route', sort_order: 2 },
  { id: 'frontend-api-integration', tab: 'frontend', name: 'API 연동', description: 'API 실패가 사용자 경험을 망치지 않는 상태/메시지 설계', category: 'default', is_locked: 1, prompt_instruction: 'API 실패 시 사용자 경험이 망가지지 않도록 에러 상태, 재시도, 폴백 메시지를 설계하라. 로딩/성공/실패 상태를 사용자 관점에서 설계하라', skill_checklist: JSON.stringify(['API 클라이언트 레이어가 컴포넌트에서 분리되어 있는가?', '에러 상태(네트워크 오류, 4xx, 5xx)가 사용자에게 적절히 표시되는가?', '로딩 스켈레톤/스피너 전략이 있는가?', '요청 취소(cleanup) 처리가 계획되었는가?']), id_prefix: 'fe-api', sort_order: 3 },
  { id: 'frontend-design-system', tab: 'frontend', name: '디자인 시스템', description: '디자이너 없이 일관된 UI를 빠르게 만들기 위한 최소 규칙', category: 'default', is_locked: 1, prompt_instruction: '디자이너 없이 혼자 일관된 UI를 빠르게 만들 수 있는 최소 디자인 규칙을 정의하라. 기존 UI 라이브러리를 최대한 활용하고 커스텀을 최소화하라', skill_checklist: JSON.stringify(['컬러, 타이포그래피, 스페이싱 토큰이 정의되었는가?', 'UI 컴포넌트 라이브러리(shadcn, MUI 등) 선택이 결정되었는가?', '다크모드 지원 여부와 구현 방식이 결정되었는가?', '반응형 브레이크포인트가 정의되었는가?']), id_prefix: 'fe-token', sort_order: 4 },
  // ===== FRONTEND TAB — 선택 10개 =====
  { id: 'frontend-accessibility', tab: 'frontend', name: '접근성', description: 'WCAG, 키보드 네비게이션, 스크린 리더', category: 'optional', is_locked: 0, prompt_instruction: 'WCAG 2.1 AA 기준 접근성, 키보드 네비게이션, 스크린 리더 지원을 설계하라', skill_checklist: JSON.stringify(['WCAG 2.1 AA 기준을 충족하는가?', '키보드만으로 모든 기능 사용이 가능한가?', 'ARIA 레이블이 적절히 사용되는가?', '색상 대비가 충분한가?']), id_prefix: 'fe-a11y', sort_order: 10 },
  { id: 'frontend-performance', tab: 'frontend', name: '성능 최적화', description: '번들 크기, 레이지 로딩, Core Web Vitals', category: 'optional', is_locked: 0, prompt_instruction: '번들 크기 최적화, 코드 스플리팅, 이미지 최적화, Core Web Vitals 개선 계획을 수립하라', skill_checklist: JSON.stringify(['초기 번들 크기 목표가 설정되었는가?', '코드 스플리팅과 레이지 로딩이 적용되는가?', '이미지 최적화(WebP, 레이지 로딩) 전략이 있는가?', 'LCP, FID, CLS 개선 계획이 있는가?']), id_prefix: 'fe-perf', sort_order: 11 },
  { id: 'frontend-offline', tab: 'frontend', name: '오프라인/PWA', description: 'Service Worker, 오프라인 지원, 설치 가능성', category: 'optional', is_locked: 0, prompt_instruction: 'PWA 지원, Service Worker 전략, 오프라인 데이터 동기화를 설계하라', skill_checklist: JSON.stringify(['PWA 설치 가능성(manifest, HTTPS)이 구성되었는가?', '오프라인에서 사용 가능한 기능의 범위가 정의되었는가?', '오프라인 → 온라인 전환 시 데이터 동기화 전략이 있는가?']), id_prefix: 'fe-offline', sort_order: 12 },
  { id: 'frontend-form', tab: 'frontend', name: '폼/유효성 검사', description: '폼 라이브러리, 유효성 검사, 에러 메시지', category: 'optional', is_locked: 0, prompt_instruction: '폼 상태 관리, 유효성 검사 전략, 실시간 vs 제출 시 검증 방식을 설계하라', skill_checklist: JSON.stringify(['폼 라이브러리(React Hook Form, Formik 등) 선택이 결정되었는가?', '클라이언트-서버 유효성 검사가 일관성 있는가?', '에러 메시지가 사용자 친화적으로 작성되었는가?']), id_prefix: 'fe-form', sort_order: 13 },
  { id: 'frontend-i18n', tab: 'frontend', name: '다국어/현지화', description: 'i18n 라이브러리, 번역 워크플로우, RTL 지원', category: 'optional', is_locked: 0, prompt_instruction: 'i18n 라이브러리, 번역 키 관리, RTL 지원, 날짜/통화 형식을 설계하라', skill_checklist: JSON.stringify(['i18n 라이브러리(next-intl, i18next 등)가 선택되었는가?', '번역 키 네이밍 규칙이 있는가?', 'RTL 레이아웃 지원이 필요한지 검토되었는가?']), id_prefix: 'fe-i18n', sort_order: 14 },
  { id: 'frontend-animation', tab: 'frontend', name: '애니메이션/인터랙션', description: '모션 설계, 애니메이션 라이브러리, 접근성', category: 'optional', is_locked: 0, prompt_instruction: '애니메이션 원칙, 라이브러리 선택, 성능/접근성(prefers-reduced-motion) 고려를 설계하라', skill_checklist: JSON.stringify(['애니메이션 원칙(타이밍, 이징)이 정의되었는가?', 'prefers-reduced-motion 미디어 쿼리가 적용되는가?', '애니메이션이 레이아웃 스래싱 없이 구현되는가?']), id_prefix: 'fe-anim', sort_order: 15 },
  { id: 'frontend-testing', tab: 'frontend', name: '테스트 전략', description: '컴포넌트 테스트, E2E, 시각적 회귀', category: 'optional', is_locked: 0, prompt_instruction: '프론트엔드 테스트 피라미드, 컴포넌트 테스트, E2E 도구 선택을 설계하라', skill_checklist: JSON.stringify(['컴포넌트 단위 테스트(Jest, Testing Library) 계획이 있는가?', 'E2E 테스트(Playwright, Cypress) 커버리지가 결정되었는가?', '시각적 회귀 테스트가 필요한지 검토되었는가?']), id_prefix: 'fe-test', sort_order: 16 },
  { id: 'frontend-data-viz', tab: 'frontend', name: '데이터 시각화', description: '차트 라이브러리, 대시보드 레이아웃, 실시간 업데이트', category: 'optional', is_locked: 0, prompt_instruction: '차트/그래프 라이브러리 선택, 대시보드 레이아웃, 실시간 데이터 업데이트를 설계하라', skill_checklist: JSON.stringify(['차트 라이브러리(Recharts, Chart.js 등)가 선택되었는가?', '대량 데이터 렌더링 성능이 고려되었는가?', '실시간 데이터 업데이트 전략이 있는가?']), id_prefix: 'fe-viz', sort_order: 17 },
  { id: 'frontend-auth-ui', tab: 'frontend', name: '인증 UI/온보딩', description: '로그인/회원가입 플로우, 소셜 로그인, 온보딩', category: 'optional', is_locked: 0, prompt_instruction: '인증 UI 플로우, 소셜 로그인 UX, 신규 사용자 온보딩 화면을 설계하라', skill_checklist: JSON.stringify(['로그인/회원가입 화면 플로우가 설계되었는가?', '소셜 로그인(Google, GitHub 등) UI가 계획되었는가?', '신규 사용자 온보딩 흐름이 설계되었는가?']), id_prefix: 'fe-auth', sort_order: 18 },
  { id: 'frontend-native', tab: 'frontend', name: '네이티브 연동', description: '카메라, 알림, 파일시스템, 디바이스 API', category: 'optional', is_locked: 0, prompt_instruction: '네이티브 디바이스 API(카메라, 알림, 파일시스템) 연동 방식을 설계하라', skill_checklist: JSON.stringify(['필요한 네이티브 API가 식별되었는가?', '브라우저 권한(Permission API) 요청 흐름이 설계되었는가?', '네이티브 기능을 지원하지 않는 환경의 폴백이 있는가?']), id_prefix: 'fe-native', sort_order: 19 },
  { id: 'frontend-first-value', tab: 'frontend', name: '첫 가치 경험', description: '신규 사용자가 핵심 가치를 경험하기까지의 화면 수/시간', category: 'optional', is_locked: 0, prompt_instruction: '신규 사용자가 앱을 열고 핵심 가치를 처음 경험하기까지 거쳐야 하는 화면과 액션 수를 분석하라. 불필요한 단계를 제거하고 첫 가치 경험을 앞당기는 방법을 제안하라', skill_checklist: JSON.stringify(['첫 가치 경험까지 화면 이동이 3단계 이하인가?', '회원가입 없이 핵심 가치를 먼저 경험할 수 있는가?', '온보딩이 서비스 가치를 설명하는 것이 아닌 직접 경험시키는 구조인가?']), id_prefix: 'fe-fvx', sort_order: 20 },
  { id: 'frontend-empty-error-state', tab: 'frontend', name: '빈 상태/에러 상태', description: '데이터 없음, 오류, 로딩 상태의 사용자 경험', category: 'optional', is_locked: 0, prompt_instruction: '빈 상태(데이터 없음), 에러 상태, 로딩 상태에서의 사용자 경험을 설계하라. 이 상태들이 사용자를 다음 액션으로 안내하는지 확인하라', skill_checklist: JSON.stringify(['빈 상태가 단순 "데이터 없음"이 아닌 다음 액션을 안내하는가?', '에러 메시지가 사용자가 이해할 수 있는 언어로 작성되었는가?', '에러 시 복구 방법(재시도, 지원 연락 등)이 제시되는가?', '스켈레톤/로딩 UI가 UX를 개선하는가?']), id_prefix: 'fe-empty', sort_order: 21 },
  { id: 'frontend-core-action', tab: 'frontend', name: '핵심 액션 가시성', description: '가장 중요한 사용자 액션이 UI에서 눈에 띄는지', category: 'optional', is_locked: 0, prompt_instruction: '각 화면에서 가장 중요한 핵심 액션(CTA)이 시각적으로 충분히 두드러지는지 평가하라. 핵심 액션이 묻혀있거나 경쟁하는 요소가 있으면 지적하라', skill_checklist: JSON.stringify(['각 화면의 주요 CTA가 시각적으로 가장 눈에 띄는가?', 'CTA가 여러 개로 사용자를 혼란스럽게 하지 않는가?', '핵심 기능이 네비게이션의 깊은 곳에 숨겨져 있지 않은가?']), id_prefix: 'fe-action', sort_order: 22 },
  { id: 'frontend-mobile-first', tab: 'frontend', name: '모바일 우선', description: '모바일 환경 우선 설계 여부', category: 'optional', is_locked: 0, prompt_instruction: '모바일 환경에서의 사용성을 우선으로 평가하라. 터치 타겟 크기, 스크롤 패턴, 모바일 특유의 UX 패턴이 반영되었는지 확인하라', skill_checklist: JSON.stringify(['터치 타겟이 44x44px 이상으로 설계되었는가?', '핵심 기능이 엄지손가락 닿는 범위(thumb zone) 내에 있는가?', '모바일에서 불필요한 정보를 숨기는 전략이 있는가?', '모바일 키보드가 UI를 가리는 상황이 처리되었는가?']), id_prefix: 'fe-mobile', sort_order: 23 },
  { id: 'frontend-effort-vs-ux', tab: 'frontend', name: '구현 공수 vs UX 효과', description: '개발 공수 대비 UX 개선 효과 평가', category: 'optional', is_locked: 0, prompt_instruction: '각 UI 결정의 구현 공수와 실제 UX 개선 효과를 평가하라. 공수가 크지만 UX 효과가 작은 결정을 지적하고, 더 간단한 대안을 제안하라', skill_checklist: JSON.stringify(['구현하는 데 시간이 많이 걸리지만 UX 개선 효과가 미미한 기능이 있는가?', '더 단순한 구현으로 비슷한 UX를 달성할 수 있는가?', '애니메이션/마이크로인터랙션이 개발 시간 대비 가치가 있는가?']), id_prefix: 'fe-effort', sort_order: 24 },
  // ===== UX TAB — 기본 5개 (locked) =====
  { id: 'ux-user-segments', tab: 'ux', name: '사용자 세그먼트', description: '주요 사용자 유형과 역할 정의, 관리자 분리 여부', category: 'default', is_locked: 1, prompt_instruction: '서비스 사용자를 세그먼트로 분류하라. 일반 사용자, 관리자, 게스트 등 역할과 권한 차이를 명확히 정의하라. 누락된 사용자 유형이 없는지 확인하라', skill_checklist: JSON.stringify(['주요 사용자 세그먼트가 2개 이상 정의되었는가?', '관리자 역할이 별도로 정의되었는가?', '각 세그먼트별 핵심 목표가 명확한가?', '게스트/비로그인 사용자 경험이 고려되었는가?']), id_prefix: 'ux-seg', sort_order: 0 },
  { id: 'ux-core-flows', tab: 'ux', name: '핵심 플로우', description: '사용자 여정 맵, 핵심 경로, 플로우 갭 식별', category: 'default', is_locked: 1, prompt_instruction: '각 사용자 세그먼트의 핵심 플로우를 정의하라. 첫 가치 경험까지의 최단 경로, 반복 행동 루프, 플로우 단절 지점을 식별하라', skill_checklist: JSON.stringify(['각 세그먼트의 핵심 플로우가 단계별로 정의되었는가?', '플로우 간 연결이 끊기는 지점이 있는가?', '오류/예외 플로우가 정의되었는가?', '첫 가치 경험까지의 단계가 최소화되었는가?']), id_prefix: 'ux-flow', sort_order: 1 },
  { id: 'ux-screen-inventory', tab: 'ux', name: '화면 인벤토리', description: '전체 화면 목록, 화면 누락 식별, 화면 복잡도 평가', category: 'default', is_locked: 1, prompt_instruction: '플로우에서 필요한 모든 화면을 식별하라. 누락된 화면, 중복 화면, MVP에서 제외할 화면을 분류하라. 각 화면의 핵심 역할을 한 줄로 정의하라', skill_checklist: JSON.stringify(['모든 플로우 단계에 대응하는 화면이 있는가?', '중복 기능의 화면이 통합 가능한가?', '각 화면의 단일 책임이 명확한가?', 'MVP에서 제외 가능한 화면이 식별되었는가?']), id_prefix: 'ux-screen', sort_order: 2 },
  { id: 'ux-states-exceptions', tab: 'ux', name: '상태/예외 설계', description: '화면별 상태 정의, 에러 상태, 빈 상태, 로딩 상태', category: 'default', is_locked: 1, prompt_instruction: '각 화면의 모든 상태를 정의하라: 정상 상태, 로딩, 빈 상태, 에러, 권한 없음, 네트워크 오류. 예외 상황에서 사용자 경험이 무너지지 않도록 설계하라', skill_checklist: JSON.stringify(['모든 화면에 로딩/빈/에러 상태가 정의되었는가?', '권한 없는 사용자 접근 처리가 정의되었는가?', '네트워크 오류 시 사용자 피드백이 설계되었는가?', '폼 입력 유효성 실패 상태가 정의되었는가?']), id_prefix: 'ux-state', sort_order: 3 },
  { id: 'ux-admin-ux', tab: 'ux', name: '관리자 UX', description: '어드민 화면 필요성, 운영 도구 설계, 관리자 플로우', category: 'default', is_locked: 1, prompt_instruction: '서비스 운영에 필요한 관리자 도구를 정의하라. 사용자 관리, 콘텐츠 관리, 설정 관리 등 운영 화면이 누락되지 않도록 확인하라. 관리자 UX가 운영 부담을 줄이는 방향으로 설계되었는지 검토하라', skill_checklist: JSON.stringify(['관리자 전용 화면이 정의되었는가?', '운영에 필수적인 어드민 기능이 포함되었는가?', '관리자 권한 제어가 설계되었는가?', '운영 모니터링 화면이 계획되었는가?']), id_prefix: 'ux-admin', sort_order: 4 },
  // ===== FEATURES TAB — 기본 4개 (locked) =====
  { id: 'features-marketing', tab: 'features', name: '마케팅/성장', description: '핵심 가치가 검증된 이후에만 적용. 공유/초대 루프, SEO, 초기 트랙션', category: 'default', is_locked: 1, prompt_instruction: '핵심 가치가 검증된 이후에 의미 있는 마케팅/성장 기능을 제안하라. 검증 전에는 바이럴 루프보다 직접 연결이 더 효과적임을 판단하라', skill_checklist: JSON.stringify(['바이럴 루프를 만드는 기능이 있는가?', '레퍼럴 프로그램이 계획되어 있는가?', 'SEO/ASO 최적화 기능이 로드맵에 있는가?', 'PLG(Product-Led Growth) 전략이 반영되었는가?']), id_prefix: 'ft-mkt', sort_order: 0 },
  { id: 'features-operations', tab: 'features', name: '운영 효율화', description: '기능 추가가 솔로 운영 부담을 늘리는지 판단. 자동화 먼저 해야 하는지', category: 'default', is_locked: 1, prompt_instruction: '각 기능 제안이 솔로 개발자의 운영 부담을 늘리는지 판단하라. 자동화로 먼저 해결 가능한 운영 문제를 우선 제안하라', skill_checklist: JSON.stringify(['반복적인 운영 작업을 자동화하는 기능이 있는가?', '관리자 도구(어드민 패널)가 계획되어 있는가?', 'CS 응대를 줄이는 자동화 기능이 있는가?']), id_prefix: 'ft-ops', sort_order: 1 },
  { id: 'features-service-planning', tab: 'features', name: '서비스 고도화', description: '핵심 가치 경험을 강화하는 기능인지 판단. 문제 해결 강화 > 기능 추가', category: 'default', is_locked: 1, prompt_instruction: '핵심 가치 경험을 직접 강화하는 기능인지 판단하라. 기능 추가보다 기존 문제 해결을 강화하는 방향이 우선임을 기준으로 제안하라', skill_checklist: JSON.stringify(['사용자 여정에서 갭이 있는 지점이 식별되었는가?', '재방문을 유도하는 리텐션 훅이 있는가?', '개인화 기능이 로드맵에 있는가?', '사용자 인게이지먼트를 높이는 피처가 있는가?']), id_prefix: 'ft-svc', sort_order: 2 },
  { id: 'features-technical', tab: 'features', name: '기술 부채/확장', description: '내부 개선이 다음 사용자 기능 병목을 제거하는지 판단. 리팩토링 욕구 ≠ 제품 리스크', category: 'default', is_locked: 1, prompt_instruction: '기술 부채 해소나 리팩토링이 실제 다음 사용자 기능 개발의 병목을 제거하는지 판단하라. 리팩토링 욕구와 실제 제품 리스크를 구분하라', skill_checklist: JSON.stringify(['해결이 필요한 기술 부채가 식별되었는가?', '성능 병목 지점과 개선 계획이 있는가?', '확장성을 위해 변경이 필요한 아키텍처가 있는가?']), id_prefix: 'ft-tech', sort_order: 3 },
  // ===== FEATURES TAB — 선택 10개 =====
  { id: 'features-onboarding', tab: 'features', name: '온보딩/활성화', description: '신규 사용자 활성화, 첫 가치 경험 단축', category: 'optional', is_locked: 0, prompt_instruction: '신규 사용자 활성화율을 높이는 온보딩 개선 피처를 제안하라', skill_checklist: JSON.stringify(['신규 사용자가 핵심 가치를 경험하는 시간을 줄이는 기능이 있는가?', '온보딩 완료율을 트래킹하는 방법이 있는가?']), id_prefix: 'ft-onboard', sort_order: 10 },
  { id: 'features-monetization', tab: 'features', name: '수익화', description: '유료 플랜, 프리미엄 기능, 결제 전환', category: 'optional', is_locked: 0, prompt_instruction: '수익화를 위한 유료 플랜, 프리미엄 기능, 결제 전환 피처를 제안하라', skill_checklist: JSON.stringify(['무료 → 유료 전환을 유도하는 게이팅 기능이 있는가?', '유료 기능이 충분한 가치를 제공하는가?']), id_prefix: 'ft-mon', sort_order: 11 },
  { id: 'features-community', tab: 'features', name: '커뮤니티/소셜', description: '공유, 팔로우, 댓글, UGC', category: 'optional', is_locked: 0, prompt_instruction: '커뮤니티와 소셜 기능(공유, 팔로우, UGC) 피처를 제안하라', skill_checklist: JSON.stringify(['사용자 간 상호작용을 촉진하는 기능이 있는가?', 'UGC(사용자 생성 콘텐츠)가 서비스 가치를 높이는가?']), id_prefix: 'ft-comm', sort_order: 12 },
  { id: 'features-gamification', tab: 'features', name: '게이미피케이션', description: '포인트, 배지, 리더보드, 스트릭', category: 'optional', is_locked: 0, prompt_instruction: '게이미피케이션(포인트, 배지, 리더보드, 스트릭) 피처를 제안하라', skill_checklist: JSON.stringify(['게이미피케이션이 서비스 목표와 연계되어 있는가?', '조작(cheating) 방지 메커니즘이 있는가?']), id_prefix: 'ft-game', sort_order: 13 },
  { id: 'features-ai-feature', tab: 'features', name: 'AI 기능', description: 'AI 추천, 자동화, 개인화, AI 어시스턴트', category: 'optional', is_locked: 0, prompt_instruction: 'AI를 활용한 추천, 자동화, 개인화 기능 피처를 제안하라', skill_checklist: JSON.stringify(['AI가 사용자 경험을 실질적으로 개선하는가?', 'AI 결과의 정확도와 오류 처리가 계획되었는가?']), id_prefix: 'ft-ai', sort_order: 14 },
  { id: 'features-integration', tab: 'features', name: '외부 연동', description: 'Webhook, API, 서드파티 통합', category: 'optional', is_locked: 0, prompt_instruction: '외부 서비스 연동(Webhook, API, 플랫폼 통합) 피처를 제안하라', skill_checklist: JSON.stringify(['연동이 사용자 워크플로우를 실질적으로 개선하는가?', 'API 보안(인증, Rate limiting)이 계획되었는가?']), id_prefix: 'ft-intg', sort_order: 15 },
  { id: 'features-platform', tab: 'features', name: '플랫폼 확장', description: '마켓플레이스, 플러그인, 화이트라벨', category: 'optional', is_locked: 0, prompt_instruction: '플랫폼 확장(마켓플레이스, 플러그인, API 공개) 피처를 제안하라', skill_checklist: JSON.stringify(['플랫폼 확장이 현재 단계에서 적합한가?', '써드파티 개발자가 참여하는 에코시스템이 계획되었는가?']), id_prefix: 'ft-plat', sort_order: 16 },
  { id: 'features-data-insight', tab: 'features', name: '데이터 인사이트', description: '사용자 분석, 행동 트래킹, 대시보드', category: 'optional', is_locked: 0, prompt_instruction: '사용자 행동 데이터 기반 인사이트 및 분석 피처를 제안하라', skill_checklist: JSON.stringify(['수집하는 데이터가 실제 의사결정에 사용되는가?', '프라이버시 규정을 준수하는가?']), id_prefix: 'ft-data', sort_order: 17 },
  { id: 'features-localization', tab: 'features', name: '해외 현지화', description: '다국어, 지역화, 현지 결제', category: 'optional', is_locked: 0, prompt_instruction: '해외 시장 진출을 위한 다국어 지원, 지역화, 현지 결제 피처를 제안하라', skill_checklist: JSON.stringify(['현지화가 서비스 성장에 필요한 단계인가?', '번역 품질 관리 방법이 있는가?']), id_prefix: 'ft-local', sort_order: 18 },
  { id: 'features-accessibility-improve', tab: 'features', name: '접근성 개선', description: 'WCAG 고도화, 다양한 사용자 지원', category: 'optional', is_locked: 0, prompt_instruction: '접근성 개선(WCAG AA/AAA 달성, 스크린 리더 최적화) 피처를 제안하라', skill_checklist: JSON.stringify(['접근성 감사(audit) 결과를 반영한 개선 항목이 있는가?', '접근성 개선이 더 넓은 사용자층 확보에 기여하는가?']), id_prefix: 'ft-a11y', sort_order: 19 },
  { id: 'features-deletion-reduction', tab: 'features', name: '삭제/축소 기회', description: '없애거나 축소할 수 있는 기능 발굴', category: 'optional', is_locked: 0, prompt_instruction: '현재 서비스에서 삭제하거나 축소해도 핵심 가치가 유지되는 기능을 발굴하라. 기능을 추가하는 것보다 단순화하는 것이 더 나은 선택일 수 있다', skill_checklist: JSON.stringify(['사용률이 낮을 것으로 예상되는 기능이 있는가?', '단순화해도 핵심 가치가 유지되는 기능이 있는가?', '유지보수 부담 대비 사용자 가치가 낮은 기능이 있는가?']), id_prefix: 'ft-del', sort_order: 20 },
  { id: 'features-experiment', tab: 'features', name: '실험 가능성', description: '만들기 전에 실험으로 검증 가능한 기능', category: 'optional', is_locked: 0, prompt_instruction: '직접 만들기 전에 실험(A/B 테스트, 가짜 기능, 수동 운영)으로 검증할 수 있는 기능을 식별하라. 불확실한 기능은 만들기 전에 먼저 검증하는 방법을 제안하라', skill_checklist: JSON.stringify(['기능을 만들기 전에 가짜 버튼으로 수요를 검증할 수 있는가?', '수동 운영으로 먼저 가설을 검증할 수 있는가?', 'A/B 테스트가 필요한 기능이 있는가?']), id_prefix: 'ft-exp', sort_order: 21 },
  { id: 'features-monetization-readiness', tab: 'features', name: '수익화 준비도', description: '수익화 기능 도입 전 필요한 선행 조건', category: 'optional', is_locked: 0, prompt_instruction: '수익화 기능을 도입하기 전에 갖춰야 할 선행 조건(핵심 가치 검증, 사용자 규모, 지불 의사 확인 등)을 평가하라. 준비되지 않은 수익화가 성장을 막는 경우를 지적하라', skill_checklist: JSON.stringify(['핵심 가치가 충분히 검증되었는가?', '지불 의사가 있는 사용자 세그먼트가 식별되었는가?', '무료 → 유료 전환의 마찰이 너무 크지 않은가?', '수익화 도입이 초기 성장을 저해할 위험이 있는가?']), id_prefix: 'ft-money', sort_order: 22 },
  { id: 'features-data-learning', tab: 'features', name: '데이터 학습/인사이트', description: '기능 추가로 얻는 데이터와 학습 기회', category: 'optional', is_locked: 0, prompt_instruction: '각 기능 추가가 어떤 사용자 행동 데이터를 수집하고, 그 데이터로 무엇을 배울 수 있는지 평가하라. 데이터 수집이 설계에 반영되어 있는지 확인하라', skill_checklist: JSON.stringify(['기능 추가와 함께 측정할 핵심 지표가 정의되었는가?', '수집하는 데이터가 다음 의사결정에 실제로 사용되는가?', '데이터 수집이 사용자 프라이버시를 침해하지 않는가?']), id_prefix: 'ft-learn', sort_order: 23 },
  { id: 'features-effort-vs-effect', tab: 'features', name: '개발 공수 vs 효과', description: '기능별 개발 공수 대비 사용자/비즈니스 효과 평가', category: 'optional', is_locked: 0, prompt_instruction: '각 기능 제안의 개발 공수(솔로 개발자 기준 일/주 단위)와 예상 사용자/비즈니스 효과를 평가하라. 공수 대비 효과가 낮은 기능을 걸러내라', skill_checklist: JSON.stringify(['솔로 개발자가 구현하는 데 얼마나 걸리는가?', '구현 후 실제로 사용자의 핵심 문제를 해결하는가?', '공수 대비 효과 비율이 낮은 기능을 제외할 수 있는가?']), id_prefix: 'ft-effort', sort_order: 24 },
];

export function seedPerspectives(db: any): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO perspectives
      (id, tab, name, description, category, is_locked, prompt_instruction, skill_checklist, id_prefix, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const activate = db.prepare(`
    INSERT OR IGNORE INTO active_perspectives (perspective_id, tab)
    VALUES (?, ?)
  `);
  const run = db.transaction(() => {
    for (const p of PERSPECTIVE_SEEDS) {
      insert.run(p.id, p.tab, p.name, p.description, p.category, p.is_locked, p.prompt_instruction, p.skill_checklist, p.id_prefix, p.sort_order);
      if (p.is_locked === 1) activate.run(p.id, p.tab);
    }
  });
  run();
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workspace (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  name TEXT NOT NULL,
  prd_path TEXT,
  source_prd_path TEXT,
  tech_stack_path TEXT,
  provider_model TEXT DEFAULT 'claude:claude-sonnet-4-6',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tab_versions (
  tab TEXT PRIMARY KEY CHECK(tab IN ('review','ux','backend','frontend','features')),
  version TEXT DEFAULT '1.0.0'
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  tab TEXT NOT NULL CHECK(tab IN ('review','ux','backend','frontend','features')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  html_content TEXT NOT NULL,
  tag TEXT,
  priority TEXT,
  badge TEXT,
  status TEXT DEFAULT 'pending',
  memo TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  origin_id TEXT,
  assignee TEXT,
  updated_by TEXT,
  applied_at TEXT,
  source_run_id TEXT,
  confidence REAL,
  decision_at TEXT,
  decision_quality TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL REFERENCES issues(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  memo TEXT NOT NULL,
  old_status TEXT,
  tab TEXT,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS changelogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab TEXT NOT NULL,
  version TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  fe_section TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  tab TEXT,
  session_id TEXT,
  capability TEXT,
  run_key TEXT,
  source_version TEXT,
  workspace_root TEXT,
  status TEXT DEFAULT 'running',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT,
  log TEXT,
  cancel_requested_at TEXT,
  superseded_by TEXT,
  result_path TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_tokens INTEGER,
  cache_read_tokens INTEGER
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab TEXT NOT NULL,
  version TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  source_version TEXT,
  source_job_id TEXT,
  doc_type TEXT,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doc_types (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  template_sections TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS doc_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  section_key TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(document_id, section_key)
);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  category TEXT,
  aliases TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS perspectives (
  id TEXT PRIMARY KEY,
  tab TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  is_locked INTEGER DEFAULT 0,
  prompt_instruction TEXT NOT NULL,
  skill_checklist TEXT,
  id_prefix TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS active_perspectives (
  perspective_id TEXT NOT NULL REFERENCES perspectives(id),
  tab TEXT NOT NULL,
  PRIMARY KEY (perspective_id, tab)
);

CREATE TABLE IF NOT EXISTS project_meta (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  start_path TEXT,
  project_type TEXT,
  launch_purpose TEXT,
  tech_nature TEXT,
  current_stage TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab TEXT NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 1,
  base_doc_id INTEGER REFERENCES documents(id),
  status TEXT DEFAULT 'pending',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS issue_preview (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL,
  preview_status TEXT NOT NULL,
  preview_memo TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(issue_id)
);
`;
