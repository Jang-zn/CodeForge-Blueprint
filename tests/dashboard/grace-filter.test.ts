/**
 * Grace period UX 테스트
 *
 * app.js는 브라우저 전용 스크립트이므로 직접 import 불가.
 * jsdom 환경에서 핵심 grace 로직(changedInFilter, applyFilter, updateCounts,
 * clearGrace, renderControls 배지)을 재현하여 동작을 검증한다.
 */
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ── app.js에서 추출한 상수/로직 ─────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:   { label: '미검토', cls: 'active-pending' },
  reviewing: { label: '검토중', cls: 'active-reviewing' },
  resolved:  { label: '확정',   cls: 'active-resolved' },
  deferred:  { label: '보류',   cls: 'active-deferred' },
  dismissed: { label: '삭제',   cls: 'active-dismissed' },
};

const TAB_ID_PATTERN = /^[a-z][-a-z0-9]*\d+$/;

// ── 테스트용 미니 런타임 ─────────────────────────────────────

interface IssueState {
  status: string;
  memo: string;
  serverStatus: string;
}

interface GraceRuntime {
  dom: JSDOM;
  document: Document;
  state: Record<string, IssueState>;
  changedInFilter: Set<string>;
  activeTab: string;
  currentFilter: string;

  getIssueState(id: string): IssueState;
  setIssueState(id: string, patch: Partial<IssueState>): void;
  applyFilter(): void;
  updateCounts(): Record<string, number>;
  clearGrace(): void;
  renderControls(id: string): void;
  getIssueIds(): string[];

  /** 상태 버튼 클릭 시뮬레이션 */
  clickStatus(id: string, newStatus: string): void;
  /** 필터 버튼 클릭 시뮬레이션 */
  clickFilter(filter: string): void;
}

function buildHtml(issueIds: string[]): string {
  const issueHtml = issueIds.map(id =>
    `<h3 id="${id}">${id} 제목</h3><div class="issue-controls" data-issue-id="${id}"></div><p>본문</p>`
  ).join('');

  const filterButtons = ['all', 'pending', 'reviewing', 'resolved', 'deferred', 'dismissed', 'has-memo']
    .map(f => `<button class="filter-btn" data-filter="${f}"><span id="count-${f}">0</span></button>`)
    .join('');

  return `<!DOCTYPE html><html><body>
    <div class="filter-bar">${filterButtons}</div>
    <div id="panel-review">${issueHtml}</div>
  </body></html>`;
}

