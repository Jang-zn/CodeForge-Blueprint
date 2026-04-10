import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, makeIssue } from '../helpers.js';
import {
  getProviderModel,
  setProviderModel,
  getWorkspaceMeta,
  upsertWorkspaceMeta,
  getIssues,
  getIssue,
  upsertIssue,
  updateIssueStatus,
  deleteIssue,
  bulkUpsertIssues,
  getTabVersion,
  setTabVersion,
  addDecisionLog,
  getDecisionLogs,
  addChangelog,
  getChangelogs,
  getRefItems,
  bulkSetRefItems,
  createJob,
  updateJob,
  getJob,
  getPerspectives,
  getPerspective,
  createPerspective,
  updatePerspective,
  deletePerspective,
  lockPerspective,
  unlockPerspective,
  type Tab,
} from '../../src/db/repository.js';


describe('getProviderModel', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  test('workspace가 없으면 기본값(claude:claude-sonnet-4-6) 반환', () => {
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-sonnet-4-6' });
  });

  test('workspace 생성 후 기본값 반환', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-sonnet-4-6' });
  });

  test('setProviderModel 후 저장된 값 반환', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    setProviderModel(db, 'codex', 'o4-mini');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'codex', model: 'o4-mini' });
  });

  test('workspace 행 없이도 setProviderModel 실행 후 값 유지 (UPSERT)', () => {
    setProviderModel(db, 'codex', 'o4-mini');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'codex', model: 'o4-mini' });
  });

  test('claude provider 저장/읽기', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    setProviderModel(db, 'claude', 'claude-opus-4-6');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-opus-4-6' });
  });

  test('모델명에 콜론이 포함되어도 올바르게 파싱', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    setProviderModel(db, 'claude', 'claude-haiku-4-5-20251001');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-haiku-4-5-20251001' });
  });

  test('setProviderModel 연속 호출 시 마지막 값 유지', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    setProviderModel(db, 'claude', 'claude-sonnet-4-6');
    setProviderModel(db, 'codex', 'o3');
    setProviderModel(db, 'codex', 'gpt-4.1');
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'codex', model: 'gpt-4.1' });
  });

  test('손상된 provider_model은 기본값으로 fallback', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    // 직접 잘못된 값 삽입
    db.prepare("UPDATE workspace SET provider_model = 'invalid-no-colon' WHERE id = 1").run();
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-sonnet-4-6' });
  });

  test('알 수 없는 provider는 기본값으로 fallback', () => {
    upsertWorkspaceMeta(db, { name: 'test' });
    db.prepare("UPDATE workspace SET provider_model = 'unknown:some-model' WHERE id = 1").run();
    const result = getProviderModel(db);
    assert.deepEqual(result, { provider: 'claude', model: 'claude-sonnet-4-6' });
  });
});

// ─── upsertWorkspaceMeta / getWorkspaceMeta ────────────────────────────────

describe('upsertWorkspaceMeta / getWorkspaceMeta', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('workspace가 없으면 null 반환', () => {
    assert.equal(getWorkspaceMeta(db), null);
  });

  test('INSERT — name으로 첫 생성', () => {
    upsertWorkspaceMeta(db, { name: 'my-project' });
    const meta = getWorkspaceMeta(db);
    assert.equal(meta?.name, 'my-project');
    assert.equal(meta?.prd_path, null);
  });

  test('INSERT — name 생략 시 Untitled 사용', () => {
    upsertWorkspaceMeta(db, {});
    const meta = getWorkspaceMeta(db);
    assert.equal(meta?.name, 'Untitled');
  });

  test('UPDATE — 기존 행의 name 변경', () => {
    upsertWorkspaceMeta(db, { name: 'old' });
    upsertWorkspaceMeta(db, { name: 'new' });
    assert.equal(getWorkspaceMeta(db)?.name, 'new');
  });

  test('UPDATE — prd_path 설정', () => {
    upsertWorkspaceMeta(db, { name: 'proj' });
    upsertWorkspaceMeta(db, { prd_path: '/docs/prd.md' });
    assert.equal(getWorkspaceMeta(db)?.prd_path, '/docs/prd.md');
  });

  test('UPDATE — id와 created_at은 갱신 대상에서 제외', () => {
    upsertWorkspaceMeta(db, { name: 'proj' });
    const before = getWorkspaceMeta(db);
    upsertWorkspaceMeta(db, { id: 999 as any, created_at: '2000-01-01' as any, name: 'updated' });
    const after = getWorkspaceMeta(db);
    assert.equal(after?.id, 1);
    assert.equal(after?.created_at, before?.created_at);
  });
});

// ─── issues ────────────────────────────────────────────────────────────────

