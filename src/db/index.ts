import { createRequire } from 'module';
import path from 'path';
import {
  SCHEMA_SQL,
  MIGRATION_V2_SQL,
  MIGRATION_V3_SQL,
  MIGRATION_V4_SQL,
  MIGRATION_V5_SQL,
  MIGRATION_V6_SQL,
  MIGRATION_V7_SQL,
  MIGRATION_V8_SQL,
  MIGRATION_V9_SQL,
  MIGRATION_V10_SQL,
  MIGRATION_V11_SQL,
  MIGRATION_V12_SQL,
  MIGRATION_V13_SQL,
  MIGRATION_V14_SQL,
  MIGRATION_V15_SQL,
  MIGRATION_V16_SQL,
  MIGRATION_V17_SQL,
  MIGRATION_V18_SQL,
  MIGRATION_V19_SQL,
  MIGRATION_V20_SQL,
  MIGRATION_V21_SQL,
  MIGRATION_V22_SQL,
  MIGRATION_V23_SQL,
  MIGRATION_V24_SQL,
  MIGRATION_V25_SQL,
  MIGRATION_V26_SQL,
} from './schema.js';

// 기본 문서 유형 시드 데이터
const DOC_TYPE_SEEDS = [
  {
    slug: 'project-overview',
    label: '프로젝트 개요',
    sort_order: 0,
    template_sections: JSON.stringify([
      { key: 'one-liner', title: '한 줄 설명', hint: '이 서비스를 한 문장으로 설명하세요', required: true },
      { key: 'problem', title: '해결하는 문제', hint: '어떤 문제를 해결하나요? 지금은 어떻게 해결하고 있나요?', required: true },
      { key: 'target-users', title: '대상 사용자', hint: '누가 주로 사용하나요? 구체적으로 묘사하세요', required: true },
      { key: 'non-scope', title: '만들지 않을 것', hint: '이번에 다루지 않을 것들을 명확히 선언하세요', required: false },
      { key: 'current-phase', title: '현재 단계', hint: '아이디어 / 프로토타입 / MVP / 정식 출시 등', required: false },
    ]),
  },
  {
    slug: 'ai-guide',
    label: 'AI 작업 가이드',
    sort_order: 1,
    template_sections: JSON.stringify([
      { key: 'product-goal', title: '제품 목표', hint: '이 서비스가 달성해야 할 핵심 목표 (비즈니스 + 사용자 가치)', required: true },
      { key: 'priority-criteria', title: '우선순위 기준', hint: 'AI가 판단할 때 어떤 기준으로 우선순위를 정해야 하나요?', required: true },
      { key: 'prohibitions', title: '금지사항', hint: 'AI가 절대 해선 안 되는 것들 (예: 특정 기술 추천 금지, 과금 모델 변경 금지)', required: false },
      { key: 'tech-constraints', title: '기술 제약', hint: '사용 중인 스택, 바꿀 수 없는 기술 결정들', required: false },
      { key: 'tone-style', title: '톤/스타일', hint: '문서/코드 작성 시 선호하는 스타일 (예: 간결함, 한국어, 주석 최소화)', required: false },
      { key: 'decision-principles', title: '의사결정 원칙', hint: '트레이드오프 상황에서 어떤 원칙을 따르나요?', required: false },
    ]),
  },
  {
    slug: 'prd',
    label: '기획 요구사항 (PRD)',
    sort_order: 2,
    template_sections: JSON.stringify([
      { key: 'goal', title: '목표', hint: '이 버전에서 달성할 목표', required: true },
      { key: 'problem', title: '문제', hint: '어떤 문제를 해결하는가', required: true },
      { key: 'target-users', title: '대상 사용자', hint: '누가 이 기능을 사용하는가', required: true },
      { key: 'core-value', title: '핵심 가치', hint: '경쟁 서비스 대비 차별점', required: true },
      { key: 'key-scenarios', title: '핵심 시나리오', hint: 'Happy path / Edge case / Failure case', required: true },
      { key: 'scope', title: '범위 (In-scope)', hint: '이번에 만드는 것', required: true },
      { key: 'non-scope', title: '비범위 (Out-of-scope)', hint: '이번에 만들지 않는 것', required: false },
      { key: 'success-criteria', title: '성공 기준', hint: '어떻게 성공을 측정할 것인가 (KPI)', required: false },
      { key: 'constraints', title: '제약사항', hint: '기술적/비즈니스적 제약', required: false },
    ]),
  },
  {
    slug: 'open-questions',
    label: '열린 질문',
    sort_order: 3,
    template_sections: JSON.stringify([
      { key: 'questions', title: '미결 질문 목록', hint: '아직 결정하지 못한 것들. 형식: [질문] / 중요도: 높음/중간/낮음 / 결정 시한 / 후보안', required: false },
    ]),
  },
];

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BetterSqlite3 = require('better-sqlite3') as any;

const _dbs = new Map<string, any>();
let _activeDbPath: string | null = null;

function normalizeDbPath(dbPath: string): string {
  return path.resolve(dbPath);
}

export function openDb(dbPath: string): any {
  const normalizedPath = normalizeDbPath(dbPath);
  const existing = _dbs.get(normalizedPath);
  if (existing) {
    _activeDbPath = normalizedPath;
    return existing;
  }

  const db = new BetterSqlite3(normalizedPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  try { db.exec(MIGRATION_V2_SQL); } catch { /* 컬럼 이미 존재 시 무시 */ }
  try { db.exec(MIGRATION_V3_SQL); } catch { /* 컬럼 이미 존재 시 무시 */ }
  try { db.exec(MIGRATION_V4_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V5_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V6_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V7_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V8_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V9_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V10_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V11_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V12_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V13_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V14_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V15_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V16_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V17_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V18_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V19_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V20_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V21_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V22_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V23_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V24_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V25_SQL); } catch { /* ignore */ }
  try { db.exec(MIGRATION_V26_SQL); } catch { /* ignore */ }

  // doc_types 시드 데이터 (INSERT OR IGNORE)
  const seedStmt = db.prepare(
    `INSERT OR IGNORE INTO doc_types (slug, label, template_sections, sort_order) VALUES (?, ?, ?, ?)`
  );
  for (const seed of DOC_TYPE_SEEDS) {
    seedStmt.run(seed.slug, seed.label, seed.template_sections, seed.sort_order);
  }

  _dbs.set(normalizedPath, db);
  _activeDbPath = normalizedPath;
  return db;
}

export function getDb(): any {
  if (!_activeDbPath) throw new Error('Database not opened');
  const db = _dbs.get(_activeDbPath);
  if (!db) throw new Error('Database not opened');
  return db;
}

export function resetDb(): void {
  _activeDbPath = null;
}

export function closeAllDbs(): void {
  for (const db of _dbs.values()) {
    try { db.close(); } catch { /* ignore */ }
  }
  _dbs.clear();
  _activeDbPath = null;
}