function createRuntime(issueIds: string[], initialStatuses?: Record<string, string>): GraceRuntime {
  const dom = new JSDOM(buildHtml(issueIds));
  const document = dom.window.document;

  const state: Record<string, IssueState> = {};
  for (const id of issueIds) {
    state[id] = { status: initialStatuses?.[id] ?? 'pending', memo: '', serverStatus: 'pending' };
  }

  const changedInFilter = new Set<string>();
  let activeTab = 'review';
  let currentFilter = 'all';

  function getIssueState(id: string): IssueState {
    return state[id] || { status: 'pending', memo: '', serverStatus: 'pending' };
  }

  function setIssueState(id: string, patch: Partial<IssueState>) {
    state[id] = { ...getIssueState(id), ...patch };
  }

  function getIssueIds(): string[] {
    return Array.from(document.querySelectorAll(`#panel-${activeTab} h3[id]`))
      .map(el => el.id)
      .filter(id => TAB_ID_PATTERN.test(id));
  }

  function clearGrace() {
    changedInFilter.forEach(id => {
      const h3 = document.getElementById(id);
      if (h3) h3.querySelector('.status-transition-badge')?.remove();
    });
    changedInFilter.clear();
  }

  function applyFilter() {
    document.querySelectorAll(`#panel-${activeTab} h3[id]`).forEach(h3El => {
      const h3 = h3El as HTMLElement;
      const id = h3.id;
      if (!TAB_ID_PATTERN.test(id)) return;
      const s = getIssueState(id);
      let show = true;
      if (currentFilter === 'has-memo') show = s.memo.trim().length > 0;
      else if (currentFilter !== 'all') show = s.status === currentFilter;

      const inGrace = changedInFilter.has(id);
      if (inGrace) show = true;

      let el: HTMLElement | null = h3;
      while (el) {
        el.style.display = show ? '' : 'none';
        el.classList.toggle('status-changed-grace', inGrace);
        el = el.nextElementSibling as HTMLElement | null;
        if (!el || el.tagName === 'H3' || el.tagName === 'H2') break;
      }
    });
  }

  function updateCounts(): Record<string, number> {
    const ids = getIssueIds();
    const counts: Record<string, number> = {
      all: ids.length, pending: 0, reviewing: 0, resolved: 0,
      deferred: 0, dismissed: 0, 'has-memo': 0,
    };
    ids.forEach(id => {
      const s = getIssueState(id);
      counts[s.status] = (counts[s.status] || 0) + 1;
      if (s.memo.trim()) counts['has-memo']++;
    });
    if (currentFilter !== 'all' && currentFilter !== 'has-memo' && changedInFilter.size > 0) {
      changedInFilter.forEach(id => {
        const s = getIssueState(id);
        if (s.status !== currentFilter) counts[currentFilter]++;
      });
    }
    Object.entries(counts).forEach(([k, v]) => {
      const el = document.getElementById(`count-${k}`);
      if (el) el.textContent = String(v);
    });
    return counts;
  }

  function renderControls(id: string) {
    const s = getIssueState(id);
    const h3 = document.getElementById(id);
    if (h3) {
      const existingBadge = h3.querySelector('.status-transition-badge');
      if (existingBadge) existingBadge.remove();
      if (changedInFilter.has(id)) {
        const badge = document.createElement('span');
        badge.className = 'status-transition-badge';
        badge.textContent = `→ ${STATUS_MAP[s.status]?.label ?? s.status}`;
        h3.appendChild(badge);
      }
    }
  }

  function clickStatus(id: string, newStatus: string) {
    if (currentFilter !== 'all' && currentFilter !== 'has-memo') {
      if (newStatus !== currentFilter) changedInFilter.add(id);
      else changedInFilter.delete(id);
    }
    setIssueState(id, { status: newStatus });
    renderControls(id);
    applyFilter();
  }

  function clickFilter(filter: string) {
    currentFilter = filter;
    clearGrace();
    applyFilter();
  }

  const rt: GraceRuntime = {
    dom, document, state, changedInFilter,
    get activeTab() { return activeTab; },
    set activeTab(v) { activeTab = v; },
    get currentFilter() { return currentFilter; },
    set currentFilter(v) { currentFilter = v; },
    getIssueState, setIssueState, applyFilter, updateCounts,
    clearGrace, renderControls, getIssueIds,
    clickStatus, clickFilter,
  };
  return rt;
}

// ── Helper ──

function isVisible(rt: GraceRuntime, id: string): boolean {
  const h3 = rt.document.getElementById(id) as HTMLElement;
  return h3?.style.display !== 'none';
}

function hasGraceClass(rt: GraceRuntime, id: string): boolean {
  const h3 = rt.document.getElementById(id) as HTMLElement;
  return h3?.classList.contains('status-changed-grace') ?? false;
}

function hasBadge(rt: GraceRuntime, id: string): boolean {
  const h3 = rt.document.getElementById(id);
  return !!h3?.querySelector('.status-transition-badge');
}

function badgeText(rt: GraceRuntime, id: string): string {
  const h3 = rt.document.getElementById(id);
  return h3?.querySelector('.status-transition-badge')?.textContent ?? '';
}

// ══════════════════════════════════════════════════════════════
// 테스트
// ══════════════════════════════════════════════════════════════