// makeIssue는 helpers.ts에서 import — category 기본값이 'A'로 다르지만
// 이 테스트에서는 category를 직접 검증하지 않으므로 호환됨

describe('upsertIssue / getIssue / getIssues', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('이슈 삽입 후 getIssue로 조회', () => {
    upsertIssue(db, makeIssue({ id: 'a1' }));
    const issue = getIssue(db, 'a1');
    assert.equal(issue?.id, 'a1');
    assert.equal(issue?.title, '테스트 이슈');
  });

  test('존재하지 않는 id는 null 반환', () => {
    assert.equal(getIssue(db, 'not-exist'), null);
  });

  test('getIssues — 전체 조회', () => {
    upsertIssue(db, makeIssue({ id: 'a1' }));
    upsertIssue(db, makeIssue({ id: 'a2', tab: 'backend' }));
    assert.equal(getIssues(db).length, 2);
  });

  test('getIssues — tab 필터링', () => {
    upsertIssue(db, makeIssue({ id: 'a1', tab: 'review' }));
    upsertIssue(db, makeIssue({ id: 'be1', tab: 'backend' }));
    const review = getIssues(db, 'review');
    assert.equal(review.length, 1);
    assert.equal(review[0].id, 'a1');
  });

  test('UPSERT — 같은 id로 재삽입 시 title 갱신', () => {
    upsertIssue(db, makeIssue({ id: 'a1', title: '원본' }));
    upsertIssue(db, makeIssue({ id: 'a1', title: '수정본' }));
    assert.equal(getIssue(db, 'a1')?.title, '수정본');
  });

  test('getIssues — sort_order 오름차순 정렬', () => {
    upsertIssue(db, { ...makeIssue({ id: 'a2' }), sort_order: 2 });
    upsertIssue(db, { ...makeIssue({ id: 'a1' }), sort_order: 1 });
    const issues = getIssues(db);
    assert.equal(issues[0].id, 'a1');
    assert.equal(issues[1].id, 'a2');
  });
});

describe('updateIssueStatus', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('status와 memo 변경', () => {
    upsertIssue(db, makeIssue({ id: 'a1' }));
    updateIssueStatus(db, 'a1', 'resolved', '검토 완료');
    const issue = getIssue(db, 'a1');
    assert.equal(issue?.status, 'resolved');
    assert.equal(issue?.memo, '검토 완료');
  });

  test('존재하지 않는 id 업데이트 시 에러 없음', () => {
    assert.doesNotThrow(() => updateIssueStatus(db, 'not-exist', 'dismissed', ''));
  });
});

describe('deleteIssue', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('삭제 후 getIssue는 null 반환', () => {
    upsertIssue(db, makeIssue({ id: 'a1' }));
    deleteIssue(db, 'a1');
    assert.equal(getIssue(db, 'a1'), null);
  });

  test('존재하지 않는 id 삭제 시 에러 없음', () => {
    assert.doesNotThrow(() => deleteIssue(db, 'not-exist'));
  });
});

describe('bulkUpsertIssues', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('여러 이슈를 트랜잭션으로 한 번에 삽입', () => {
    const issues = [makeIssue({ id: 'a1' }), makeIssue({ id: 'a2' }), makeIssue({ id: 'a3' })];
    bulkUpsertIssues(db, issues);
    assert.equal(getIssues(db).length, 3);
  });
});

// ─── tab_versions ─────────────────────────────────────────────────────────

describe('getTabVersion / setTabVersion', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('버전 없으면 1.0.0 반환', () => {
    assert.equal(getTabVersion(db, 'review'), '1.0.0');
  });

  test('setTabVersion 후 getTabVersion에서 확인', () => {
    setTabVersion(db, 'review', '2.1.0');
    assert.equal(getTabVersion(db, 'review'), '2.1.0');
  });

  test('같은 tab 재설정 시 덮어쓰기 (UPSERT)', () => {
    setTabVersion(db, 'backend', '1.0.0');
    setTabVersion(db, 'backend', '1.1.0');
    assert.equal(getTabVersion(db, 'backend'), '1.1.0');
  });

  test('탭별 독립 버전 관리', () => {
    setTabVersion(db, 'review', '2.0.0');
    setTabVersion(db, 'frontend', '3.0.0');
    assert.equal(getTabVersion(db, 'review'), '2.0.0');
    assert.equal(getTabVersion(db, 'frontend'), '3.0.0');
    assert.equal(getTabVersion(db, 'backend'), '1.0.0'); // 설정 안 한 탭
  });
});

// ─── decision_logs ────────────────────────────────────────────────────────

