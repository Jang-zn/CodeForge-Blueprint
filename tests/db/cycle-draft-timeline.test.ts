/**
 * Phase 2-5 핵심 동작 테스트:
 * - draft 상태 analyze 차단 (hasPendingDrafts)
 * - cycle rollover (createOrResumeCycle / updateCycleStatus)
 * - features 전용 상태 (getAppliedDecisions + STATUS_GUIDE)
 * - issue timeline 정렬 (getIssueTimeline)
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, makeIssue } from '../helpers.js';
import {
  upsertIssue,
  createIssuePreview,
  deleteIssuePreview,
  hasPendingDrafts,
  createOrResumeCycle,
  getCurrentCycle,
  updateCycleStatus,
  getIssueTimeline,
  getAppliedDecisions,
  addDecisionLog,
  snapshotIssueIfExists,
  type Tab,
  type CycleStatus,
} from '../../src/db/repository.js';

// ─── hasPendingDrafts ─────────────────────────────────────────────────────────

describe('hasPendingDrafts', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
    upsertIssue(db, makeIssue({ id: 'rv-1', tab: 'review' }));
    upsertIssue(db, makeIssue({ id: 'rv-2', tab: 'review' }));
    upsertIssue(db, makeIssue({ id: 'be-1', tab: 'backend' }));
  });

  test('draft가 없으면 false', () => {
    assert.equal(hasPendingDrafts(db, 'review'), false);
  });

  test('draft가 있으면 true', () => {
    createIssuePreview(db, 'rv-1', 'resolved', '확정');
    assert.equal(hasPendingDrafts(db, 'review'), true);
  });

  test('다른 탭의 draft는 영향 없음', () => {
    createIssuePreview(db, 'be-1', 'resolved', '확정');
    assert.equal(hasPendingDrafts(db, 'review'), false);
    assert.equal(hasPendingDrafts(db, 'backend'), true);
  });

  test('draft 삭제 후 false', () => {
    createIssuePreview(db, 'rv-1', 'resolved', '확정');
    assert.equal(hasPendingDrafts(db, 'review'), true);
    deleteIssuePreview(db, 'rv-1');
    assert.equal(hasPendingDrafts(db, 'review'), false);
  });
});

// ─── cycle rollover ───────────────────────────────────────────────────────────

describe('createOrResumeCycle', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  test('첫 호출 시 cycle_number 1로 생성', () => {
    const cycle = createOrResumeCycle(db, 'review');
    assert.equal(cycle.cycle_number, 1);
    assert.equal(cycle.status, 'analyzing');
    assert.equal(cycle.tab, 'review');
  });

  test('analyzing 상태 사이클은 재사용', () => {
    const c1 = createOrResumeCycle(db, 'review');
    const c2 = createOrResumeCycle(db, 'review');
    assert.equal(c1.id, c2.id);
    assert.equal(c2.cycle_number, 1);
  });

  test('applied 사이클 이후 새 사이클 생성 (rollover)', () => {
    const c1 = createOrResumeCycle(db, 'review');
    updateCycleStatus(db, c1.id, 'applied');
    const c2 = createOrResumeCycle(db, 'review');
    assert.notEqual(c1.id, c2.id);
    assert.equal(c2.cycle_number, 2);
    assert.equal(c2.status, 'analyzing');
  });

  test('completed 사이클 이후 새 사이클 생성', () => {
    const c1 = createOrResumeCycle(db, 'review');
    updateCycleStatus(db, c1.id, 'completed');
    const c2 = createOrResumeCycle(db, 'review');
    assert.equal(c2.cycle_number, 2);
  });

  test('failed 사이클 이후 새 사이클 생성', () => {
    const c1 = createOrResumeCycle(db, 'review');
    updateCycleStatus(db, c1.id, 'failed');
    const c2 = createOrResumeCycle(db, 'review');
    assert.equal(c2.cycle_number, 2);
  });

  test('다른 탭 사이클은 독립', () => {
    const review = createOrResumeCycle(db, 'review');
    const backend = createOrResumeCycle(db, 'backend');
    assert.equal(review.cycle_number, 1);
    assert.equal(backend.cycle_number, 1);
    assert.notEqual(review.id, backend.id);
  });
});

describe('updateCycleStatus', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  test('failed로 전환 시 getCurrentCycle에서 제외', () => {
    const cycle = createOrResumeCycle(db, 'review');
    updateCycleStatus(db, cycle.id, 'failed');
    const current = getCurrentCycle(db, 'review');
    assert.equal(current, null);
  });

  test('completed 시 completed_at 설정', () => {
    const cycle = createOrResumeCycle(db, 'review');
    updateCycleStatus(db, cycle.id, 'completed');
    const row = db.prepare('SELECT * FROM review_cycles WHERE id = ?').get(cycle.id);
    assert.ok(row.completed_at);
    assert.equal(row.status, 'completed');
  });

  test('result_doc_id 설정', () => {
    const cycle = createOrResumeCycle(db, 'review');
    // documents 테이블에 레코드 추가 (FK 제약 충족)
    const docId = db.prepare(
      `INSERT INTO documents (tab, version, kind, file_path, source_version, source_job_id) VALUES ('review', '1.0', 'generated-doc', '/tmp/test.md', '1.0', 'job-1')`
    ).run().lastInsertRowid;
    updateCycleStatus(db, cycle.id, 'completed', Number(docId));
    const row = db.prepare('SELECT * FROM review_cycles WHERE id = ?').get(cycle.id);
    assert.equal(row.result_doc_id, Number(docId));
  });
});

// ─── getIssueTimeline ─────────────────────────────────────────────────────────

describe('getIssueTimeline', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
    upsertIssue(db, makeIssue({ id: 'rv-1', tab: 'review', status: 'pending' }));
  });

  test('빈 타임라인', () => {
    const entries = getIssueTimeline(db, 'rv-1');
    assert.equal(entries.length, 0);
  });

  test('스냅샷과 decision log 통합', () => {
    snapshotIssueIfExists(db, 'rv-1', 'run-1');
    addDecisionLog(db, { issue_id: 'rv-1', date: new Date().toISOString(), status: 'resolved', old_status: 'pending', memo: '확정', tab: 'review', reason: '분석 결과 반영', cycle_id: null });
    const entries = getIssueTimeline(db, 'rv-1');
    assert.equal(entries.length, 2);
    const types = entries.map(e => e.type);
    assert.ok(types.includes('snapshot'));
    assert.ok(types.includes('decision'));
  });

  test('최신순 정렬 (날짜 내림차순)', () => {
    // 같은 이슈에 대해 연속 이벤트 생성
    snapshotIssueIfExists(db, 'rv-1', 'run-1');
    addDecisionLog(db, { issue_id: 'rv-1', date: new Date().toISOString(), status: 'resolved', old_status: 'pending', memo: '1차 확정', tab: 'review', reason: null, cycle_id: null });
    addDecisionLog(db, { issue_id: 'rv-1', date: new Date().toISOString(), status: 'deferred', old_status: 'resolved', memo: '2차 보류', tab: 'review', reason: null, cycle_id: null });
    const entries = getIssueTimeline(db, 'rv-1');
    assert.equal(entries.length, 3);
    // seq 기준 내림차순 (같은 날짜일 때)
    for (let i = 0; i < entries.length - 1; i++) {
      if (entries[i].date === entries[i + 1].date) {
        assert.ok(entries[i].seq >= entries[i + 1].seq, 'seq 내림차순 위반');
      }
    }
  });

  test('다른 이슈의 타임라인에 포함되지 않음', () => {
    upsertIssue(db, makeIssue({ id: 'rv-2', tab: 'review' }));
    addDecisionLog(db, { issue_id: 'rv-1', date: new Date().toISOString(), status: 'resolved', old_status: 'pending', memo: '1번 확정', tab: 'review', reason: null, cycle_id: null });
    addDecisionLog(db, { issue_id: 'rv-2', date: new Date().toISOString(), status: 'deferred', old_status: 'pending', memo: '2번 보류', tab: 'review', reason: null, cycle_id: null });
    const entries = getIssueTimeline(db, 'rv-1');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].issue_id, 'rv-1');
  });
});

// ─── getAppliedDecisions ──────────────────────────────────────────────────────

describe('getAppliedDecisions', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  test('pending 이슈는 포함되지 않음', () => {
    upsertIssue(db, makeIssue({ id: 'rv-1', status: 'pending' }));
    const decisions = getAppliedDecisions(db, 'review');
    assert.equal(decisions.length, 0);
  });

  test('resolved 이슈 (memo 있음) 포함', () => {
    upsertIssue(db, makeIssue({ id: 'rv-1', status: 'resolved', memo: '반영함' }));
    const decisions = getAppliedDecisions(db, 'review');
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].issueId, 'rv-1');
    assert.equal(decisions[0].status, 'resolved');
    assert.equal(decisions[0].memo, '반영함');
  });

  test('dismissed 이슈는 memo 없어도 포함', () => {
    upsertIssue(db, makeIssue({ id: 'rv-1', status: 'dismissed', memo: '' }));
    const decisions = getAppliedDecisions(db, 'review');
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].status, 'dismissed');
  });

  test('features 전용 상태 (candidate/promoted/archived) 포함', () => {
    upsertIssue(db, makeIssue({ id: 'ft-1', tab: 'features', status: 'candidate' as any, memo: 'Build 후보' }));
    upsertIssue(db, makeIssue({ id: 'ft-2', tab: 'features', status: 'promoted' as any, memo: '승격됨' }));
    upsertIssue(db, makeIssue({ id: 'ft-3', tab: 'features', status: 'archived' as any, memo: '보관 처리' }));
    const decisions = getAppliedDecisions(db, 'features');
    assert.equal(decisions.length, 3);
    const statuses = decisions.map(d => d.status).sort();
    assert.deepEqual(statuses, ['archived', 'candidate', 'promoted']);
  });

  test('decision log의 memo를 우선 사용', () => {
    upsertIssue(db, makeIssue({ id: 'rv-1', status: 'resolved', memo: '이슈 memo' }));
    addDecisionLog(db, { issue_id: 'rv-1', date: new Date().toISOString(), status: 'resolved', old_status: 'pending', memo: '로그 memo', tab: 'review', reason: null, cycle_id: null });
    const decisions = getAppliedDecisions(db, 'review');
    assert.equal(decisions[0].memo, '로그 memo');
  });

  test('탭 필터링', () => {
    upsertIssue(db, makeIssue({ id: 'rv-1', tab: 'review', status: 'resolved', memo: 'A' }));
    upsertIssue(db, makeIssue({ id: 'be-1', tab: 'backend', status: 'resolved', memo: 'B' }));
    const reviewOnly = getAppliedDecisions(db, 'review');
    assert.equal(reviewOnly.length, 1);
    assert.equal(reviewOnly[0].issueId, 'rv-1');
  });
});

// ─── Tab-aware status validation (route-level, tested at repository level) ───

describe('features 전용 상태 제약', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
    upsertIssue(db, makeIssue({ id: 'rv-1', tab: 'review' }));
    upsertIssue(db, makeIssue({ id: 'ft-1', tab: 'features' }));
  });

  test('features 탭에서 candidate/promoted/archived draft 생성 가능', () => {
    const p1 = createIssuePreview(db, 'ft-1', 'candidate', '후보');
    assert.equal(p1.preview_status, 'candidate');
    deleteIssuePreview(db, 'ft-1');

    const p2 = createIssuePreview(db, 'ft-1', 'promoted', '승격');
    assert.equal(p2.preview_status, 'promoted');
    deleteIssuePreview(db, 'ft-1');

    const p3 = createIssuePreview(db, 'ft-1', 'archived', '보관');
    assert.equal(p3.preview_status, 'archived');
  });

  test('review 탭에서도 repository 레벨에서는 draft 저장 가능 (라우트에서 차단)', () => {
    // repository 레이어는 제약 없음 — 서버 라우트에서 검증
    const preview = createIssuePreview(db, 'rv-1', 'candidate', '후보');
    assert.equal(preview.preview_status, 'candidate');
  });
});
