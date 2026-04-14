import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../helpers.js';
import {
  createDeliveryRun,
  getDeliveryRun,
  listDeliveryRuns,
  saveUserFlows,
  getUserFlows,
  saveScreens,
  getScreens,
  saveScopeItems,
  getScopeItems,
  assembleFinalDelivery,
  createBaseline,
  upsertWorkspaceMeta,
  type Tab,
} from '../../src/db/repository.js';

describe('Delivery & Structured Data', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
    upsertWorkspaceMeta(db, { name: 'test-ws', prd_path: null, source_prd_path: null, tech_stack_path: null });
  });

  // ─── Delivery Runs ──────────────────────────────────────────────

  test('createDeliveryRun — delivery run 생성 후 조회 가능', () => {
    const baselineRefs = { review: 1, ux: 2, backend: 3, frontend: 4, features: 5 };
    const output = JSON.stringify({ test: 'data' });

    const run = createDeliveryRun(db, '1.0.0', baselineRefs, output);

    assert.ok(run.id > 0);
    assert.equal(run.version, '1.0.0');
    assert.equal(run.output, output);
    assert.ok(run.baseline_refs);
  });

  test('getDeliveryRun — 생성된 delivery run 조회', () => {
    const baselineRefs = { review: 1, ux: 2, backend: 3, frontend: 4, features: 5 };
    const output = JSON.stringify({ test: 'data' });

    const created = createDeliveryRun(db, '1.0.0', baselineRefs, output);
    const fetched = getDeliveryRun(db, created.id);

    assert.ok(fetched !== null);
    assert.equal(fetched!.id, created.id);
    assert.equal(fetched!.version, '1.0.0');
  });

  test('getDeliveryRun — 없는 delivery run 조회 시 null', () => {
    const fetched = getDeliveryRun(db, 999);
    assert.equal(fetched, null);
  });

  test('listDeliveryRuns — 빈 상태 반환', () => {
    const runs = listDeliveryRuns(db);
    assert.equal(runs.length, 0);
  });

  test('listDeliveryRuns — 여러 delivery runs 조회', () => {
    const baselineRefs = { review: 1, ux: 2, backend: 3, frontend: 4, features: 5 };

    createDeliveryRun(db, '1.0.0', baselineRefs, '{"a":1}');
    createDeliveryRun(db, '1.0.1', baselineRefs, '{"b":2}');
    createDeliveryRun(db, '1.0.2', baselineRefs, '{"c":3}');

    const runs = listDeliveryRuns(db);
    assert.equal(runs.length, 3);
    // 최신부터 내림차순 (created_at DESC, 같으면 id DESC)
    assert.ok(runs[0].id >= runs[1].id);
    assert.ok(runs[1].id >= runs[2].id);
  });

  // ─── User Flows ───────────────────────────────────────────────────

  test('saveUserFlows/getUserFlows — 라운드트립 (single flow)', () => {
    const tab: Tab = 'ux';
    const flows = [
      {
        flow_id: 'flow-1',
        title: '사용자 로그인',
        actor: '신규 사용자',
        steps_json: ['로그인 페이지 진입', '이메일 입력', '비밀번호 입력', '로그인'],
      },
    ];

    saveUserFlows(db, tab, flows);
    const retrieved = getUserFlows(db, tab);

    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].flow_id, 'flow-1');
    assert.equal(retrieved[0].title, '사용자 로그인');
    assert.deepEqual(retrieved[0].steps_json, ['로그인 페이지 진입', '이메일 입력', '비밀번호 입력', '로그인']);
  });

  test('saveUserFlows — 해당 탭 기존 flows 삭제 후 재삽입', () => {
    const tab: Tab = 'ux';
    const flows1 = [{ flow_id: 'flow-1', title: 'Flow 1', actor: null, steps_json: null }];
    const flows2 = [{ flow_id: 'flow-2', title: 'Flow 2', actor: null, steps_json: null }];

    saveUserFlows(db, tab, flows1);
    let retrieved = getUserFlows(db, tab);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].flow_id, 'flow-1');

    // 새로운 flows로 덮어쓰기
    saveUserFlows(db, tab, flows2);
    retrieved = getUserFlows(db, tab);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].flow_id, 'flow-2');
  });

  test('saveUserFlows — 다른 탭은 영향 없음', () => {
    const uxFlows = [{ flow_id: 'ux-flow-1', title: 'UX Flow', actor: null, steps_json: null }];
    const backendFlows = [{ flow_id: 'be-flow-1', title: 'Backend Flow', actor: null, steps_json: null }];

    saveUserFlows(db, 'ux', uxFlows);
    saveUserFlows(db, 'backend', backendFlows);

    const retrieved_ux = getUserFlows(db, 'ux');
    const retrieved_backend = getUserFlows(db, 'backend');

    assert.equal(retrieved_ux.length, 1);
    assert.equal(retrieved_ux[0].flow_id, 'ux-flow-1');
    assert.equal(retrieved_backend.length, 1);
    assert.equal(retrieved_backend[0].flow_id, 'be-flow-1');
  });

  // ─── Screens ──────────────────────────────────────────────────────

  test('saveScreens/getScreens — 라운드트립 (single screen)', () => {
    const tab: Tab = 'ux';
    const screens = [
      {
        screen_id: 'screen-1',
        flow_ids_json: ['flow-1', 'flow-2'],
        title: '로그인 화면',
        description: '사용자 로그인 입력 필드',
        complexity: 'low',
        states_json: { loading: false, error: null },
      },
    ];

    saveScreens(db, tab, screens);
    const retrieved = getScreens(db, tab);

    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].screen_id, 'screen-1');
    assert.equal(retrieved[0].title, '로그인 화면');
    assert.deepEqual(retrieved[0].flow_ids_json, ['flow-1', 'flow-2']);
    assert.deepEqual(retrieved[0].states_json, { loading: false, error: null });
  });

  test('saveScreens — 해당 탭 기존 screens 삭제 후 재삽입', () => {
    const tab: Tab = 'ux';
    const screens1 = [{ screen_id: 'screen-1', flow_ids_json: null, title: 'Screen 1', description: null, complexity: null, states_json: null }];
    const screens2 = [{ screen_id: 'screen-2', flow_ids_json: null, title: 'Screen 2', description: null, complexity: null, states_json: null }];

    saveScreens(db, tab, screens1);
    let retrieved = getScreens(db, tab);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].screen_id, 'screen-1');

    // 새로운 screens으로 덮어쓰기
    saveScreens(db, tab, screens2);
    retrieved = getScreens(db, tab);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].screen_id, 'screen-2');
  });

  // ─── Scope Items ──────────────────────────────────────────────────

  test('saveScopeItems/getScopeItems — 라운드트립 (single item)', () => {
    const tab: Tab = 'backend';
    const items = [
      {
        scope_item_id: 'item-1',
        screen_id: 'screen-1',
        title: '로그인 API',
        complexity: 'medium',
        estimate_metadata: { points: 5, hours: 2 },
      },
    ];

    saveScopeItems(db, tab, items);
    const retrieved = getScopeItems(db, tab);

    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].scope_item_id, 'item-1');
    assert.equal(retrieved[0].title, '로그인 API');
    assert.deepEqual(retrieved[0].estimate_metadata, { points: 5, hours: 2 });
  });

  test('saveScopeItems — 해당 탭 기존 items 삭제 후 재삽입', () => {
    const tab: Tab = 'backend';
    const items1 = [{ scope_item_id: 'item-1', screen_id: null, title: 'Item 1', complexity: null, estimate_metadata: null }];
    const items2 = [{ scope_item_id: 'item-2', screen_id: null, title: 'Item 2', complexity: null, estimate_metadata: null }];

    saveScopeItems(db, tab, items1);
    let retrieved = getScopeItems(db, tab);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].scope_item_id, 'item-1');

    // 새로운 items으로 덮어쓰기
    saveScopeItems(db, tab, items2);
    retrieved = getScopeItems(db, tab);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].scope_item_id, 'item-2');
  });

  // ─── Final Delivery Assembly ─────────────────────────────────────

  test('assembleFinalDelivery — 데이터 없을 때 (null baselines)', () => {
    const delivery = assembleFinalDelivery(db);

    assert.ok(delivery.baselines);
    assert.ok(delivery.flows);
    assert.ok(delivery.screens);
    assert.ok(delivery.scopeItems);

    // 모든 탭의 baseline이 없어야 함
    assert.equal(delivery.baselines['review'], null);
    assert.equal(delivery.baselines['ux'], null);
    assert.equal(delivery.baselines['backend'], null);
    assert.equal(delivery.baselines['frontend'], null);
    assert.equal(delivery.baselines['features'], null);

    // 모든 탭의 flows/screens/items이 비어있어야 함
    assert.equal(delivery.flows['review'].length, 0);
    assert.equal(delivery.screens['ux'].length, 0);
    assert.equal(delivery.scopeItems['backend'].length, 0);
  });

  test('assembleFinalDelivery — 모든 탭에 데이터가 있을 때', () => {
    // ux baseline: doc_snapshot에 flows + screens 포함
    const uxSnapshot = JSON.stringify({
      document: { id: 1, tab: 'ux' },
      content: '# UX Doc',
      structuredData: {
        flows: [{ flow_id: 'f1', title: 'Flow', actor: null, steps_json: null }],
        screens: [{ screen_id: 's1', flow_ids_json: ['f1'], title: 'Screen', description: null, complexity: null, states_json: null }],
      },
    });
    // backend baseline: doc_snapshot에 scopeItems 포함
    const backendSnapshot = JSON.stringify({
      document: { id: 2, tab: 'backend' },
      content: '# Backend Doc',
      structuredData: {
        scopeItems: [{ scope_item_id: 'i1', screen_id: null, title: 'Item', complexity: null, estimate_metadata: null }],
      },
    });

    createBaseline(db, 'review', '1.0.0', null);
    createBaseline(db, 'ux', '1.0.0', uxSnapshot);
    createBaseline(db, 'backend', '1.0.0', backendSnapshot);
    createBaseline(db, 'frontend', '1.0.0', null);
    createBaseline(db, 'features', '1.0.0', null);

    const delivery = assembleFinalDelivery(db);

    // 모든 탭의 baseline이 있어야 함
    assert.ok(delivery.baselines['review']);
    assert.ok(delivery.baselines['ux']);
    assert.ok(delivery.baselines['backend']);
    assert.ok(delivery.baselines['frontend']);
    assert.ok(delivery.baselines['features']);

    // doc_snapshot에서 읽은 데이터가 포함되어야 함
    assert.equal(delivery.flows['ux'].length, 1);
    assert.equal(delivery.screens['ux'].length, 1);
    assert.equal(delivery.scopeItems['backend'].length, 1);

    // 다른 탭은 비어있어야 함
    assert.equal(delivery.flows['review'].length, 0);
    assert.equal(delivery.flows['backend'].length, 0);
  });
});