describe('addDecisionLog / getDecisionLogs', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
    upsertIssue(db, makeIssue({ id: 'a1' }));
  });

  test('로그 추가 후 조회', () => {
    addDecisionLog(db, { issue_id: 'a1', date: '2025-01-01', status: 'resolved', memo: '완료' });
    const logs = getDecisionLogs(db, 'a1');
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, 'resolved');
    assert.equal(logs[0].memo, '완료');
  });

  test('같은 이슈에 복수 로그 추가', () => {
    addDecisionLog(db, { issue_id: 'a1', date: '2025-01-01', status: 'reviewing', memo: '검토 중' });
    addDecisionLog(db, { issue_id: 'a1', date: '2025-01-02', status: 'resolved', memo: '완료' });
    assert.equal(getDecisionLogs(db, 'a1').length, 2);
  });

  test('다른 이슈 로그는 조회되지 않음', () => {
    upsertIssue(db, makeIssue({ id: 'a2' }));
    addDecisionLog(db, { issue_id: 'a2', date: '2025-01-01', status: 'resolved', memo: '다른 이슈' });
    assert.equal(getDecisionLogs(db, 'a1').length, 0);
  });
});

// ─── changelogs ───────────────────────────────────────────────────────────

describe('addChangelog / getChangelogs', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('changelog 추가 후 전체 조회', () => {
    addChangelog(db, { tab: 'review', version: '1.1.0', date: '2025-01-01', description: '초기 리뷰' });
    const logs = getChangelogs(db);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].description, '초기 리뷰');
  });

  test('tab 필터 조회', () => {
    addChangelog(db, { tab: 'review', version: '1.1.0', date: '2025-01-01', description: 'review log' });
    addChangelog(db, { tab: 'backend', version: '1.0.0', date: '2025-01-01', description: 'backend log' });
    const reviewLogs = getChangelogs(db, 'review');
    assert.equal(reviewLogs.length, 1);
    assert.equal(reviewLogs[0].tab, 'review');
  });
});

// ─── ref_items ────────────────────────────────────────────────────────────

describe('bulkSetRefItems / getRefItems', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('ref 아이템 삽입 후 조회', () => {
    bulkSetRefItems(db, [{ content: 'ref1' }, { content: 'ref2', fe_section: 'auth' }]);
    const items = getRefItems(db);
    assert.equal(items.length, 2);
  });

  test('bulkSetRefItems 재호출 시 기존 항목 교체', () => {
    bulkSetRefItems(db, [{ content: 'old' }]);
    bulkSetRefItems(db, [{ content: 'new1' }, { content: 'new2' }]);
    const items = getRefItems(db);
    assert.equal(items.length, 2);
    assert.ok(items.every(i => i.content !== 'old'));
  });

  test('fe_section null/non-null 혼합 저장', () => {
    bulkSetRefItems(db, [{ content: 'a' }, { content: 'b', fe_section: 'auth' }]);
    const items = getRefItems(db);
    const withSection = items.find(i => i.fe_section === 'auth');
    const withoutSection = items.find(i => i.fe_section === null);
    assert.ok(withSection);
    assert.ok(withoutSection);
  });

  test('빈 배열로 초기화', () => {
    bulkSetRefItems(db, [{ content: 'some' }]);
    bulkSetRefItems(db, []);
    assert.equal(getRefItems(db).length, 0);
  });
});

// ─── jobs ──────────────────────────────────────────────────────────────────

describe('createJob / updateJob / getJob', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('createJob 후 getJob으로 조회', () => {
    createJob(db, 'job-1', 'analyze');
    const job = getJob(db, 'job-1');
    assert.equal(job?.id, 'job-1');
    assert.equal(job?.type, 'analyze');
    assert.equal(job?.status, 'running');
    assert.equal(job?.completed_at, null);
    assert.equal(job?.error, null);
  });

  test('존재하지 않는 job은 null 반환', () => {
    assert.equal(getJob(db, 'not-exist'), null);
  });

  test('updateJob — success 상태로 완료', () => {
    createJob(db, 'job-2', 'generate');
    updateJob(db, 'job-2', 'success');
    const job = getJob(db, 'job-2');
    assert.equal(job?.status, 'success');
    assert.ok(job?.completed_at, 'completed_at이 설정되어야 함');
    assert.equal(job?.error, null);
  });

  test('updateJob — error 메시지와 함께 failed 상태', () => {
    createJob(db, 'job-3', 'init');
    updateJob(db, 'job-3', 'failed', 'Claude CLI not found');
    const job = getJob(db, 'job-3');
    assert.equal(job?.status, 'failed');
    assert.equal(job?.error, 'Claude CLI not found');
  });

  test('여러 job 독립 관리', () => {
    createJob(db, 'j1', 'analyze');
    createJob(db, 'j2', 'generate');
    updateJob(db, 'j1', 'success');
    assert.equal(getJob(db, 'j1')?.status, 'success');
    assert.equal(getJob(db, 'j2')?.status, 'running');
  });
});