describe('Grace period UX', () => {

  describe('기본 grace 동작', () => {
    test('필터 중 상태 변경 시 이슈가 사라지지 않고 grace 표시', () => {
      const rt = createRuntime(['a1', 'a2', 'a3']);
      rt.clickFilter('pending');
      assert.ok(isVisible(rt, 'a1'));

      rt.clickStatus('a1', 'reviewing');

      assert.ok(isVisible(rt, 'a1'), 'grace 상태에서 이슈가 보여야 함');
      assert.ok(hasGraceClass(rt, 'a1'), 'grace 클래스가 있어야 함');
      assert.ok(hasBadge(rt, 'a1'), '전환 뱃지가 있어야 함');
      assert.equal(badgeText(rt, 'a1'), '→ 검토중');
    });

    test('grace 상태가 아닌 이슈는 정상 필터링', () => {
      const rt = createRuntime(['a1', 'a2']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');

      assert.ok(isVisible(rt, 'a2'), '변경하지 않은 pending 이슈는 보여야 함');
      assert.ok(!hasGraceClass(rt, 'a2'), 'grace 클래스가 없어야 함');
    });

    test('"전체" 필터에서는 grace 동작 없음', () => {
      const rt = createRuntime(['a1']);
      // currentFilter === 'all' 상태에서 상태 변경
      rt.clickStatus('a1', 'reviewing');

      assert.equal(rt.changedInFilter.size, 0, 'changedInFilter가 비어있어야 함');
      assert.ok(!hasGraceClass(rt, 'a1'));
      assert.ok(!hasBadge(rt, 'a1'));
    });

    test('같은 상태로 되돌리면 grace에서 제거', () => {
      const rt = createRuntime(['a1']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');
      assert.ok(rt.changedInFilter.has('a1'));

      rt.clickStatus('a1', 'pending');
      assert.ok(!rt.changedInFilter.has('a1'), '원래 필터 상태로 복귀 시 grace에서 제거');
      assert.ok(!hasGraceClass(rt, 'a1'));
      assert.ok(!hasBadge(rt, 'a1'));
    });
  });

  describe('grace 뱃지 렌더링', () => {
    test('상태 변경마다 뱃지 텍스트가 업데이트', () => {
      const rt = createRuntime(['a1']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');
      assert.equal(badgeText(rt, 'a1'), '→ 검토중');

      rt.clickStatus('a1', 'resolved');
      assert.equal(badgeText(rt, 'a1'), '→ 확정');
    });

    test('뱃지가 h3.textContent에 포함되므로 clearGrace 시 반드시 제거', () => {
      const rt = createRuntime(['a1']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');

      const h3 = rt.document.getElementById('a1')!;
      assert.ok(h3.textContent!.includes('→ 검토중'));

      rt.clearGrace();
      assert.ok(!h3.textContent!.includes('→ 검토중'), 'clearGrace 후 뱃지 텍스트가 사라져야 함');
      assert.ok(!h3.querySelector('.status-transition-badge'));
    });
  });

  describe('grace 해제 시점', () => {
    test('필터 재선택 시 grace 해제 + 이슈 숨김', () => {
      const rt = createRuntime(['a1', 'a2']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');
      assert.ok(isVisible(rt, 'a1'));

      rt.clickFilter('pending');  // 같은 필터 재클릭
      assert.ok(!isVisible(rt, 'a1'), '필터 재선택 후 grace 해제 → 이슈 숨김');
      assert.equal(rt.changedInFilter.size, 0);
    });

    test('다른 필터 선택 시 grace 해제', () => {
      const rt = createRuntime(['a1']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');

      rt.clickFilter('reviewing');
      assert.ok(isVisible(rt, 'a1'), '새 필터 상태와 일치하면 정상 표시');
      assert.ok(!hasGraceClass(rt, 'a1'), 'grace 아닌 정상 표시');
    });

    test('clearGrace 직접 호출 (반영/분석 완료 시나리오)', () => {
      const rt = createRuntime(['a1', 'a2']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');
      rt.clickStatus('a2', 'resolved');

      rt.clearGrace();
      assert.equal(rt.changedInFilter.size, 0);
      assert.ok(!hasBadge(rt, 'a1'));
      assert.ok(!hasBadge(rt, 'a2'));
    });
  });

  describe('필터 카운트 보정', () => {
    test('grace 이슈를 현재 필터 카운트에 포함', () => {
      const rt = createRuntime(['a1', 'a2', 'a3']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');

      const counts = rt.updateCounts();
      // 실제 pending: 2, 하지만 grace로 a1이 표시 중이므로 +1 = 3
      assert.equal(counts.pending, 3, 'grace 이슈를 현재 필터 카운트에 포함');
      assert.equal(counts.reviewing, 1, '실제 reviewing 카운트는 정확');
    });

    test('"전체" 필터에서는 카운트 보정 없음', () => {
      const rt = createRuntime(['a1', 'a2']);
      // currentFilter === 'all'
      rt.clickStatus('a1', 'reviewing');

      const counts = rt.updateCounts();
      assert.equal(counts.pending, 1);
      assert.equal(counts.reviewing, 1);
    });

    test('grace 해제 후 카운트 정상 복귀', () => {
      const rt = createRuntime(['a1', 'a2', 'a3']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');
      assert.equal(rt.updateCounts().pending, 3);

      rt.clearGrace();
      const counts = rt.updateCounts();
      assert.equal(counts.pending, 2, 'grace 해제 후 실제 카운트');
      assert.equal(counts.reviewing, 1);
    });
  });

  describe('다중 이슈 + 복합 시나리오', () => {
    test('여러 이슈를 연속으로 상태 변경', () => {
      const rt = createRuntime(['a1', 'a2', 'a3', 'a4']);
      rt.clickFilter('pending');

      rt.clickStatus('a1', 'reviewing');
      rt.clickStatus('a2', 'resolved');
      rt.clickStatus('a3', 'dismissed');

      assert.ok(isVisible(rt, 'a1') && hasGraceClass(rt, 'a1'));
      assert.ok(isVisible(rt, 'a2') && hasGraceClass(rt, 'a2'));
      assert.ok(isVisible(rt, 'a3') && hasGraceClass(rt, 'a3'));
      assert.ok(isVisible(rt, 'a4') && !hasGraceClass(rt, 'a4'), 'a4는 변경 없이 정상 표시');

      assert.equal(rt.changedInFilter.size, 3);
    });

    test('grace 이슈의 메모 수정 가능 (DOM 접근)', () => {
      const rt = createRuntime(['a1']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');

      // 이슈가 보이므로 메모를 남길 수 있음
      assert.ok(isVisible(rt, 'a1'));
      rt.setIssueState('a1', { memo: '중요한 메모' });
      assert.equal(rt.getIssueState('a1').memo, '중요한 메모');
    });

    test('has-memo 필터에서는 grace 동작 없음', () => {
      const rt = createRuntime(['a1']);
      rt.state['a1'].memo = '메모 있음';
      rt.clickFilter('has-memo');
      rt.clickStatus('a1', 'reviewing');

      assert.equal(rt.changedInFilter.size, 0, 'has-memo 필터에서 grace 추적 안 함');
    });

    test('sibling 요소에도 grace 클래스와 display 적용', () => {
      const rt = createRuntime(['a1']);
      rt.clickFilter('pending');
      rt.clickStatus('a1', 'reviewing');

      const h3 = rt.document.getElementById('a1')!;
      const ctrl = h3.nextElementSibling as HTMLElement;
      const body = ctrl.nextElementSibling as HTMLElement;

      assert.ok(ctrl.classList.contains('status-changed-grace'), 'controls div에 grace 클래스');
      assert.ok(body.classList.contains('status-changed-grace'), 'body p에 grace 클래스');
      assert.notEqual(ctrl.style.display, 'none', 'controls div 표시');
      assert.notEqual(body.style.display, 'none', 'body p 표시');
    });
  });
});
