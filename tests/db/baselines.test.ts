import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../helpers.js';
import {
  createBaseline,
  getActiveBaseline,
  listBaselines,
  getAllActiveBaselines,
  supersedeBaseline,
  checkFreezeReadiness,
  addDocumentRecord,
  upsertWorkspaceMeta,
} from '../../src/db/repository.js';

describe('Stage Baselines', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
    upsertWorkspaceMeta(db, { name: 'test-ws', prd_path: null, source_prd_path: null, tech_stack_path: null });
  });

  // ─── createBaseline ──────────────────────────────────────────────

  test('createBaseline — review baseline 생성 후 조회 가능', () => {
    const b = createBaseline(db, 'review', '1.0.0', null);
    assert.equal(b.tab, 'review');
    assert.equal(b.version, '1.0.0');
    assert.ok(b.id > 0);
    assert.equal(b.superseded_at, null);
  });

  test('createBaseline — ux baseline 생성 가능 (tab 확장 검증)', () => {
    const b = createBaseline(db, 'ux', '1.0.0', null);
    assert.equal(b.tab, 'ux');
  });

  test('createBaseline — doc_snapshot JSON 저장', () => {
    const snapshot = JSON.stringify({ id: 1, tab: 'review', version: '1.0.0' });
    const b = createBaseline(db, 'review', '1.0.0', snapshot);
    const fetched = getActiveBaseline(db, 'review');
    assert.equal(fetched?.doc_snapshot, snapshot);
  });

  // ─── getActiveBaseline ────────────────────────────────────────────

  test('getActiveBaseline — baseline 없으면 null', () => {
    const b = getActiveBaseline(db, 'review');
    assert.equal(b, null);
  });

  test('getActiveBaseline — 생성 후 조회', () => {
    createBaseline(db, 'review', '1.0.0', null);
    const b = getActiveBaseline(db, 'review');
    assert.ok(b !== null);
    assert.equal(b.version, '1.0.0');
  });

  test('getActiveBaseline — supersede 후 이전 것 비활성화', () => {
    const b1 = createBaseline(db, 'review', '1.0.0', null);
    const b2 = createBaseline(db, 'review', '1.0.1', null);
    supersedeBaseline(db, b1.id, b2.id);
    // b1이 supersede됨, b2는 active 상태
    const active = getActiveBaseline(db, 'review');
    assert.ok(active !== null);
    assert.equal(active.id, b2.id);
  });

  // ─── listBaselines ────────────────────────────────────────────────

  test('listBaselines — 전체 기록 반환 (superseded 포함)', () => {
    createBaseline(db, 'review', '1.0.0', null);
    createBaseline(db, 'review', '1.0.1', null);
    const list = listBaselines(db, 'review');
    assert.equal(list.length, 2);
  });

  test('listBaselines — 다른 탭 baseline은 포함 안함', () => {
    createBaseline(db, 'review', '1.0.0', null);
    createBaseline(db, 'ux', '1.0.0', null);
    const reviewList = listBaselines(db, 'review');
    assert.equal(reviewList.length, 1);
  });

  // ─── getAllActiveBaselines ─────────────────────────────────────────

  test('getAllActiveBaselines — 탭 5개 키 모두 반환', () => {
    const all = getAllActiveBaselines(db);
    assert.ok('review' in all);
    assert.ok('ux' in all);
    assert.ok('backend' in all);
    assert.ok('frontend' in all);
    assert.ok('features' in all);
  });

  test('getAllActiveBaselines — baseline 없으면 null, 있으면 객체 반환', () => {
    createBaseline(db, 'review', '1.0.0', null);
    const all = getAllActiveBaselines(db);
    assert.ok(all.review !== null);
    assert.equal(all.ux, null);
  });

  // ─── supersedeBaseline ───────────────────────────────────────────

  test('supersedeBaseline — 기존 baseline supersede 처리', () => {
    const b1 = createBaseline(db, 'review', '1.0.0', null);
    const b2 = createBaseline(db, 'review', '1.0.1', null);
    supersedeBaseline(db, b1.id, b2.id);

    const list = listBaselines(db, 'review');
    const old = list.find(b => b.id === b1.id);
    assert.ok(old?.superseded_at !== null);
    assert.equal(old?.superseded_by, b2.id);
  });

  test('supersedeBaseline — 존재하지 않는 id는 no-op', () => {
    assert.doesNotThrow(() => supersedeBaseline(db, 9999, 99999));
  });

  // ─── checkFreezeReadiness ─────────────────────────────────────────

  test('checkFreezeReadiness — review는 항상 ready', () => {
    const result = checkFreezeReadiness(db, 'review');
    assert.equal(result.ready, true);
    assert.equal(result.reasons.length, 0);
  });

  test('checkFreezeReadiness — ux: review baseline 없으면 not ready', () => {
    const result = checkFreezeReadiness(db, 'ux');
    assert.equal(result.ready, false);
    assert.ok(result.reasons.length > 0);
  });

  test('checkFreezeReadiness — ux: review baseline 있으면 ready', () => {
    createBaseline(db, 'review', '1.0.0', null);
    const result = checkFreezeReadiness(db, 'ux');
    assert.equal(result.ready, true);
  });

  test('checkFreezeReadiness — backend: review+ux baseline 모두 필요', () => {
    createBaseline(db, 'review', '1.0.0', null);
    const resultWithOnlyReview = checkFreezeReadiness(db, 'backend');
    assert.equal(resultWithOnlyReview.ready, false);

    createBaseline(db, 'ux', '1.0.0', null);
    const resultWithBoth = checkFreezeReadiness(db, 'backend');
    assert.equal(resultWithBoth.ready, true);
  });

  test('checkFreezeReadiness — frontend: review+ux+backend 모두 필요', () => {
    createBaseline(db, 'review', '1.0.0', null);
    createBaseline(db, 'ux', '1.0.0', null);
    const result = checkFreezeReadiness(db, 'frontend');
    assert.equal(result.ready, false);

    createBaseline(db, 'backend', '1.0.0', null);
    const result2 = checkFreezeReadiness(db, 'frontend');
    assert.equal(result2.ready, true);
  });

  // ─── issues 탭 CHECK 제약 확장 검증 ──────────────────────────────

  test('issues 테이블에 ux 탭 이슈 저장 가능', () => {
    assert.doesNotThrow(() => {
      db.prepare(`
        INSERT INTO issues (id, tab, category, title, html_content)
        VALUES ('ux-test-1', 'ux', 'UX-FLOW', 'UX 플로우 이슈', '<p>테스트</p>')
      `).run();
    });
    const row = db.prepare(`SELECT * FROM issues WHERE id = 'ux-test-1'`).get();
    assert.equal(row.tab, 'ux');
  });

  test('tab_versions 테이블에 ux 탭 저장 가능', () => {
    assert.doesNotThrow(() => {
      db.prepare(`INSERT OR IGNORE INTO tab_versions (tab, version) VALUES ('ux', '1.0.0')`).run();
    });
    const row = db.prepare(`SELECT * FROM tab_versions WHERE tab = 'ux'`).get();
    assert.equal(row.tab, 'ux');
  });
});