// ─── perspectives ──────────────────────────────────────────────────────────

describe('createPerspective / getPerspective / getPerspectives', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('생성 후 getPerspective로 조회', () => {
    const p = createPerspective(db, { type: 'review', name: 'Product', description: 'PM 관점' });
    assert.ok(p.id);
    assert.equal(p.type, 'review');
    assert.equal(p.name, 'Product');
    assert.equal(p.description, 'PM 관점');
    assert.equal(p.is_locked, 0);
  });

  test('getPerspective — 존재하지 않는 ID는 null 반환', () => {
    assert.equal(getPerspective(db, 999), null);
  });

  test('getPerspectives — 전체 조회', () => {
    createPerspective(db, { type: 'review', name: 'Product' });
    createPerspective(db, { type: 'review', name: 'Ops' });
    const all = getPerspectives(db);
    assert.equal(all.length, 2);
  });

  test('getPerspectives — type으로 필터링', () => {
    createPerspective(db, { type: 'review', name: 'A' });
    createPerspective(db, { type: 'review', name: 'B' });
    createPerspective(db, { type: 'features', name: 'C' });
    const review = getPerspectives(db, 'review');
    assert.equal(review.length, 2);
    assert.ok(review.every(p => p.type === 'review'));
  });

  test('getPerspectives — name으로 정렬', () => {
    createPerspective(db, { type: 'review', name: 'Z' });
    createPerspective(db, { type: 'review', name: 'A' });
    const sorted = getPerspectives(db, 'review');
    assert.equal(sorted[0].name, 'A');
    assert.equal(sorted[1].name, 'Z');
  });
});

describe('updatePerspective', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('name 수정', () => {
    const p = createPerspective(db, { type: 'review', name: 'Old' });
    const updated = updatePerspective(db, p.id, { name: 'New' });
    assert.equal(updated.name, 'New');
    assert.equal(updated.type, 'review');
  });

  test('description 수정', () => {
    const p = createPerspective(db, { type: 'review', name: 'PM' });
    const updated = updatePerspective(db, p.id, { description: '새 설명' });
    assert.equal(updated.description, '새 설명');
  });

  test('description을 null로 설정', () => {
    const p = createPerspective(db, { type: 'review', name: 'PM', description: '기존' });
    const updated = updatePerspective(db, p.id, { description: null });
    assert.equal(updated.description, null);
  });

  test('존재하지 않는 ID 업데이트 시 에러 발생', () => {
    assert.throws(() => updatePerspective(db, 999, { name: 'New' }), /not found/);
  });

  test('locked 상태에서는 수정 불가', () => {
    const p = createPerspective(db, { type: 'review', name: 'PM' });
    lockPerspective(db, p.id);
    assert.throws(() => updatePerspective(db, p.id, { name: 'New' }), /locked/);
  });
});

describe('deletePerspective', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('삭제 후 getPerspective는 null 반환', () => {
    const p = createPerspective(db, { type: 'review', name: 'PM' });
    deletePerspective(db, p.id);
    assert.equal(getPerspective(db, p.id), null);
  });

  test('locked 상태에서는 삭제 불가', () => {
    const p = createPerspective(db, { type: 'review', name: 'PM' });
    lockPerspective(db, p.id);
    assert.throws(() => deletePerspective(db, p.id), /locked/);
  });

  test('존재하지 않는 ID 삭제 시 에러 없음', () => {
    assert.doesNotThrow(() => deletePerspective(db, 999));
  });
});

describe('lockPerspective / unlockPerspective', () => {
  let db: any;

  beforeEach(() => { db = createTestDb(); });

  test('lock 후 is_locked = 1', () => {
    const p = createPerspective(db, { type: 'review', name: 'PM' });
    const locked = lockPerspective(db, p.id);
    assert.equal(locked.is_locked, 1);
  });

  test('unlock 후 is_locked = 0', () => {
    const p = createPerspective(db, { type: 'review', name: 'PM' });
    lockPerspective(db, p.id);
    const unlocked = unlockPerspective(db, p.id);
    assert.equal(unlocked.is_locked, 0);
  });

  test('unlock 후 다시 수정 가능', () => {
    const p = createPerspective(db, { type: 'review', name: 'PM' });
    lockPerspective(db, p.id);
    unlockPerspective(db, p.id);
    const updated = updatePerspective(db, p.id, { name: 'Updated' });
    assert.equal(updated.name, 'Updated');
  });

  test('존재하지 않는 ID lock 시 에러', () => {
    assert.throws(() => lockPerspective(db, 999), /not found/);
  });
});
