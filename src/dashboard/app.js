// ========== API Client ==========
let workspaceSessionId = localStorage.getItem('codeforge.sessionId') || '';
let currentWorkflow = null;

function parseApiError(status, text) {
  try {
    const parsed = JSON.parse(text);
    const err = new Error(parsed.error || text || `HTTP ${status}`);
    err.recovery = parsed.recovery || '';
    err.code = parsed.code || '';
    return err;
  } catch {
    return new Error(text || `HTTP ${status}`);
  }
}

const API = {
  async request(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (workspaceSessionId) headers.set('x-codeforge-session', workspaceSessionId);
    const res = await fetch('/api' + path, { ...init, headers });
    if (!res.ok) throw parseApiError(res.status, await res.text());
    return res.json();
  },
  async get(path) {
    return API.request(path);
  },
  async post(path, body) {
    return API.request(path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  },
  async put(path, body) {
    return API.request(path, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  },
  async patch(path, body) {
    return API.request(path, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  },
};

// ========== Mermaid Init ==========
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false, theme: 'dark',
    themeVariables: {
      darkMode: true, background: '#161b22', primaryColor: '#1f6feb',
      primaryTextColor: '#e6edf3', primaryBorderColor: '#30363d',
      lineColor: '#8b949e', secondaryColor: '#21262d', tertiaryColor: '#161b22',
      noteTextColor: '#e6edf3', noteBkgColor: '#1c2129', noteBorderColor: '#30363d',
      actorTextColor: '#e6edf3', actorBkg: '#1c2129', actorBorder: '#30363d',
      signalColor: '#8b949e', signalTextColor: '#e6edf3',
      labelBoxBkgColor: '#1c2129', labelBoxBorderColor: '#30363d', labelTextColor: '#e6edf3',
      loopTextColor: '#8b949e', activationBorderColor: '#58a6ff', activationBkgColor: '#1c2129',
      sequenceNumberColor: '#e6edf3'
    },
    flowchart: { curve: 'basis', padding: 16 },
    sequence: { mirrorActors: false, bottomMarginAdj: 2 }
  });
}

// ========== Constants ==========
const STATUS_MAP = {
  pending:   { label: '미검토', cls: 'active-pending' },
  reviewing: { label: '검토중', cls: 'active-reviewing' },
  resolved:  { label: '확정',   cls: 'active-resolved' },
  deferred:  { label: '보류',   cls: 'active-deferred' },
  dismissed: { label: '삭제',   cls: 'active-dismissed' },
  candidate: { label: '후보',   cls: 'active-candidate' },
  promoted:  { label: '승격',   cls: 'active-promoted' },
  archived:  { label: '보관',   cls: 'active-archived' }
};
const STATUS_DOT_COLORS = {
  pending: 'transparent', reviewing: 'var(--orange)', resolved: 'var(--green)',
  deferred: 'var(--text-muted)', dismissed: 'var(--red)',
  candidate: 'var(--blue)', promoted: 'var(--green)', archived: 'var(--text-muted)'
};
const DEFAULT_STATUS_ENTRIES = Object.entries(STATUS_MAP).filter(([k]) => !['candidate', 'promoted', 'archived'].includes(k));
const FEATURES_STATUS_ENTRIES = Object.entries(STATUS_MAP).filter(([k]) => ['pending', 'candidate', 'promoted', 'archived', 'dismissed'].includes(k));

const CAT_LABELS = {
  'A': '기획 정합성',
  'B': '수익/과금 모델',
  'C': '사용자 획득/유지',
  'D': '구현 가능성',
  'E': '운영 확장성',
  'F': '법적/규제 리스크',
  'FT-MKT': '마케팅',
  'FT-OPS': '운영',
  'FT-SVC': '서비스 기획',
  'FT-TECH': '기술',
  'FT-DEF': '기획 리뷰 보류',
  'BE-API': 'API 설계',
  'BE-DB': 'DB 스키마',
  'BE-INFRA': '인프라',
  'BE-LIB': '라이브러리',
  'BE-SVC': '서비스 레이어',
  'FE-COMP': '화면/컴포넌트',
  'FE-STATE': '상태 관리',
  'FE-ROUTE': '라우팅',
  'FE-API': 'API 연동',
  'FE-TOKEN': '디자인 시스템',
  'BE-MVP': 'MVP 단순화',
  'BE-EXT': '외부 서비스 대체',
  'BE-OPS': '운영/장애',
  'BE-REPL': '교체 용이',
  'FE-FVX': '첫 가치 경험',
  'FE-EMPTY': '빈/에러 상태',
  'FE-ACTION': '핵심 액션',
  'FE-MOBILE': '모바일 우선',
  'FE-EFFORT': '공수 vs UX',
  'FT-DEL': '삭제/축소',
  'FT-EXP': '실험 가능성',
  'FT-MONEY': '수익화',
  'FT-LEARN': '데이터 학습',
  'FT-EFFORT': '공수 vs 효과',
};

const TAB_ID_PATTERNS = {
  review:   /^[a-z][-a-z0-9]*\d+$/,
  features: /^[a-z][-a-z0-9]*\d+$/,
  backend:  /^[a-z][-a-z0-9]*\d+$/,
  frontend: /^[a-z][-a-z0-9]*\d+$/,
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function appAlert(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML = `
      <div class="app-dialog">
        <p class="app-dialog-message">${escapeHtml(message)}</p>
        <div class="app-dialog-actions">
          <button class="app-dialog-btn app-dialog-btn-primary">확인</button>
        </div>
      </div>`;
    overlay.querySelector('.app-dialog-btn-primary').addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
    document.body.appendChild(overlay);
  });
}

function appConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'app-dialog-overlay';
    overlay.innerHTML = `
      <div class="app-dialog">
        <p class="app-dialog-message">${escapeHtml(message)}</p>
        <div class="app-dialog-actions">
          <button class="app-dialog-btn app-dialog-btn-secondary">취소</button>
          <button class="app-dialog-btn app-dialog-btn-primary">확인</button>
        </div>
      </div>`;
    overlay.querySelector('.app-dialog-btn-secondary').addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.querySelector('.app-dialog-btn-primary').addEventListener('click', () => { overlay.remove(); resolve(true); });
    document.body.appendChild(overlay);
  });
}

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

// ========== State ==========
let state = {};
let activeTab = 'review';
let currentFilter = 'all';
let currentTabHasDrafts = false;
let changedInFilter = new Set();

function clearGrace() {
  changedInFilter.forEach(id => {
    const h3 = document.getElementById(id);
    if (h3) h3.querySelector('.status-transition-badge')?.remove();
  });
  changedInFilter.clear();
}

function setSessionId(sessionId) {
  workspaceSessionId = sessionId || '';
  if (workspaceSessionId) localStorage.setItem('codeforge.sessionId', workspaceSessionId);
  else localStorage.removeItem('codeforge.sessionId');
}

function showRecovery(error) {
  const panel = document.getElementById('recovery-panel');
  if (!panel) return;
  if (!error) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }
  panel.innerHTML = `<div class="recovery-title">실패 원인</div>
    <div class="recovery-body">${escapeHtml(error.message || '알 수 없는 오류')}</div>
    ${error.recovery ? `<div class="recovery-hint">${escapeHtml(error.recovery)}</div>` : ''}`;
  panel.classList.remove('hidden');
}

function renderWorkflowSummary(workflow) {
  currentWorkflow = workflow || null;
  const el = document.getElementById('workflow-summary');
  if (!el) return;
  if (!workflow) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  const docs = workflow.documents || [];
  const latestDoc = docs[0];
  const running = workflow.runningJobs || [];
  const stageLabelMap = { init: '초기화', prd_ready: 'PRD 준비', review: '리뷰', backend: '백엔드', frontend: '프론트엔드', features: '다음버전' };
  const dirty = workflow.dirtyCountByTab || {};
  const analyzeAt = workflow.lastAnalyzeAtByTab || {};
  const generateAt = workflow.lastGeneratedDocAtByTab || {};

  const TABS = ['review', 'backend', 'frontend', 'features'];
  const TAB_LABELS = { review: 'Review', backend: 'BE', frontend: 'FE', features: 'Feat' };
  const dirtyBadges = TABS.map(tab => {
    const count = dirty[tab] || 0;
    const badge = count > 0 ? `<span class="dirty-count-highlight">${count}</span>` : `<span class="dirty-count-zero">0</span>`;
    return `${TAB_LABELS[tab]}: ${badge}`;
  }).join(' / ');

  const analyzeInfo = TABS.map(tab => {
    const at = timeAgo(analyzeAt[tab]);
    return at ? `${TAB_LABELS[tab]}: ${escapeHtml(at)}` : null;
  }).filter(Boolean).join(', ') || '없음';

  const generateInfo = TABS.map(tab => {
    const at = timeAgo(generateAt[tab]);
    return at ? `${TAB_LABELS[tab]}: ${escapeHtml(at)}` : null;
  }).filter(Boolean).join(', ') || '없음';

  el.innerHTML = [
    `<div class="workflow-card"><div class="label">현재 단계</div><div class="value">${escapeHtml(stageLabelMap[workflow.stage] || workflow.stage)}</div><div class="sub">리뷰 ${workflow.counts?.review || 0} / BE ${workflow.counts?.backend || 0} / FE ${workflow.counts?.frontend || 0}</div></div>`,
    `<div class="workflow-card"><div class="label">실행 중인 작업</div><div class="value">${running.length}</div><div class="sub">${running[0] ? escapeHtml(`${running[0].type}${running[0].tab ? ` (${running[0].tab})` : ''}`) : '현재 실행 중인 작업 없음'}</div></div>`,
    `<div class="workflow-card"><div class="label">최신 문서</div><div class="value">${latestDoc ? escapeHtml(`${latestDoc.tab} v${latestDoc.version}`) : '없음'}</div><div class="sub">${latestDoc ? escapeHtml(latestDoc.file_path.split('/').pop()) : '생성된 문서 없음'}</div></div>`,
    `<div class="workflow-card"><div class="label">변경 이슈</div><div class="value workflow-value-sm">${dirtyBadges}</div><div class="sub">마지막 반영 이후 변경된 이슈</div></div>`,
    `<div class="workflow-card"><div class="label">마지막 분석</div><div class="value workflow-value-xs">${analyzeInfo}</div><div class="sub">최신 문서: ${generateInfo}</div></div>`,
  ].join('');
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('animate'));
  setTimeout(() => el.classList.remove('animate'), 1500);
}

function applyStatusDot(dot, status) {
  dot.dataset.status = status;
}

function getIssueIds() {
  const pattern = TAB_ID_PATTERNS[activeTab];
  return Array.from(document.querySelectorAll(`#panel-${activeTab} h3[id]`))
    .map(el => el.id)
    .filter(id => pattern.test(id));
}

function getIssueState(id) { return state[id] || { status: 'pending', memo: '', serverStatus: 'pending' }; }

async function setIssueState(id, patch) {
  state[id] = { ...getIssueState(id), ...patch };
  // Optimistic update: 상태가 pending/reviewing에서 벗어나면 추천 카드에서 즉시 제거
  if (patch.status && patch.status !== 'pending' && patch.status !== 'reviewing') {
    optimisticRemoveFromRec(id);
  }
  if (patch.status) scheduleRecRefresh();
  try {
    await API.put('/issues/' + id, { status: state[id].status, memo: state[id].memo });
  } catch (e) {
    console.error('Failed to save issue state:', e);
  }
  refreshUI();
}

// ========== Recommendation Card ==========
let _recDebounceTimer = null;

async function loadRecommendations(tab) {
  try {
    const data = await API.get('/issues/recommendations?tab=' + tab);
    renderRecommendationCard(tab, data);
  } catch (e) {
    // 추천 카드 실패는 무시 (메인 기능 아님)
  }
}

function renderRecommendationCard(tab, data) {
  const panel = document.getElementById(`panel-${tab}`);
  if (!panel) return;

  const { now = [], defer = [], judge = [] } = data;
  const total = now.length + defer.length + judge.length;

  let card = document.getElementById(`rec-card-${tab}`);
  if (!card) {
    card = document.createElement('div');
    card.className = 'recommendation-card';
    card.id = `rec-card-${tab}`;
    panel.insertBefore(card, panel.firstChild);
  }

  if (total === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';

  function recItems(items) {
    if (!items.length) return `<div class="rec-empty">없음</div>`;
    return items.map(item => `
      <div class="rec-item" data-issue-id="${escapeHtml(item.id)}" onclick="scrollToIssue('${escapeHtml(item.id)}')">
        <span class="rec-item-id">${escapeHtml(item.id.toUpperCase())}</span>
        <div>
          <div class="rec-item-title">${escapeHtml(item.title)}</div>
          <div class="rec-item-reason">${escapeHtml(item.reason)}</div>
        </div>
      </div>`).join('');
  }

  card.innerHTML = `
    <div class="rec-header">지금 할 일 추천</div>
    <div class="rec-buckets">
      <div class="rec-bucket rec-bucket-now">
        <div class="rec-bucket-title">지금 반영 (${now.length})</div>
        ${recItems(now)}
      </div>
      <div class="rec-bucket rec-bucket-judge">
        <div class="rec-bucket-title">판단 필요 (${judge.length})</div>
        ${recItems(judge)}
      </div>
      <div class="rec-bucket rec-bucket-defer">
        <div class="rec-bucket-title">나중에 (${defer.length})</div>
        ${recItems(defer)}
      </div>
    </div>`;
}

function scrollToIssue(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function optimisticRemoveFromRec(id) {
  // 상태 변경된 이슈를 추천 카드에서 즉시 제거
  const card = document.getElementById(`rec-card-${activeTab}`);
  if (!card) return;
  card.querySelectorAll('.rec-item').forEach(item => {
    if (item.dataset.issueId === id) item.remove();
  });
  // 버킷이 비었으면 empty 표시
  card.querySelectorAll('.rec-bucket').forEach(bucket => {
    if (!bucket.querySelector('.rec-item')) {
      if (!bucket.querySelector('.rec-empty')) {
        const empty = document.createElement('div');
        empty.className = 'rec-empty';
        empty.textContent = '없음';
        bucket.appendChild(empty);
      }
    }
  });
  // 모든 버킷이 비었으면 카드 숨김
  const allEmpty = !card.querySelector('.rec-item');
  if (allEmpty) card.style.display = 'none';
}

function scheduleRecRefresh() {
  clearTimeout(_recDebounceTimer);
  _recDebounceTimer = setTimeout(() => loadRecommendations(activeTab), 500);
}

// ========== Tab System ==========
function switchTab(tabId) {
  // init/preview 화면이 보이면 탭 컨텐츠로 복귀
  document.getElementById('init-screen')?.classList.add('hidden');
  document.getElementById('prd-preview')?.classList.add('hidden');
  document.getElementById('codebase-scan-preview')?.classList.add('hidden');
  document.querySelector('.tab-content')?.classList.remove('hidden');

  // ARIA: 탭 선택 상태 갱신
  document.querySelectorAll('.tab-btn').forEach(b => {
    const selected = b.dataset.tab === tabId;
    b.classList.toggle('active', selected);
    b.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));

  if (tabId === 'timeline' || tabId === 'docs') {
    activeTab = tabId;
    document.querySelector('.filter-bar')?.classList.add('hidden');
    document.getElementById('fab-container')?.classList.add('hidden');
    if (tabId === 'timeline') loadTimelineView();
    else loadDocsView();
    setupScrollAnimations();
    return;
  }

  // 특수 탭에서 일반 탭으로 돌아올 때
  document.querySelector('.filter-bar')?.classList.remove('hidden');
  document.getElementById('fab-container')?.classList.remove('hidden');

  activeTab = tabId;
  clearGrace();
  buildStatusSidebar();
  if (typeof mermaid !== 'undefined') {
    try { mermaid.run({ querySelector: `#panel-${tabId} pre.mermaid:not([data-processed])` }); } catch (e) { /* ignore */ }
  }
  applyFilter();
  updateCounts();
  loadIssues(tabId);
  loadPerspectivesPanel(tabId);
  setupScrollAnimations();
}

// ========== Issue Controls Injection ==========
function injectIssueControls(tab = activeTab) {
  const pattern = TAB_ID_PATTERNS[tab];
  if (!pattern) return;
  document.querySelectorAll(`#panel-${tab} h3[id]`).forEach(h3 => {
      const id = h3.id;
      if (!pattern.test(id)) return;
      if (document.querySelector(`.issue-controls[data-issue-id="${id}"]`)) return;

      const ctrl = document.createElement('div');
      ctrl.className = 'issue-controls';
      ctrl.dataset.issueId = id;

      const btnGroup = document.createElement('div');
      btnGroup.className = 'issue-btn-group';
      const filteredEntries = tab === 'features'
        ? FEATURES_STATUS_ENTRIES
        : DEFAULT_STATUS_ENTRIES;
      filteredEntries.forEach(([key, {label}]) => {
        const btn = document.createElement('button');
        btn.className = 'status-btn';
        btn.textContent = label;
        btn.dataset.status = key;
        btn.addEventListener('click', () => {
          if (currentFilter !== 'all' && currentFilter !== 'has-memo') {
            if (key !== currentFilter) changedInFilter.add(id);
            else changedInFilter.delete(id);
          }
          setIssueState(id, { status: key });
          renderControls(id);
          applyFilter();
        });
        btnGroup.appendChild(btn);
      });
      const snapshotBtn = document.createElement('button');
      snapshotBtn.className = 'snapshot-history-btn';
      snapshotBtn.title = '분석 히스토리';
      snapshotBtn.textContent = '히스토리';
      snapshotBtn.addEventListener('click', () => openSnapshotModal(id));
      btnGroup.appendChild(snapshotBtn);

      ctrl.appendChild(btnGroup);

      const memoLabel = document.createElement('div');
      memoLabel.className = 'memo-label';
      memoLabel.textContent = '메모';
      ctrl.appendChild(memoLabel);

      const memo = document.createElement('textarea');
      memo.className = 'issue-memo';
      memo.placeholder = '검토 메모를 남기세요...';
      memo.value = getIssueState(id).memo;
      let debounce;
      memo.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { setIssueState(id, { memo: memo.value }); }, 300);
      });
      ctrl.appendChild(memo);

      const logDiv = document.createElement('div');
      logDiv.className = 'decision-log';
      logDiv.dataset.issueId = id;
      logDiv.style.display = 'none';
      ctrl.appendChild(logDiv);

      let lastEl = h3.nextElementSibling;
      while (lastEl && lastEl.nextElementSibling &&
        lastEl.nextElementSibling.tagName !== 'H3' &&
        lastEl.nextElementSibling.tagName !== 'H2' &&
        !lastEl.nextElementSibling.classList.contains('section-break')) {
        lastEl = lastEl.nextElementSibling;
      }
      if (lastEl && lastEl.nextElementSibling) lastEl.parentNode.insertBefore(ctrl, lastEl.nextElementSibling);
      else if (lastEl) lastEl.parentNode.appendChild(ctrl);
      else h3.parentNode.insertBefore(ctrl, h3.nextElementSibling);

      renderControls(id);
  });
}

function renderControls(id) {
  const s = getIssueState(id);
  const ctrl = document.querySelector(`.issue-controls[data-issue-id="${id}"]`);
  if (!ctrl) return;
  ctrl.querySelectorAll('.status-btn').forEach(btn => {
    btn.className = 'status-btn';
    if (btn.dataset.status === s.status) btn.classList.add(STATUS_MAP[s.status].cls);
  });
  const h3 = document.getElementById(id);
  if (h3) {
    h3.classList.remove('issue-resolved', 'issue-deferred', 'issue-dismissed');
    const cls = { resolved: 'issue-resolved', deferred: 'issue-deferred', dismissed: 'issue-dismissed' }[s.status];
    if (cls) h3.classList.add(cls);

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

// ========== Sidebar Status Dots ==========
function updateSidebarDots() {
  document.querySelectorAll('.sidebar a[href^="#"]').forEach(a => {
    const id = a.getAttribute('href').slice(1);
    const s = getIssueState(id);
    let dot = a.querySelector('.status-dot');
    const pattern = TAB_ID_PATTERNS[activeTab];
    if (!pattern || !pattern.test(id)) { if (dot) dot.remove(); return; }
    if (!dot) { dot = document.createElement('span'); dot.className = 'status-dot'; a.insertBefore(dot, a.firstChild); }
    applyStatusDot(dot, s.status);
  });
}

// ========== Status Sidebar ==========
const STATUS_SIDEBAR_CONFIG = [
  { status: 'pending',   label: '미검토',  color: 'var(--text-muted)' },
  { status: 'reviewing', label: '검토중',  color: 'var(--orange)' },
  { status: 'resolved',  label: '확정',    color: 'var(--green)' },
  { status: 'deferred',  label: '보류',    color: 'var(--text-muted)' },
  { status: 'dismissed', label: '삭제',    color: 'var(--red)' }
];

function buildStatusSidebar() {
  const container = document.getElementById('statusSidebar');
  if (!container) return;
  const ids = getIssueIds();

  const groups = {};
  STATUS_SIDEBAR_CONFIG.forEach(c => { groups[c.status] = {}; });
  ids.forEach(id => {
    const s = getIssueState(id);
    const status = groups[s.status] !== undefined ? s.status : 'pending';
    const cat = id.replace(/\d+$/, '').toUpperCase().replace(/-$/, '');
    if (!groups[status][cat]) groups[status][cat] = [];
    groups[status][cat].push(id);
  });

  container.innerHTML = '';
  STATUS_SIDEBAR_CONFIG.forEach(({ status, label, color }) => {
    const catGroups = groups[status];
    const totalCount = Object.values(catGroups).reduce((sum, arr) => sum + arr.length, 0);
    const isCollapsed = status === 'dismissed' || status === 'pending';

    const group = document.createElement('div');
    group.className = 'nav-group';

    const toggle = document.createElement('div');
    toggle.className = 'nav-group-toggle' + (isCollapsed ? ' collapsed' : '');
    toggle.innerHTML = `<span class="nav-toggle-label"><span class="nav-toggle-dot" data-status="${status}"></span>${label} <span class="toggle-count">${totalCount}</span></span><span class="toggle-arrow">▾</span>`;

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'nav-group-items' + (isCollapsed ? ' collapsed' : '');

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('collapsed');
      itemsDiv.classList.toggle('collapsed');
    });

    Object.entries(catGroups).sort().forEach(([cat, catIds]) => {
      if (catIds.length === 0) return;

      const catHeader = document.createElement('div');
      catHeader.className = 'nav-cat-header';
      const catLabel = CAT_LABELS[cat];
      catHeader.textContent = catLabel ? `${cat}. ${catLabel} (${catIds.length})` : `${cat} (${catIds.length})`;
      itemsDiv.appendChild(catHeader);

      catIds.forEach(id => {
        const h3 = document.getElementById(id);
        const fullTitle = h3 ? h3.textContent.trim() : id;
        const a = document.createElement('a');
        a.href = '#' + id;
        a.className = 'sidebar-issue-link';

        const dot = document.createElement('span');
        dot.className = 'status-dot';
        applyStatusDot(dot, status);

        const idSpan = document.createElement('span');
        idSpan.className = 'sidebar-issue-id';
        idSpan.textContent = id.toUpperCase() + '. ';

        const titleSpan = document.createElement('span');
        const titleOnly = fullTitle.replace(/^[A-Za-z0-9-]+\.\s*/, '');
        titleSpan.textContent = titleOnly.length > 22 ? titleOnly.slice(0, 22) + '...' : titleOnly;

        a.appendChild(dot);
        a.appendChild(idSpan);
        a.appendChild(titleSpan);
        itemsDiv.appendChild(a);
      });
    });

    group.appendChild(toggle);
    group.appendChild(itemsDiv);
    container.appendChild(group);
  });
}

// ========== Filter ==========
document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    clearGrace();
    document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('filter-active'));
    btn.classList.add('filter-active');
    applyFilter();
  });
});

function applyFilter() {
  const pattern = TAB_ID_PATTERNS[activeTab];
  document.querySelectorAll(`#panel-${activeTab} h3[id]`).forEach(h3 => {
    const id = h3.id;
    if (!pattern.test(id)) return;
    const s = getIssueState(id);
    let show = true;
    if (currentFilter === 'has-memo') show = s.memo.trim().length > 0;
    else if (currentFilter !== 'all') show = s.status === currentFilter;

    const inGrace = changedInFilter.has(id);
    if (inGrace) show = true;

    let el = h3;
    while (el) {
      el.style.display = show ? '' : 'none';
      el.classList.toggle('status-changed-grace', inGrace);
      el = el.nextElementSibling;
      if (!el || el.tagName === 'H3' || el.tagName === 'H2') break;
    }
  });
}

function updateCounts() {
  const ids = getIssueIds();
  const counts = { all: ids.length, pending: 0, reviewing: 0, resolved: 0, deferred: 0, dismissed: 0, 'has-memo': 0 };
  ids.forEach(id => {
    const s = getIssueState(id);
    counts[s.status] = (counts[s.status] || 0) + 1;
    if (s.memo.trim()) counts['has-memo']++;
  });
  // grace 이슈는 현재 필터에 계속 표시되므로 카운트에 포함
  if (currentFilter !== 'all' && currentFilter !== 'has-memo' && changedInFilter.size > 0) {
    changedInFilter.forEach(id => {
      const s = getIssueState(id);
      if (s.status !== currentFilter) counts[currentFilter]++;
    });
  }
  Object.entries(counts).forEach(([k, v]) => {
    const el = document.getElementById(`count-${k}`);
    if (el) el.textContent = v;
  });
}

// ========== Button State Management ==========
function setButtonEnabled(id, enabled, disabledTitle) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (enabled) {
    btn.removeAttribute('disabled');
    btn.title = '';
  } else {
    btn.setAttribute('disabled', '');
    btn.title = disabledTitle;
  }
}

function updateActionButtonStates() {
  const issues = collectCurrentTabState();
  const anyMemo = issues.some(i => (i.memo || '').trim() !== '');
  const anyStatusChanged = issues.some(i => i.status !== i.serverStatus);
  // 서버가 알려준 draft 여부 + client-side 계산 모두 고려
  const hasPendingChanges = currentTabHasDrafts || anyMemo || anyStatusChanged;

  setButtonEnabled('btn-apply',    hasPendingChanges,   '변경사항 메모를 작성해주세요');
  setButtonEnabled('btn-generate', !hasPendingChanges,  '반영하기를 먼저 눌러 변경사항을 반영하세요');

  const tabVersions = currentWorkflow?.tabVersions || {};
  const latestDoc = (currentWorkflow?.documents || []).find(d => d.tab === activeTab);
  const upToDate = latestDoc && latestDoc.version === tabVersions[activeTab];
  setButtonEnabled('btn-analyze', !hasPendingChanges && !upToDate, hasPendingChanges ? '반영하기를 먼저 눌러 변경사항을 반영하세요' : '변경사항을 검토후 반영하여 새버전을 반영하세요');
}

async function updateCycleIndicator(tab) {
  const el = document.getElementById('cycle-indicator');
  if (!el) return;
  try {
    const data = await API.get(`/issues/cycle?tab=${tab}`);
    if (data && data.cycle != null) {
      el.textContent = `Cycle #${data.cycle.cycle_number}`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  } catch {
    el.classList.add('hidden');
  }
}

function refreshUI() {
  updateCounts();
  updateSidebarDots();
  buildStatusSidebar();
  updateActionButtonStates();
}

function showIssueSkeleton(tab) {
  const panel = document.getElementById(`panel-${tab}`);
  if (!panel) return;
  let contentArea = panel.querySelector('.issue-content');
  if (!contentArea) {
    contentArea = document.createElement('div');
    contentArea.className = 'issue-content';
    panel.appendChild(contentArea);
  }
  contentArea.innerHTML = Array.from({ length: 3 }, () =>
    `<div class="skeleton-issue">
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line skeleton-meta"></div>
      <div class="skeleton-line skeleton-body"></div>
      <div class="skeleton-line skeleton-body-short"></div>
    </div>`
  ).join('');
}

// ========== Issue Loading ==========
async function loadIssues(tab) {
  currentTabHasDrafts = false; // 로딩 시작 시 초기화 (서버 응답에서 갱신됨)
  showIssueSkeleton(tab);
  try {
    const data = await API.get('/issues?tab=' + tab);
    const issues = data.issues || [];

    const panel = document.getElementById(`panel-${tab}`);
    if (!panel) return;

    // has_pending_drafts 플래그를 탭 상태로 저장
    currentTabHasDrafts = data.has_pending_drafts ?? false;

    // Sync local state from server (status + memo)
    issues.forEach(issue => {
      const lastAppliedStatus = issue.logs?.at(-1)?.status ?? 'pending';
      state[issue.id] = {
        status: issue.draft_status ?? issue.status ?? 'pending',
        memo: issue.draft_memo ?? issue.memo ?? '',
        serverStatus: lastAppliedStatus,
        hasDraft: !!issue.draft_status,
      };
    });

    // Get or create issue-content area (preserves filter-bar / action-bar siblings)
    let contentArea = panel.querySelector('.issue-content');
    if (!contentArea) {
      contentArea = document.createElement('div');
      contentArea.className = 'issue-content';
      panel.appendChild(contentArea);
    }

    if (issues.length === 0) {
      contentArea.innerHTML = '<p class="issue-empty-state">분석 결과가 없습니다. "분석하기" 버튼을 클릭하세요.</p>';
    } else {
      contentArea.innerHTML = issues.map(issue => {
        const tagHtml = issue.tag ? `<span class="tag tag-${escapeHtml(issue.tag)}">${escapeHtml(issue.tag)}</span> ` : '';
        const priorityHtml = issue.priority ? `<span class="tag">${escapeHtml(issue.priority)}</span>` : '';
        return `<h3 id="${escapeHtml(issue.id)}">${escapeHtml(issue.id.toUpperCase())}. ${escapeHtml(issue.title)}</h3>` +
          `<div class="issue-meta">${tagHtml}${priorityHtml}</div>` +
          `<div class="issue-body">${issue.html_content}</div>`;
      }).join('\n');

      injectIssueControls();

      // 이슈별 변경 로그 렌더링
      issues.forEach(issue => {
        if (!issue.logs?.length) return;
        const logEl = document.querySelector(`.decision-log[data-issue-id="${issue.id}"]`);
        if (!logEl) return;
        logEl.innerHTML = '<div class="decision-log-title">변경 로그</div>' +
          issue.logs.map(log =>
            `<div class="decision-entry">` +
            `<span class="decision-date">${log.date}</span>` +
            `<span class="decision-status decision-status-${log.status}">${STATUS_MAP[log.status]?.label || log.status}</span>` +
            (log.memo ? `<span class="decision-memo">${escapeHtml(log.memo)}</span>` : '') +
            `</div>`
          ).join('');
        logEl.style.display = '';
      });

      // Register new h3s with intersection observer
      contentArea.querySelectorAll('h3[id]').forEach(el => obs.observe(el));
    }

    // Enable history button unconditionally; conditional buttons handled by updateActionButtonStates
    document.getElementById('btn-history')?.removeAttribute('disabled');

    refreshUI();
    loadRecommendations(tab);
    updateCycleIndicator(tab);
  } catch (e) {
    showRecovery(e);
    console.error('Failed to load issues:', e);
  }
}

// ========== Collect current tab issue states ==========
function collectCurrentTabState() {
  return getIssueIds().map(id => {
    const s = getIssueState(id);
    return { id, status: s.status, memo: s.memo, serverStatus: s.serverStatus };
  });
}

// ========== Toast ==========
const _toast = document.createElement('div');
_toast.id = 'app-toast';
document.body.appendChild(_toast);
let toastTimer;
function showToast(msg, type) {
  clearTimeout(toastTimer);
  _toast.textContent = msg;
  _toast.className = type === 'error' ? 'error' : '';
  _toast.classList.add('visible');
  toastTimer = setTimeout(() => { _toast.classList.remove('visible'); }, 2500);
}

// ========== Init Screen Events ==========
document.getElementById('btn-generate-prd')?.addEventListener('click', async () => {
  const detail = document.getElementById('init-detail').value.trim();
  if (!detail) {
    document.getElementById('init-detail').classList.add('error');
    document.getElementById('init-detail-error').style.display = 'block';
    return;
  }
  const data = {
    projectName: document.getElementById('init-project-name').value,
    tagline: document.getElementById('init-tagline').value,
    serviceType: document.querySelector('input[name="service-type"]:checked')?.value || '',
    dataStorage: document.querySelector('input[name="data-storage"]:checked')?.value || '',
    needAccount: document.querySelector('input[name="need-account"]:checked')?.value || '',
    multiUser: document.querySelector('input[name="multi-user"]:checked')?.value || '',
    usageEnvironment: [...document.querySelectorAll('input[name="usage-env"]:checked')].map(el => el.value),
    needNotification: document.querySelector('input[name="need-notification"]:checked')?.value || '',
    hasPayment: document.querySelector('input[name="has-payment"]:checked')?.value || '',
    targets: [...document.querySelectorAll('input[name="target"]:checked')].map(el => el.value),
    revenues: [...document.querySelectorAll('input[name="revenue"]:checked')].map(el => el.value),
    features: [...document.querySelectorAll('input[name="feature"]:checked')].map(el => el.value),
    feTech: [...document.querySelectorAll('input[name="fe-tech"]:checked')].map(el => el.value),
    beTech: [...document.querySelectorAll('input[name="be-tech"]:checked')].map(el => el.value),
    storageTech: [...document.querySelectorAll('input[name="storage-tech"]:checked')].map(el => el.value),
    detail,
  };
  const btn = document.getElementById('btn-generate-prd');
  btn.disabled = true;
  btn.textContent = 'PRD 생성 중...';
  showJobStream('PRD 생성 중...');
  try {
    const { jobId } = await API.post('/init', data);
    pollJob(jobId, async (err) => {
      btn.disabled = false;
      btn.textContent = 'PRD 생성하기';
      if (err) { showRecovery(err); showToast('PRD 생성 실패: ' + err.message, 'error'); return; }
      try {
        const prdData = await API.get('/init/prd');
        document.getElementById('prd-content').textContent = prdData.content || '';
        document.getElementById('init-screen').classList.add('hidden');
        document.getElementById('prd-preview').classList.remove('hidden');
        try { renderWorkflowSummary((await API.get('/workspace')).workflow); } catch { /* ignore */ }
      } catch (e2) {
        showRecovery(e2);
        showToast('PRD 로드 실패: ' + e2.message, 'error');
      }
    });
  } catch (e) {
    showRecovery(e);
    showToast('PRD 생성에 실패했습니다: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'PRD 생성하기';
  }
});

document.getElementById('init-detail')?.addEventListener('input', () => {
  document.getElementById('init-detail').classList.remove('error');
  document.getElementById('init-detail-error').style.display = 'none';
});

document.getElementById('btn-import-prd')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = '파일 선택 중...';
  try {
    const res = await API.post('/init/import-file', {});
    if (res.cancelled) return;
    document.getElementById('prd-content').textContent = res.content || '';
    document.getElementById('init-screen').classList.add('hidden');
    document.getElementById('prd-preview').classList.remove('hidden');
    try { renderWorkflowSummary((await API.get('/workspace')).workflow); } catch { /* ignore */ }
    showToast(`"${res.originalName}" 파일을 불러왔습니다.`, 'success');
  } catch (err) {
    showRecovery(err);
    showToast('파일 불러오기 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '기획서 파일 불러오기 (.md / .txt)...';
  }
});

// ========== Codebase Scan Handlers ==========
document.getElementById('btn-scan-codebase')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-scan-codebase');
  btn.disabled = true;
  btn.textContent = '코드 분석 중...';
  try {
    const summary = await API.post('/init/scan-codebase', {});

    // 메타 정보
    const metaEl = document.getElementById('scan-meta');
    metaEl.innerHTML = `
      <span class="scan-meta-item"><strong>${escapeHtml(summary.projectName)}</strong></span>
      <span class="scan-meta-sep">·</span>
      <span class="scan-meta-item">${escapeHtml(summary.detectedType)}</span>
      <span class="scan-meta-sep">·</span>
      <span class="scan-meta-item">~${summary.stats.estimatedLoc.toLocaleString()} 줄</span>
      <span class="scan-meta-sep">·</span>
      <span class="scan-meta-item">${Object.entries(summary.stats.filesByExt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([ext,n])=>`${ext}(${n})`).join(', ')}</span>
    `;

    // 디렉토리 트리
    document.getElementById('scan-tree').textContent = summary.directoryTree || '(없음)';

    // README
    document.getElementById('scan-readme').textContent = summary.readmeContent || '(README 없음)';

    // 설정 파일들
    const configsEl = document.getElementById('scan-configs');
    if (summary.configFiles && summary.configFiles.length > 0) {
      configsEl.innerHTML = summary.configFiles.map(f =>
        `<details><summary class="scan-file-name">${escapeHtml(f.name)}</summary><pre class="scan-pre">${escapeHtml(f.content)}</pre></details>`
      ).join('');
    } else {
      configsEl.textContent = '(설정 파일 없음)';
    }

    // 엔트리포인트
    const epEl = document.getElementById('scan-entrypoints');
    if (summary.entryPoints && summary.entryPoints.length > 0) {
      epEl.innerHTML = summary.entryPoints.map(ep =>
        `<details><summary class="scan-file-name">${escapeHtml(ep.path)}</summary><pre class="scan-pre">${escapeHtml(ep.preview)}</pre></details>`
      ).join('');
    } else {
      epEl.textContent = '(엔트리포인트 없음)';
    }

    // 환경 변수
    document.getElementById('scan-env').textContent = summary.envExample || '(.env.example 없음)';

    // 패널 전환
    document.getElementById('init-screen').classList.add('hidden');
    document.getElementById('codebase-scan-preview').classList.remove('hidden');
    showRecovery(null);
  } catch (e) {
    showRecovery(e);
    showToast('코드 분석 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '코드베이스에서 PRD 생성...';
  }
});

document.getElementById('btn-confirm-scan')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm-scan');
  const statusEl = document.getElementById('scan-job-status');
  btn.disabled = true;
  btn.textContent = 'PRD 생성 중...';
  statusEl.textContent = 'AI가 코드베이스를 분석하여 PRD를 작성 중입니다...';
  statusEl.classList.remove('hidden');
  showJobStream('코드베이스 PRD 생성 중...');
  try {
    const userNotes = document.getElementById('scan-user-notes').value;
    const { jobId } = await API.post('/init/from-codebase', { userNotes });
    pollJob(jobId, async (err) => {
      btn.disabled = false;
      btn.textContent = 'PRD 생성하기 →';
      statusEl.classList.add('hidden');
      if (err) {
        showRecovery(err);
        showToast('PRD 생성 실패: ' + err.message, 'error');
        return;
      }
      try {
        const prdData = await API.get('/init/prd');
        document.getElementById('prd-content').textContent = prdData.content || '';
        document.getElementById('codebase-scan-preview').classList.add('hidden');
        document.getElementById('prd-preview').classList.remove('hidden');
        try { renderWorkflowSummary((await API.get('/workspace')).workflow); } catch { /* ignore */ }
        showToast('코드베이스 분석 완료! PRD가 생성되었습니다.', 'success');
      } catch (e2) {
        showRecovery(e2);
        showToast('PRD 로드 실패: ' + e2.message, 'error');
      }
    });
  } catch (e) {
    showRecovery(e);
    showToast('PRD 생성 실패: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'PRD 생성하기 →';
    statusEl.classList.add('hidden');
  }
});

document.getElementById('btn-cancel-scan')?.addEventListener('click', () => {
  document.getElementById('codebase-scan-preview').classList.add('hidden');
  document.getElementById('init-screen').classList.remove('hidden');
  document.getElementById('scan-user-notes').value = '';
});

document.getElementById('btn-start-review')?.addEventListener('click', async () => {
  document.getElementById('prd-preview').classList.add('hidden');
  document.querySelector('.tab-content')?.classList.remove('hidden');
  document.getElementById('btn-analyze')?.click();
});

// ========== Job Polling ==========
let _elapsedTimer = null;
let _dotsTimer = null;
let _dotsCount = 1;

function startDotsAnimation() {
  if (_dotsTimer) return;
  _dotsTimer = setInterval(() => {
    const els = document.querySelectorAll('.log-generating-dots');
    if (!els.length) { clearInterval(_dotsTimer); _dotsTimer = null; return; }
    _dotsCount = (_dotsCount % 3) + 1;
    els.forEach(el => { el.textContent = '.'.repeat(_dotsCount); });
  }, 400);
}

function stopDotsAnimation() {
  if (_dotsTimer) { clearInterval(_dotsTimer); _dotsTimer = null; }
  _dotsCount = 1;
}
let _currentJobInterval = null;
let _jobStreamPrevScreen = null;
let currentJobId = null;

// 로딩 화면 진입 전 현재 화면을 감지
function _detectActiveScreen() {
  const candidates = ['init-screen', 'codebase-scan-preview', 'prd-preview'];
  const found = candidates.find(id => !document.getElementById(id)?.classList.contains('hidden'));
  if (found) return found;
  if (!document.querySelector('.tab-content')?.classList.contains('hidden')) return 'tab-content';
  return null;
}

function showJobStream(label, startedAt = null) {
  // 현재 화면 기억 후 숨김
  _jobStreamPrevScreen = _detectActiveScreen();
  ['init-screen', 'codebase-scan-preview', 'prd-preview'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden')
  );
  document.querySelector('.tab-content')?.classList.add('hidden');

  // 로딩 화면 초기화 & 표시
  document.getElementById('job-stream-title').textContent = label;
  document.getElementById('job-stream-provider').textContent = '';
  document.getElementById('job-stream-output').textContent = '';
  document.getElementById('job-stream-tokens').textContent = '';
  document.getElementById('job-stream-screen').classList.remove('hidden');

  // 경과 시간 타이머 (startedAt 있으면 서버 기준, 없으면 지금부터)
  const startMs = startedAt ? new Date(startedAt).getTime() : Date.now();
  clearInterval(_elapsedTimer);
  _elapsedTimer = setInterval(() => {
    const s = Math.floor((Date.now() - startMs) / 1000);
    const el = document.getElementById('job-stream-elapsed');
    if (el) el.textContent = s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }, 1000);
}

function hideJobStream() {
  clearInterval(_elapsedTimer);
  _elapsedTimer = null;
  stopDotsAnimation();
  currentJobId = null;
  document.getElementById('job-stream-screen')?.classList.add('hidden');

  // 이전 화면 복원
  if (_jobStreamPrevScreen === 'tab-content') {
    document.querySelector('.tab-content')?.classList.remove('hidden');
  } else if (_jobStreamPrevScreen) {
    document.getElementById(_jobStreamPrevScreen)?.classList.remove('hidden');
  }
  _jobStreamPrevScreen = null;
}

// ========== Job Log Parsing ==========
const LOG_TAG_STATUS = { '[시작]': '시작', '[완료]': '완료' };
const LOG_TAG_TOOL   = '[도구]';
const LOG_PILL_COLORS = {
  '시작': 'log-pill--start',
  '완료': 'log-pill--done',
  '생성 중': 'log-pill--working',
  '응답 수신': 'log-pill--working',
};

function parseJobLogEntries(logText) {
  const entries = [];
  for (const line of logText.split('\n')) {
    const t = line.trim();
    if (!t) continue;

    if (t === '[생성 중...]') { entries.push({ type: 'status', label: '생성 중', text: '' }); continue; }
    if (t === '[응답 수신]') { entries.push({ type: 'status', label: '응답 수신', text: '' }); continue; }

    let matched = false;
    for (const [tag, label] of Object.entries(LOG_TAG_STATUS)) {
      if (t.startsWith(tag)) {
        entries.push({ type: 'status', label, text: t.slice(tag.length).trim() });
        matched = true; break;
      }
    }
    if (matched) continue;

    if (t.startsWith(LOG_TAG_TOOL)) { entries.push({ type: 'tool', text: t.slice(LOG_TAG_TOOL.length).trim() }); continue; }
    if (t.startsWith('[apply]') || t.startsWith('[generate]') || t.startsWith('[analyze]')) {
      entries.push({ type: 'info', text: t }); continue;
    }

    if (t.startsWith('→')) { entries.push({ type: 'tool-detail', text: t.slice(1).trim() }); continue; }

    entries.push({ type: 'text', text: t });
  }
  return entries;
}

function renderJobLogHtml(entries) {

  function renderJsonData(data) {
    // 이슈 배열 형태 렌더링
    const arr = Array.isArray(data) ? data : (data.issues || data.items || data.results || null);
    if (arr && arr.length && typeof arr[0] === 'object') {
      return arr.map(item => {
        const id = item.id ? `<span class="log-json-id">${escapeHtml(String(item.id))}</span>` : '';
        const title = item.title ? `<span class="log-json-title">${escapeHtml(String(item.title))}</span>` : '';
        const cat = item.category ? `<span class="log-json-tag">${escapeHtml(String(item.category))}</span>` : '';
        const desc = item.description ? `<div class="log-json-desc">${escapeHtml(String(item.description).slice(0, 120))}${item.description.length > 120 ? '…' : ''}</div>` : '';
        return `<div class="log-json-item">${cat}${id}${title}${desc}</div>`;
      }).join('');
    }
    // 단순 키-값 or 기타 구조 → 코드 블록
    return `<pre class="log-json-block">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  }

  return entries.map(e => {
    if (e.type === 'status') {
      const cls = LOG_PILL_COLORS[e.label] || 'log-pill--info';
      const text = e.text ? ` <span class="log-status-text">${escapeHtml(e.text)}</span>` : '';
      // "생성 중" 항목은 점 애니메이션을 위한 span 포함 (현재 dot 개수 유지)
      const labelHtml = e.label === '생성 중'
        ? `생성 중<span class="log-generating-dots">${'.'.repeat(_dotsCount)}</span>`
        : escapeHtml(e.label);
      return `<div class="log-entry log-status"><span class="log-pill ${cls}">${labelHtml}</span>${text}</div>`;
    }
    if (e.type === 'tool') {
      const colonIdx = e.text.indexOf(':');
      const name = colonIdx >= 0 ? e.text.slice(0, colonIdx).trim() : e.text;
      const input = colonIdx >= 0 ? e.text.slice(colonIdx + 1).trim() : '';
      return `<div class="log-entry log-tool"><span class="log-tool-icon">⚙</span><span class="log-tool-name">${escapeHtml(name)}</span>${input ? `<span class="log-tool-input">${escapeHtml(input)}</span>` : ''}</div>`;
    }
    if (e.type === 'info') {
      return `<div class="log-entry log-info">${escapeHtml(e.text)}</div>`;
    }
    if (e.type === 'tool-detail') {
      return `<div class="log-entry log-tool-detail">→ ${escapeHtml(e.text)}</div>`;
    }
    return `<div class="log-entry log-text">${escapeHtml(e.text)}</div>`;
  }).join('');
}

function updateJobStream(job) {
  const log = job.log || '';

  // provider 배지 (첫 줄에서 한 번만 파싱)
  const providerEl = document.getElementById('job-stream-provider');
  if (providerEl && !providerEl.textContent) {
    const nl = log.indexOf('\n');
    const firstLine = nl >= 0 ? log.slice(0, nl) : log;
    const m = firstLine.match(/^\[([^\]]+)\]/);
    if (m) providerEl.textContent = m[1];
  }

  // 로그 본문 (첫 줄 제외) — 파싱 후 HTML 렌더링
  const outputEl = document.getElementById('job-stream-output');
  if (outputEl) {
    const nl = log.indexOf('\n');
    const logContent = nl >= 0 ? log.slice(nl + 1).trim() : '';
    if (!logContent) {
      outputEl.innerHTML = '<div class="log-entry log-text">처리 중입니다...</div>';
    } else {
      const entries = parseJobLogEntries(logContent);
      outputEl.innerHTML = entries.length ? renderJobLogHtml(entries) : '<div class="log-entry log-text">처리 중입니다...</div>';
      if (outputEl.querySelector('.log-generating-dots')) startDotsAnimation();
    }
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  // 실 토큰 사용량 (job 완료 후 DB에서 조회)
  const tokensEl = document.getElementById('job-stream-tokens');
  if (tokensEl) {
    const inT = job.input_tokens;
    const outT = job.output_tokens;
    if (inT != null || outT != null) {
      const cached = (job.cache_read_tokens ?? 0) + (job.cache_creation_tokens ?? 0);
      const cachedStr = cached > 0 ? ` (cache ${cached.toLocaleString()})` : '';
      tokensEl.textContent = `in ${(inT ?? 0).toLocaleString()} / out ${(outT ?? 0).toLocaleString()}${cachedStr}`;
    } else {
      tokensEl.textContent = '';
    }
  }
}

// 폴링 중단 + 로딩 화면 닫기 (워크스페이스 전환 / 외부 이탈용)
function abortCurrentJob() {
  if (_currentJobInterval) {
    clearInterval(_currentJobInterval);
    _currentJobInterval = null;
  }
  if (document.getElementById('job-stream-screen') &&
      !document.getElementById('job-stream-screen').classList.contains('hidden')) {
    hideJobStream();
  }
}

async function pollJob(jobId, onDone) {
  currentJobId = jobId;
  let lastLog = null;
  if (_currentJobInterval) clearInterval(_currentJobInterval);
  _currentJobInterval = setInterval(async () => {
    try {
      const job = await API.get('/jobs/' + jobId);
      if (job.log !== lastLog) { lastLog = job.log; updateJobStream(job); }
      if (job.status === 'completed') {
        clearInterval(_currentJobInterval);
        _currentJobInterval = null;
        hideJobStream();
        document.getElementById('job-status')?.classList.add('hidden');
        try { renderWorkflowSummary((await API.get('/workspace')).workflow); } catch { /* ignore */ }
        onDone(null, job);
      } else if (job.status === 'failed' || job.status === 'cancelled' || job.status === 'superseded') {
        clearInterval(_currentJobInterval);
        _currentJobInterval = null;
        hideJobStream();
        document.getElementById('job-status')?.classList.add('hidden');
        onDone(new Error(job.error || '작업 실패'));
      }
    } catch (e) {
      clearInterval(_currentJobInterval);
      _currentJobInterval = null;
      hideJobStream();
    }
  }, 500);
}

document.getElementById('job-stream-cancel')?.addEventListener('click', async () => {
  if (!currentJobId) return;
  try {
    await API.post('/jobs/' + currentJobId + '/cancel', {});
    showToast('작업 취소 요청을 보냈습니다.', 'success');
  } catch (e) {
    showToast('작업 취소 실패: ' + e.message, 'error');
  }
});

function showJobStatus(msg) {
  const el = document.getElementById('job-status');
  if (!el) return;
  el.innerHTML = `<div class="spinner"></div> ${msg}`;
  el.classList.remove('hidden', 'error');
}

// ========== FAB Toggle ==========
document.getElementById('fab-trigger')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const actions = document.getElementById('fab-actions');
  const trigger = e.currentTarget;
  const isOpen = actions.classList.contains('open');
  actions.classList.toggle('open', !isOpen);
  trigger.classList.toggle('open', !isOpen);
});

document.addEventListener('click', (e) => {
  const fab = document.getElementById('fab-container');
  if (fab && !fab.contains(e.target)) {
    const actions = document.getElementById('fab-actions');
    if (actions?.classList.contains('open')) {
      actions.classList.remove('open');
      document.getElementById('fab-trigger')?.classList.remove('open');
    }
  }
});

// ========== Action Buttons ==========
document.getElementById('btn-analyze')?.addEventListener('click', async () => {
  showJobStream('AI 분석 중...');
  showJobStatus('분석 중...');
  try {
    const tab = activeTab || 'review';
    let perspectiveIds;
    try {
      const { perspectives } = await API.get(`/perspectives/active?tab=${tab}`);
      perspectiveIds = perspectives.map(p => p.id);
    } catch { /* 서버 오류 시 서버 기본값 사용 */ }
    const { jobId } = await API.post('/analyze', { tab, perspectiveIds });
    pollJob(jobId, (err) => {
      if (err) { showRecovery(err); showToast('분석 실패: ' + err.message, 'error'); return; }
      showToast('분석 완료!');
      clearGrace();
      loadIssues(activeTab);
    });
  } catch (e) { showRecovery(e); hideJobStream(); showToast('오류: ' + e.message, 'error'); }
});

document.getElementById('btn-apply')?.addEventListener('click', async () => {
  showJobStream('AI 반영 중...');
  showJobStatus('반영하기 처리 중...');
  try {
    const { jobId } = await API.post('/apply', { tab: activeTab });
    pollJob(jobId, (err) => {
      if (err) { showRecovery(err); showToast('반영 실패: ' + err.message, 'error'); return; }
      showToast('반영 완료!');
      currentTabHasDrafts = false;
      clearGrace();
      loadIssues(activeTab);
    });
  } catch (e) { showRecovery(e); hideJobStream(); showToast('오류: ' + e.message, 'error'); }
});

document.getElementById('btn-generate')?.addEventListener('click', async () => {
  showJobStream('문서 생성 중...');
  showJobStatus('문서 생성 중...');
  try {
    const { jobId, folderName } = await API.post('/generate', { tab: activeTab });
    pollJob(jobId, (err) => {
      if (err) { showRecovery(err); showToast('문서 생성 실패: ' + err.message, 'error'); return; }
      showToast('문서 생성 완료! — ' + folderName);
      if (typeof loadRecommendations === 'function') loadRecommendations(activeTab);
    });
  } catch (e) { showRecovery(e); hideJobStream(); showToast('오류: ' + e.message, 'error'); }
});

function setClaudeStatus(available, text) {
  const el = document.getElementById('claude-status');
  if (!el) return;
  el.classList.remove('checking', 'connected', 'disconnected');
  el.classList.add(available ? 'connected' : 'disconnected');
  el.textContent = text;
}

function providerLabel(provider) {
  return provider === 'codex' ? 'Codex' : 'Claude';
}

function initProviderSelect(workspace) {
  const sel = document.getElementById('provider-select');
  if (!sel) return;

  const claudeMsg = workspace.claudeAvailable ? '' : 'Claude CLI가 설치되지 않았습니다.';
  const codexMsg  = workspace.codexAvailable  ? '' : 'Codex CLI가 설치되지 않았습니다. (npm install -g @openai/codex)';

  document.querySelectorAll('#claude-models option').forEach(opt => {
    opt.disabled = !workspace.claudeAvailable;
    if (claudeMsg) opt.title = claudeMsg;
  });
  document.querySelectorAll('#codex-models option').forEach(opt => {
    opt.disabled = !workspace.codexAvailable;
    if (codexMsg) opt.title = codexMsg;
  });

  const { provider, model } = workspace.providerModel ?? { provider: 'claude', model: 'claude-sonnet-4-6' };
  const val = `${provider}:${model}`;

  if (!sel.querySelector(`option[value="${val}"]`)) {
    const grp = document.getElementById(provider === 'codex' ? 'codex-models' : 'claude-models');
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = `${providerLabel(provider)} ${model}`;
    grp?.appendChild(opt);
  }
  sel.value = val;
  sel.disabled = false;

  const label = providerLabel(provider);
  const isConnected = provider === 'codex' ? workspace.codexAvailable : workspace.claudeAvailable;
  setClaudeStatus(isConnected, isConnected ? `${label} 연결됨 (${model})` : `${label} 연결 안 됨`);
}

async function onProviderChange(val) {
  const [provider, ...rest] = val.split(':');
  const model = rest.join(':');
  try {
    await API.put('/workspace/provider', { provider, model });
    document.getElementById('provider-select').value = val;
    const label = providerLabel(provider);
    setClaudeStatus(true, `${label} 연결됨 (${model})`);
    showToast(`AI 백엔드: ${label} / ${model}`);
  } catch (err) {
    showToast('모델 변경 실패: ' + err.message, 'error');
  }
}

document.getElementById('provider-select')?.addEventListener('change', (e) => onProviderChange(e.target.value));

// ========== Workspace Picker ==========
function showWorkspacePicker(recents = [], canCancel = false) {
  document.getElementById('workspace-picker').classList.remove('hidden');
  document.querySelector('.workspace-header').classList.add('hidden');
  document.querySelector('.sidebar').classList.add('hidden');
  document.querySelector('.main').classList.add('hidden');

  const cancelBtn = document.getElementById('workspace-picker-cancel');
  if (cancelBtn) {
    canCancel ? cancelBtn.classList.remove('hidden') : cancelBtn.classList.add('hidden');
  }

  const listEl = document.getElementById('recents-list');
  const emptyEl = document.getElementById('recents-empty');
  if (recents.length > 0) {
    listEl.innerHTML = recents.map(p => {
      const name = p.split('/').pop();
      return `<li><button class="recent-item" data-path="${p}"><span class="recent-name">${name}</span><span class="recent-path">${p}</span></button></li>`;
    }).join('');
    listEl.querySelectorAll('.recent-item').forEach(btn => {
      btn.addEventListener('click', () => doOpenWorkspace(btn.dataset.path));
    });
    emptyEl?.classList.add('hidden');
  } else {
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');
  }
}

function hideWorkspacePicker() {
  document.getElementById('workspace-picker').classList.add('hidden');
  document.querySelector('.workspace-header').classList.remove('hidden');
  document.querySelector('.sidebar').classList.remove('hidden');
  document.querySelector('.main').classList.remove('hidden');
}

async function doOpenWorkspace(folderPath) {
  abortCurrentJob();  // 진행 중인 AI 작업 즉시 중단
  try {
    await API.post('/workspace/close', {}).catch(() => {});  // best-effort
    const workspace = await API.post('/workspace/open', { path: folderPath });
    showRecovery(null);
    renderApp(workspace);
  } catch (err) {
    showRecovery(err);
    showToast('폴더 열기 실패: ' + err.message, 'error');
    return;
  }
  hideWorkspacePicker();
}

document.getElementById('btn-new-project')?.addEventListener('click', () => {
  document.getElementById('init-screen').classList.remove('hidden');
  document.querySelector('.tab-content')?.classList.add('hidden');
  document.getElementById('prd-preview').classList.add('hidden');
});

document.getElementById('btn-change-workspace')?.addEventListener('click', async () => {
  try {
    const workspace = await API.get('/workspace');
    showWorkspacePicker(workspace.recents ?? [], true);
  } catch {
    showWorkspacePicker([], true);
  }
});

document.getElementById('workspace-picker-cancel')?.addEventListener('click', () => {
  hideWorkspacePicker();
});

document.getElementById('workspace-browse-btn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = '선택 중...';
  try {
    const res = await API.post('/workspace/pick-folder', {});
    if (!res.cancelled && res.path) {
      document.getElementById('workspace-path-input').value = res.path;
      await doOpenWorkspace(res.path);
    }
  } catch (err) {
    showToast('폴더 선택 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '폴더 선택...';
  }
});

document.getElementById('workspace-open-btn')?.addEventListener('click', () => {
  const p = document.getElementById('workspace-path-input')?.value.trim();
  if (p) doOpenWorkspace(p);
});

document.getElementById('workspace-path-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const p = e.target.value.trim();
    if (p) doOpenWorkspace(p);
  }
});

// ========== Scroll Entry Animations ==========
let _scrollObserver = null;
function setupScrollAnimations() {
  if (_scrollObserver) _scrollObserver.disconnect();
  _scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        _scrollObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

  document.querySelectorAll('.issue-section, .summary-card, .workflow-card, .doc-card').forEach(el => {
    el.classList.add('scroll-entry');
    _scrollObserver.observe(el);
  });
}

// ========== Initial Load ==========
function renderApp(workspace) {
  // 이전 워크스페이스 이슈 상태 초기화
  state = {};
  _perspCollapsed = {};
  ['review', 'backend', 'frontend', 'features'].forEach(tab => {
    const contentArea = document.querySelector(`#panel-${tab} .issue-content`);
    if (contentArea) contentArea.innerHTML = '';
    document.querySelector(`#panel-${tab} .perspectives-panel`)?.remove();
  });
  document.getElementById('persp-modal')?.remove();
  const statusSidebar = document.getElementById('statusSidebar');
  if (statusSidebar) statusSidebar.innerHTML = '';

  setSessionId(workspace.sessionId);
  const nameEl = document.getElementById('workspace-name');
  if (nameEl) nameEl.textContent = workspace.name || 'CodeForge Blueprint';
  const folderEl = document.getElementById('workspace-folder-name');
  if (folderEl) folderEl.textContent = workspace.rootPath ? workspace.rootPath.split('/').pop() : '';
  const reviewMeta = document.getElementById('review-meta');
  if (reviewMeta) {
    const latestDoc = workspace.workflow?.documents?.[0];
    reviewMeta.textContent = `Workspace: ${workspace.rootPath}${workspace.source_prd_path ? ` | Source PRD: ${workspace.source_prd_path.split('/').pop()}` : ''}${latestDoc ? ` | Latest Doc: ${latestDoc.file_path.split('/').pop()}` : ''}`;
  }

  initProviderSelect(workspace);
  renderWorkflowSummary(workspace.workflow);
  showRecovery(null);

  if (workspace.prd_path) {
    document.getElementById('init-screen').classList.add('hidden');
    document.getElementById('prd-preview').classList.add('hidden');
    document.querySelector('.tab-content')?.classList.remove('hidden');
    document.getElementById('fab-container')?.classList.remove('hidden');
    document.getElementById('btn-history')?.removeAttribute('disabled');
    loadIssues(activeTab);
    loadPerspectivesPanel(activeTab);
    setupScrollAnimations();
  } else {
    document.getElementById('init-screen').classList.remove('hidden');
    document.querySelector('.tab-content')?.classList.add('hidden');
    document.getElementById('fab-container')?.classList.add('hidden');
  }
}

async function loadInitialState() {
  try {
    const workspace = await API.get('/workspace');

    if (!workspace.hasWorkspace) {
      if (workspaceSessionId && workspace.sessionId !== workspaceSessionId) setSessionId('');
      showWorkspacePicker(workspace.recents);
      return;
    }

    renderApp(workspace);

    // 창 닫기/새로고침 후 재접속 시 진행 중인 job이 있으면 폴링 재개
    const runningJob = workspace.workflow?.runningJobs?.[0];
    if (runningJob) {
      const jobTypeLabel = {
        'generate-prd': 'PRD 생성 중...',
        'analyze': 'AI 분석 중...',
        'apply': 'AI 반영 중...',
        'generate': '문서 생성 중...',
      }[runningJob.type] || 'AI 작업 중...';
      showJobStream(jobTypeLabel, runningJob.started_at);
      pollJob(runningJob.id, (err) => {
        if (err) { showRecovery(err); showToast('작업 실패: ' + err.message, 'error'); return; }
        loadIssues(activeTab);
      });
    }
  } catch (e) {
    console.error('Failed to load workspace:', e);
    showRecovery(e);
    setClaudeStatus(false, '서버 연결 실패');
  }
}

// ========== Beforeunload: 세션 정리 ==========
window.addEventListener('beforeunload', () => {
  if (workspaceSessionId) {
    navigator.sendBeacon('/api/workspace/close', JSON.stringify({ sessionId: workspaceSessionId }));
  }
});

// ========== Active Link Highlight ==========
const obs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
      const link = document.querySelector(`.sidebar a[href="#${entry.target.id}"]`);
      if (link) link.classList.add('active');
    }
  });
}, { rootMargin: '-15% 0px -75% 0px' });
document.querySelectorAll('h2[id], h3[id]').forEach(el => obs.observe(el));

// ========== Diff Modal Styles ==========
// Styles moved to styles.css

// ========== Diff Modal Logic ==========
let diffSelectedLeft = null;
let diffSelectedRight = null;

document.getElementById('btn-history')?.addEventListener('click', () => {
  openDiffModal(activeTab);
});

async function openDiffModal(tab) {
  try {
    const { versions } = await API.get(`/generate/versions?tab=${tab}`);
    diffSelectedLeft = null;
    diffSelectedRight = null;
    renderVersionList(versions || []);
    document.getElementById('diff-view').innerHTML = '';
    document.getElementById('diff-compare-btn').disabled = true;
    document.getElementById('diff-modal').classList.remove('hidden');
  } catch (e) {
    showToast('히스토리 로드 실패: ' + e.message, 'error');
  }
}

function renderVersionList(versions) {
  const container = document.getElementById('diff-version-list');
  if (!versions.length) {
    container.innerHTML = '<p class="empty-state">생성된 문서가 없습니다.</p>';
    return;
  }
  container.innerHTML = versions.map((v, i) => `
    <div class="diff-version-item" data-id="${v.id}">
      <label class="diff-radio-label"><input type="radio" name="diff-left" value="${v.id}" ${i === 1 ? 'checked' : ''}> 이전</label>
      <label class="diff-radio-label"><input type="radio" name="diff-right" value="${v.id}" ${i === 0 ? 'checked' : ''}> 현재</label>
      <span class="diff-version-info">v${escapeHtml(v.version)} · ${timeAgo(v.created_at) || v.created_at}</span>
    </div>
  `).join('');

  if (versions.length >= 2) {
    diffSelectedLeft = versions[1].id;
    diffSelectedRight = versions[0].id;
    document.getElementById('diff-compare-btn').disabled = false;
  }

  container.querySelectorAll('input[name="diff-left"]').forEach(r => {
    r.addEventListener('change', e => { diffSelectedLeft = parseInt(e.target.value); updateDiffCompareBtn(); });
  });
  container.querySelectorAll('input[name="diff-right"]').forEach(r => {
    r.addEventListener('change', e => { diffSelectedRight = parseInt(e.target.value); updateDiffCompareBtn(); });
  });
}

function updateDiffCompareBtn() {
  const btn = document.getElementById('diff-compare-btn');
  if (btn) btn.disabled = !(diffSelectedLeft && diffSelectedRight && diffSelectedLeft !== diffSelectedRight);
}

document.getElementById('diff-compare-btn')?.addEventListener('click', async () => {
  if (!diffSelectedLeft || !diffSelectedRight) return;
  try {
    const [leftData, rightData] = await Promise.all([
      API.get(`/generate/content/${diffSelectedLeft}`),
      API.get(`/generate/content/${diffSelectedRight}`),
    ]);
    renderDiff(leftData, rightData);
  } catch (e) {
    document.getElementById('diff-view').innerHTML = `<p class="error-state">로드 실패: ${escapeHtml(e.message)}</p>`;
  }
});

function renderDiff(left, right) {
  const view = document.getElementById('diff-view');
  if (left.error === 'file_not_found' || right.error === 'file_not_found') {
    view.innerHTML = '<p class="error-state">파일이 삭제되었습니다.</p>';
    return;
  }
  if (typeof Diff === 'undefined') {
    view.innerHTML = '<p class="error-state">diff 라이브러리를 로드할 수 없습니다.</p>';
    return;
  }
  const leftText = left.content || '';
  const rightText = right.content || '';
  const parts = Diff.diffLines(leftText, rightText);
  let html = `<div class="diff-header"><span>v${escapeHtml(left.version)} (이전)</span><span>v${escapeHtml(right.version)} (현재)</span></div><pre class="diff-content">`;
  for (const part of parts) {
    const cls = part.added ? 'diff-add' : part.removed ? 'diff-remove' : 'diff-unchanged';
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const lines = part.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
      html += `<span class="${cls}">${prefix} ${escapeHtml(line)}\n</span>`;
    }
  }
  html += '</pre>';
  view.innerHTML = html;
}

document.getElementById('diff-modal-close')?.addEventListener('click', () => {
  document.getElementById('diff-modal').classList.add('hidden');
});
document.getElementById('diff-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});

// ========== Issue Timeline Modal (Snapshots + Decisions) ==========
async function openSnapshotModal(issueId) {
  // Remove existing overlay if any
  document.getElementById('timeline-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'timeline-overlay';
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const container = document.createElement('div');
  container.className = 'modal-container timeline-modal-container';
  container.innerHTML = `
    <div class="modal-header">
      <h3>${escapeHtml(issueId.toUpperCase())} 타임라인</h3>
      <button class="modal-close-btn" id="timeline-modal-close">&times;</button>
    </div>
    <div class="timeline-modal-body">
      <div class="timeline-loading">로딩 중...</div>
    </div>`;
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  container.querySelector('#timeline-modal-close').addEventListener('click', () => overlay.remove());

  try {
    const { entries } = await API.get(`/issues/${issueId}/timeline`);
    const body = container.querySelector('.timeline-modal-body');

    if (!entries || !entries.length) {
      body.innerHTML = '<p class="empty-state">타임라인 항목이 없습니다.</p>';
      return;
    }

    let detailPanel = null;
    body.innerHTML = `<div class="timeline-split">
      <div class="timeline-list"></div>
      <div class="timeline-detail"><p class="text-muted">항목을 선택하세요</p></div>
    </div>`;

    const listEl = body.querySelector('.timeline-list');
    const detailEl = body.querySelector('.timeline-detail');

    listEl.innerHTML = entries.map((entry, i) => {
      const isSnapshot = entry.type === 'snapshot';
      const markerClass = isSnapshot ? 'timeline-marker-snapshot' : 'timeline-marker-decision';
      const label = isSnapshot ? '분석' : '결정';
      const statusLabel = entry.status ? (STATUS_MAP[entry.status]?.label || entry.status) : '';
      const title = isSnapshot ? escapeHtml(entry.title || '') : statusLabel;
      const subtitle = isSnapshot ? '' : (entry.old_status ? `${STATUS_MAP[entry.old_status]?.label || entry.old_status} → ${statusLabel}` : statusLabel);

      return `<div class="timeline-entry" data-idx="${i}">
        <div class="timeline-marker ${markerClass}"></div>
        <div class="timeline-entry-content">
          <span class="timeline-date">${escapeHtml(entry.date)}</span>
          <span class="timeline-label">${label}</span>
          <span class="timeline-title">${title}</span>
          ${subtitle ? `<span class="timeline-subtitle">${escapeHtml(subtitle)}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    let activeEl = null;
    listEl.addEventListener('click', (e) => {
      const el = e.target.closest('.timeline-entry');
      if (!el) return;
      const entry = entries[Number(el.dataset.idx)];
      activeEl?.classList.remove('active');
      el.classList.add('active');
      activeEl = el;

      if (entry.type === 'snapshot') {
        const statusLabel = entry.status ? (STATUS_MAP[entry.status]?.label || entry.status) : '';
        const memoHtml = entry.memo ? `<div class="snapshot-memo-block"><strong>메모:</strong> ${escapeHtml(entry.memo)}</div>` : '';
        const statusHtml = statusLabel ? `<div class="snapshot-status-block"><strong>상태:</strong> ${escapeHtml(statusLabel)}</div>` : '';
        detailEl.innerHTML = `<h4>${escapeHtml(entry.title || '')}</h4>${statusHtml}${memoHtml}<hr class="snapshot-divider">${entry.html_content || ''}`;
      } else {
        const statusLabel = entry.status ? (STATUS_MAP[entry.status]?.label || entry.status) : '';
        const oldLabel = entry.old_status ? (STATUS_MAP[entry.old_status]?.label || entry.old_status) : '';
        const reasonHtml = entry.reason ? `<div class="timeline-reason"><strong>사유:</strong> ${escapeHtml(entry.reason)}</div>` : '';
        const memoHtml = entry.memo ? `<div class="snapshot-memo-block"><strong>메모:</strong> ${escapeHtml(entry.memo)}</div>` : '';
        detailEl.innerHTML = `<h4>상태 변경</h4>` +
          (oldLabel ? `<div class="timeline-status-change">${escapeHtml(oldLabel)} → ${escapeHtml(statusLabel)}</div>` : `<div class="timeline-status-change">${escapeHtml(statusLabel)}</div>`) +
          reasonHtml + memoHtml;
      }
    });

    // 첫 항목 자동 선택
    listEl.querySelector('.timeline-entry')?.click();
  } catch (e) {
    showToast('타임라인 로드 실패: ' + e.message, 'error');
  }
}

// ========== Template Suggestion ==========
const SERVICE_TYPE_TO_TEMPLATE = {
  'web-fullstack': 'saas', 'pwa': 'saas', 'api': 'saas',
  'mobile': 'saas', 'ios': 'saas', 'android': 'saas',
  'web-frontend': 'content',
  'cli': 'internal-tool', 'script': 'internal-tool', 'desktop': 'internal-tool',
  'extension': 'side-project', 'sdk': 'side-project', 'game': 'side-project',
  'unknown': 'side-project',
};

let _templateCache = {};
let _templateMode = 'example'; // 'example' | 'skeleton'

async function onServiceTypeChange(type) {
  const templateType = SERVICE_TYPE_TO_TEMPLATE[type];
  const container = document.getElementById('template-suggestion');
  if (!container) return;
  if (!templateType) { container.classList.add('hidden'); return; }

  let data = _templateCache[templateType];
  if (!data) {
    try {
      data = await API.get('/init/templates/' + templateType);
      _templateCache[templateType] = data;
    } catch (e) { container.classList.add('hidden'); return; }
  }

  container.classList.remove('hidden');
  container.dataset.templateType = templateType;
  renderTemplateSuggestion(data);
}

function renderTemplateSuggestion(data) {
  const container = document.getElementById('template-suggestion');
  if (!container || !data) return;

  const content = _templateMode === 'example' ? data.example : data.skeleton;

  container.innerHTML = `
    <div class="template-suggestion-header">📄 ${escapeHtml(data.label)} 템플릿</div>
    <div class="template-tabs">
      <button class="template-tab-btn ${_templateMode === 'example' ? 'active' : ''}" onclick="setTemplateMode('example')">완성 예시</button>
      <button class="template-tab-btn ${_templateMode === 'skeleton' ? 'active' : ''}" onclick="setTemplateMode('skeleton')">빈 골격</button>
    </div>
    <pre class="template-preview">${escapeHtml(content)}</pre>
    <button class="template-use-btn" onclick="useTemplate()">이 템플릿 사용하기</button>`;
}

function setTemplateMode(mode) {
  _templateMode = mode;
  const container = document.getElementById('template-suggestion');
  if (!container) return;
  const type = container.dataset.templateType;
  const data = _templateCache[type];
  if (data) renderTemplateSuggestion(data);
}

async function useTemplate() {
  const container = document.getElementById('template-suggestion');
  const type = container?.dataset.templateType;
  const data = _templateCache[type];
  if (!data) return;

  const content = _templateMode === 'example' ? data.example : data.skeleton;
  const textarea = document.getElementById('init-detail');
  if (!textarea) return;

  if (textarea.value.trim() && !(await appConfirm('현재 입력 내용을 덮어씁니다. 계속하시겠습니까?'))) return;
  textarea.value = content;
  textarea.classList.remove('error');
  document.getElementById('init-detail-error')?.setAttribute('style', 'display:none');
  textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('템플릿을 적용했습니다. 자유롭게 수정하세요!');
}

// 서비스 유형 라디오 변경 이벤트
document.querySelectorAll('input[name="service-type"]').forEach(radio => {
  radio.addEventListener('change', (e) => onServiceTypeChange(e.target.value));
});

// ========== Timeline View ==========
let _timelinePage = 1;
let _timelineFilters = { tab: '', status: '', from: '', to: '' };
let _timelineTotal = 0;
const TIMELINE_LIMIT = 20;

const STATUS_LABELS_FULL = {
  pending: '미검토', reviewing: '검토중', resolved: '확정',
  deferred: '보류', dismissed: '삭제'
};

async function loadTimelineView(append = false) {
  if (!append) {
    _timelinePage = 1;
    const panel = document.getElementById('panel-timeline');
    if (!panel) return;
    panel.innerHTML = '<div class="timeline-empty timeline-loading">불러오는 중...</div>';
  }

  try {
    const params = new URLSearchParams({
      page: String(_timelinePage),
      limit: String(TIMELINE_LIMIT),
      ...((_timelineFilters.tab) && { tab: _timelineFilters.tab }),
      ...((_timelineFilters.status) && { status: _timelineFilters.status }),
      ...((_timelineFilters.from) && { from: _timelineFilters.from }),
      ...((_timelineFilters.to) && { to: _timelineFilters.to }),
    });
    const data = await API.get('/decisions?' + params.toString());
    _timelineTotal = data.total || 0;
    renderTimelineView(data, append);
  } catch (e) {
    const panel = document.getElementById('panel-timeline');
    if (panel) panel.innerHTML = `<div class="timeline-empty timeline-error">로드 실패: ${escapeHtml(e.message)}</div>`;
  }
}

function renderTimelineView(data, append = false) {
  const panel = document.getElementById('panel-timeline');
  if (!panel) return;

  const { decisions = [], stats = {}, deferredReminders = [] } = data;

  if (!append) {
    let html = '<div class="timeline-panel">';

    // 통계 바
    html += `<div class="timeline-stats">
      <div class="timeline-stat"><span class="timeline-stat-num">${stats.total || 0}</span>전체 결정</div>
      <div class="timeline-stat"><span class="timeline-stat-num stat-resolved">${stats.resolved || 0}</span>확정</div>
      <div class="timeline-stat"><span class="timeline-stat-num stat-deferred">${stats.deferred || 0}</span>보류</div>
      <div class="timeline-stat"><span class="timeline-stat-num stat-reviewing">${stats.reviewing || 0}</span>검토중</div>
    </div>`;

    // 보류 리마인더
    if (deferredReminders.length > 0) {
      const items = deferredReminders.map(r =>
        `<span class="timeline-deferred-item" onclick="navigateToIssue('${escapeHtml(r.tab)}','${escapeHtml(r.issue_id)}')">${escapeHtml(r.issue_id.toUpperCase())} · ${escapeHtml(r.title.slice(0, 20))}${r.title.length > 20 ? '…' : ''}</span>`
      ).join('');
      html += `<div class="timeline-deferred-banner">
        <div class="timeline-deferred-banner-title">보류 3일 이상 — 재검토 권장 (${deferredReminders.length}건)</div>
        <div>${items}</div>
      </div>`;
    }

    // 필터
    html += `<div class="timeline-filters">
      <select class="timeline-filter-select" id="tl-filter-tab" onchange="applyTimelineFilter()">
        <option value="">모든 탭</option>
        <option value="review">기획 리뷰</option>
        <option value="features">다음버전</option>
        <option value="backend">BE 설계</option>
        <option value="frontend">FE 설계</option>
      </select>
      <select class="timeline-filter-select" id="tl-filter-status" onchange="applyTimelineFilter()">
        <option value="">모든 상태</option>
        <option value="resolved">확정</option>
        <option value="deferred">보류</option>
        <option value="dismissed">삭제</option>
        <option value="reviewing">검토중</option>
      </select>
      <input type="date" class="timeline-filter-input" id="tl-filter-from" placeholder="시작일" onchange="applyTimelineFilter()">
      <input type="date" class="timeline-filter-input" id="tl-filter-to" placeholder="종료일" onchange="applyTimelineFilter()">
    </div>`;

    // 필터 복원
    html += '</div>';
    panel.innerHTML = html;

    // 필터 값 복원
    const selTab = panel.querySelector('#tl-filter-tab');
    const selStatus = panel.querySelector('#tl-filter-status');
    const inFrom = panel.querySelector('#tl-filter-from');
    const inTo = panel.querySelector('#tl-filter-to');
    if (selTab) selTab.value = _timelineFilters.tab;
    if (selStatus) selStatus.value = _timelineFilters.status;
    if (inFrom) inFrom.value = _timelineFilters.from;
    if (inTo) inTo.value = _timelineFilters.to;
  }

  // 엔트리 영역
  let entriesContainer = panel.querySelector('.timeline-entries');
  if (!entriesContainer) {
    entriesContainer = document.createElement('div');
    entriesContainer.className = 'timeline-entries';
    panel.querySelector('.timeline-panel').appendChild(entriesContainer);
  }

  if (decisions.length === 0 && !append) {
    entriesContainer.innerHTML = '<div class="timeline-empty">결정 이력이 없습니다. "반영하기"를 실행하면 이곳에 기록됩니다.</div>';
    return;
  }

  // 날짜별 그룹핑
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  function dateGroup(dateStr) {
    if (dateStr >= today) return '오늘';
    if (dateStr >= weekAgo) return '이번 주';
    return '이전';
  }

  function statusBadge(status) {
    if (!status) return '';
    const label = STATUS_LABELS_FULL[status] || status;
    return `<span class="timeline-status-badge tsb-${status}">${escapeHtml(label)}</span>`;
  }

  function tabBadge(tab) {
    const labels = { review: '기획', features: '다음버전', backend: 'BE', frontend: 'FE' };
    return `<span class="timeline-tab-badge">${escapeHtml(labels[tab] || tab)}</span>`;
  }

  // append 시 마지막 그룹 헤더 파악
  let lastGroup = append ? (entriesContainer.dataset.lastGroup || '') : '';

  for (const entry of decisions) {
    const group = dateGroup(entry.date);
    if (group !== lastGroup) {
      const header = document.createElement('div');
      header.className = 'timeline-group-header';
      header.textContent = group;
      entriesContainer.appendChild(header);
      lastGroup = group;
    }

    const statusTransition = entry.old_status
      ? `${statusBadge(entry.old_status)} <span class="tsb-arrow">→</span> ${statusBadge(entry.status)}`
      : statusBadge(entry.status);

    const div = document.createElement('div');
    div.className = 'timeline-entry';
    div.innerHTML = `
      <span class="timeline-entry-date">${escapeHtml(entry.date)}</span>
      <span class="timeline-entry-id" onclick="navigateToIssue('${escapeHtml(entry.tab)}','${escapeHtml(entry.issue_id)}')">${escapeHtml(entry.issue_id.toUpperCase())}</span>
      <div class="timeline-status-transition">${statusTransition}</div>
      <div class="timeline-entry-body">
        <div class="timeline-entry-title">${escapeHtml(entry.issue_title)}</div>
        ${entry.memo ? `<div class="timeline-entry-memo">${escapeHtml(entry.memo)}</div>` : ''}
      </div>
      ${tabBadge(entry.tab)}`;
    entriesContainer.appendChild(div);
  }
  entriesContainer.dataset.lastGroup = lastGroup;

  // 더 보기 버튼
  const existing = panel.querySelector('.timeline-load-more');
  if (existing) existing.remove();
  const loaded = (_timelinePage - 1) * TIMELINE_LIMIT + decisions.length;
  if (loaded < _timelineTotal) {
    const btn = document.createElement('button');
    btn.className = 'timeline-load-more';
    btn.textContent = `더 보기 (${_timelineTotal - loaded}건 남음)`;
    btn.addEventListener('click', () => { _timelinePage++; loadTimelineView(true); });
    panel.querySelector('.timeline-panel').appendChild(btn);
  }
}

function applyTimelineFilter() {
  _timelineFilters.tab = document.getElementById('tl-filter-tab')?.value || '';
  _timelineFilters.status = document.getElementById('tl-filter-status')?.value || '';
  _timelineFilters.from = document.getElementById('tl-filter-from')?.value || '';
  _timelineFilters.to = document.getElementById('tl-filter-to')?.value || '';
  loadTimelineView(false);
}

function navigateToIssue(tab, issueId) {
  // 타임라인에서 이슈 탭으로 이동
  if (tab && tab !== 'timeline') {
    switchTab(tab);
    // 이슈 로드 완료 후 스크롤 (loadIssues가 비동기이므로 약간 지연)
    setTimeout(() => scrollToIssue(issueId), 600);
  }
}

// ========== Docs View ==========

let _docTypes = [];

async function loadDocsView() {
  const panel = document.getElementById('panel-docs');
  if (!panel) return;
  panel.innerHTML = '<div class="timeline-empty">불러오는 중...</div>';

  try {
    const [types, docs] = await Promise.all([
      API.get('/documents/types'),
      API.get('/documents'),
    ]);
    _docTypes = types;
    renderDocsGrid(panel, types, docs);
  } catch (e) {
    panel.innerHTML = `<div class="timeline-empty timeline-error">오류: ${escapeHtml(String(e))}</div>`;
  }
}

function renderDocsGrid(panel, types, docs) {
  const docsByType = {};
  for (const d of docs) if (d.doc_type) docsByType[d.doc_type] = d;

  const cards = types.map(t => {
    const doc = docsByType[t.slug];
    const filled = doc && doc.id;
    return `
      <div class="doc-card" onclick="openDocEditor('${escapeHtml(t.slug)}')">
        <div class="doc-card-label">${escapeHtml(t.label)}</div>
        <div class="doc-card-status ${filled ? 'filled' : 'empty'}">${filled ? '작성됨' : '미작성'}</div>
        ${doc?.created_at ? `<div class="doc-card-meta">${doc.created_at.slice(0, 10)}</div>` : ''}
      </div>`;
  });

  // 용어집 카드 추가
  cards.push(`
    <div class="doc-card" onclick="openGlossaryEditor()">
      <div class="doc-card-label">용어집</div>
      <div class="doc-card-status">편집 가능</div>
      <div class="doc-card-meta">프로젝트 고유 용어 관리</div>
    </div>`);

  panel.innerHTML = `
    <div class="docs-panel">
      <div class="docs-panel-header">
        <h1>문서 관리</h1>
      </div>
      <div class="docs-grid">${cards.join('')}</div>
    </div>`;
}

async function openDocEditor(docTypeSlug) {
  const panel = document.getElementById('panel-docs');
  if (!panel) return;

  const typeDef = _docTypes.find(t => t.slug === docTypeSlug);
  if (!typeDef) return;

  panel.innerHTML = '<div class="timeline-empty">불러오는 중...</div>';

  let doc = null;
  try {
    doc = await API.get(`/documents/by-type/${docTypeSlug}`);
  } catch {
    // 문서 없음 — 새로 만들기
    try {
      await API.post('/documents', { doc_type: docTypeSlug });
      doc = await API.get(`/documents/by-type/${docTypeSlug}`);
    } catch (e) {
      panel.innerHTML = `<div class="timeline-empty timeline-error">오류: ${escapeHtml(String(e))}</div>`;
      return;
    }
  }

  const sectionMap = {};
  for (const s of (doc.sections || [])) sectionMap[s.section_key] = s.content;

  const sectionHtml = typeDef.sections.map(s => `
    <div class="doc-section">
      <div class="doc-section-label">
        ${escapeHtml(s.title)}
        ${s.required ? '<span class="doc-section-required">필수</span>' : ''}
      </div>
      ${s.hint ? `<div class="doc-section-hint">${escapeHtml(s.hint)}</div>` : ''}
      <textarea
        class="doc-section-textarea"
        data-section-key="${escapeHtml(s.key)}"
        rows="4"
        placeholder="${escapeHtml(s.hint || '')}"
      >${escapeHtml(sectionMap[s.key] || '')}</textarea>
    </div>`).join('');

  const summaryHtml = doc.summary
    ? `<div class="doc-editor-summary">${escapeHtml(doc.summary)}</div>`
    : '';

  panel.innerHTML = `
    <div class="docs-panel doc-editor">
      <button class="doc-editor-back" onclick="loadDocsView()">← 문서 목록</button>
      <div class="doc-editor-title">${escapeHtml(typeDef.label)}</div>
      ${summaryHtml}
      ${sectionHtml}
      <div class="doc-editor-actions">
        <button class="doc-save-btn" onclick="saveDocSections(${doc.id})">저장</button>
        <span class="doc-save-status" id="doc-save-status">저장됨</span>
      </div>
    </div>`;
}

async function saveDocSections(docId) {
  const panel = document.getElementById('panel-docs');
  const textareas = panel.querySelectorAll('.doc-section-textarea');
  const saves = [];
  textareas.forEach(ta => {
    saves.push(
      API.put(`/documents/${docId}/sections/${encodeURIComponent(ta.dataset.sectionKey)}`, { content: ta.value })
    );
  });
  try {
    await Promise.all(saves);
    const status = document.getElementById('doc-save-status');
    if (status) {
      status.classList.add('visible');
      setTimeout(() => status.classList.remove('visible'), 2000);
    }
  } catch (e) {
    await appAlert('저장 실패: ' + String(e));
  }
}

// ========== Glossary Editor ==========

async function openGlossaryEditor() {
  const panel = document.getElementById('panel-docs');
  if (!panel) return;
  panel.innerHTML = '<div class="timeline-empty">불러오는 중...</div>';
  await renderGlossaryEditor(panel);
}

async function renderGlossaryEditor(panel) {
  let terms = [];
  try { terms = await API.get('/glossary'); } catch { /* empty */ }

  const rows = terms.map(t => `
    <tr>
      <td><span class="glossary-term-text">${escapeHtml(t.term)}</span>${t.aliases ? `<br><small class="glossary-aliases">${escapeHtml(t.aliases)}</small>` : ''}</td>
      <td class="glossary-def-text">${escapeHtml(t.definition)}</td>
      <td>${t.category ? `<span class="glossary-cat-badge">${escapeHtml(t.category)}</span>` : ''}</td>
      <td>
        <div class="glossary-actions">
          <button class="glossary-delete-btn" onclick="deleteGlossaryTerm(${t.id})">삭제</button>
        </div>
      </td>
    </tr>`).join('');

  panel.innerHTML = `
    <div class="docs-panel glossary-editor">
      <button class="doc-editor-back" onclick="loadDocsView()">← 문서 목록</button>
      <div class="doc-editor-title">용어집</div>
      <div class="doc-editor-subtitle">프로젝트 고유 용어 / 기능명 / 사용자 타입 / 약어를 정의하세요. AI 분석 시 자동으로 컨텍스트에 포함됩니다.</div>

      <div class="glossary-add-form" id="glossary-add-form">
        <input id="g-term" class="glossary-input-term" placeholder="용어">
        <input id="g-def" class="glossary-input-def" placeholder="정의">
        <input id="g-cat" class="glossary-input-cat" placeholder="카테고리 (선택)">
        <input id="g-aliases" class="glossary-input-aliases" placeholder="별칭 (선택)">
        <button class="glossary-add-btn" onclick="addGlossaryTerm()">+ 추가</button>
      </div>

      ${terms.length > 0 ? `
        <table class="glossary-table">
          <thead><tr><th>용어</th><th>정의</th><th>카테고리</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` : '<div class="timeline-empty">아직 등록된 용어가 없습니다.</div>'}
    </div>`;
}

async function addGlossaryTerm() {
  const term = document.getElementById('g-term')?.value.trim();
  const def = document.getElementById('g-def')?.value.trim();
  const cat = document.getElementById('g-cat')?.value.trim() || null;
  const aliases = document.getElementById('g-aliases')?.value.trim() || null;
  if (!term || !def) { await appAlert('용어와 정의는 필수입니다.'); return; }
  try {
    await API.post('/glossary', { term, definition: def, category: cat, aliases });
    const panel = document.getElementById('panel-docs');
    if (panel) await renderGlossaryEditor(panel);
  } catch (e) { await appAlert('추가 실패: ' + String(e)); }
}

async function deleteGlossaryTerm(id) {
  if (!(await appConfirm('이 용어를 삭제하시겠습니까?'))) return;
  try {
    await API.request(`/glossary/${id}`, { method: 'DELETE' });
    const panel = document.getElementById('panel-docs');
    if (panel) await renderGlossaryEditor(panel);
  } catch (e) { await appAlert('삭제 실패: ' + String(e)); }
}

// ========== Perspectives Panel ==========
// Styles moved to styles.css

let _perspCollapsed = {};

async function loadPerspectivesPanel(tab) {
  if (tab === 'timeline' || tab === 'docs') return;
  const panel = document.getElementById(`panel-${tab}`);
  if (!panel) return;

  let container = panel.querySelector('.perspectives-panel');
  if (!container) {
    container = document.createElement('div');
    container.className = 'perspectives-panel';
    const h1 = panel.querySelector('h1');
    if (h1) h1.insertAdjacentElement('afterend', container);
    else panel.prepend(container);
  }
  container.innerHTML = '';

  try {
    const [allData, activeData] = await Promise.all([
      API.get(`/perspectives?tab=${tab}`),
      API.get(`/perspectives/active?tab=${tab}`),
    ]);
    const all = allData.perspectives || [];
    const activeIds = new Set((activeData.perspectives || []).map(p => p.id));
    renderPerspectivesPanel(container, all, activeIds, tab);
  } catch (e) {
    container.innerHTML = `<div class="perspectives-load-error">관점 로딩 실패</div>`;
  }
}

function renderPerspectivesPanel(container, all, activeIds, tab) {
  const activeCount = all.filter(p => activeIds.has(p.id)).length;
  const collapsed = _perspCollapsed[tab];

  const items = all.map(p => {
    const isActive = activeIds.has(p.id);
    const isLocked = p.is_locked === 1;
    const isCustom = p.category === 'custom';
    const lockIcon = isLocked ? `<span class="persp-lock" title="기본 관점 — 항상 활성">🔒</span>` : '';
    const delBtn = isCustom ? `<button class="persp-del-btn" onclick="deleteCustomPerspective('${escapeHtml(p.id)}','${escapeHtml(tab)}')" title="삭제">✕</button>` : '';
    return `<div class="persp-item">
      <input type="checkbox" ${isActive ? 'checked' : ''} ${isLocked ? 'disabled' : ''} onchange="togglePerspective('${escapeHtml(p.id)}',this.checked,'${escapeHtml(tab)}')">
      ${lockIcon}
      <span class="persp-name">${escapeHtml(p.name)}</span>
      <span class="persp-prefix">${escapeHtml(p.id_prefix.toUpperCase())}</span>
      ${delBtn}
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="persp-header" onclick="togglePerspectivesCollapse('${escapeHtml(tab)}')">
      <span class="persp-title">분석 관점 <span class="persp-count">(${activeCount}개 활성)</span></span>
      <span class="persp-chevron${collapsed ? ' collapsed' : ''}">▾</span>
    </div>
    <div class="persp-body${collapsed ? ' hidden' : ''}">
      <div class="persp-list">${items}</div>
      <button class="persp-add-btn" onclick="openAddPerspectiveModal('${escapeHtml(tab)}')">+ 커스텀 관점 추가</button>
    </div>`;
}

function togglePerspectivesCollapse(tab) {
  _perspCollapsed[tab] = !_perspCollapsed[tab];
  const panel = document.getElementById(`panel-${tab}`)?.querySelector('.perspectives-panel');
  if (!panel) return;
  panel.querySelector('.persp-chevron')?.classList.toggle('collapsed', !!_perspCollapsed[tab]);
  panel.querySelector('.persp-body')?.classList.toggle('hidden', !!_perspCollapsed[tab]);
}

async function togglePerspective(id, active, tab) {
  try {
    await API.put(`/perspectives/${encodeURIComponent(id)}/toggle`, { active });
    loadPerspectivesPanel(tab);
  } catch (e) {
    showToast('관점 변경 실패: ' + e.message, 'error');
    loadPerspectivesPanel(tab); // revert checkbox state
  }
}

async function deleteCustomPerspective(id, tab) {
  if (!(await appConfirm('이 관점을 삭제하시겠습니까?'))) return;
  try {
    await API.request(`/perspectives/${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadPerspectivesPanel(tab);
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}

function openAddPerspectiveModal(tab) {
  let modal = document.getElementById('persp-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'persp-modal';
    modal.className = 'persp-modal-overlay hidden';
    modal.innerHTML = `
      <div class="persp-modal" onclick="event.stopPropagation()">
        <h3>커스텀 관점 추가</h3>
        <div class="persp-field"><label>관점 이름 *</label><input id="pm-name" placeholder="예: 법적 리스크 관점"></div>
        <div class="persp-field"><label>설명 *</label><input id="pm-desc" placeholder="이 관점이 무엇을 검토하는지"></div>
        <div class="persp-field"><label>프롬프트 지시문 *</label><textarea id="pm-instr" placeholder="AI에게 전달할 지시문 (예: 법적 규제 리스크, GDPR 준수 여부를 검토하라)"></textarea></div>
        <div class="persp-field"><label>ID 접두어 * (소문자, 하이픈 허용, 예: rv-legal)</label><input id="pm-prefix" placeholder="rv-legal"></div>
        <div class="persp-modal-actions">
          <button class="persp-cancel-btn" onclick="closeAddPerspectiveModal()">취소</button>
          <button class="persp-save-btn" id="pm-save-btn" onclick="submitCustomPerspective()">추가</button>
        </div>
      </div>`;
    modal.addEventListener('click', closeAddPerspectiveModal);
    document.body.appendChild(modal);
  }
  modal.dataset.tab = tab;
  ['pm-name','pm-desc','pm-instr','pm-prefix'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  modal.classList.remove('hidden');
}

function closeAddPerspectiveModal() {
  document.getElementById('persp-modal')?.classList.add('hidden');
}

async function submitCustomPerspective() {
  const modal = document.getElementById('persp-modal');
  const tab = modal?.dataset.tab;
  const name = document.getElementById('pm-name')?.value.trim();
  const description = document.getElementById('pm-desc')?.value.trim();
  const prompt_instruction = document.getElementById('pm-instr')?.value.trim();
  const id_prefix = document.getElementById('pm-prefix')?.value.trim();
  if (!name || !description || !prompt_instruction || !id_prefix) {
    showToast('모든 필드를 입력하세요.', 'error');
    return;
  }
  const btn = document.getElementById('pm-save-btn');
  if (btn) btn.disabled = true;
  try {
    await API.post('/perspectives', { tab, name, description, prompt_instruction, id_prefix });
    closeAddPerspectiveModal();
    loadPerspectivesPanel(tab);
    showToast('관점이 추가되었습니다.');
  } catch (e) {
    showToast('추가 실패: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ========== Sidebar Toggle ==========
(function setupSidebarToggle() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.main');
  if (!toggle || !sidebar) return;

  const COLLAPSED_KEY = 'cf_sidebar_collapsed';

  function applySidebarState(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    if (main) main.classList.toggle('sidebar-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? '사이드바 펼치기' : '사이드바 접기';
  }

  applySidebarState(localStorage.getItem(COLLAPSED_KEY) === '1');

  toggle.addEventListener('click', () => {
    const isCollapsed = !sidebar.classList.contains('collapsed');
    applySidebarState(isCollapsed);
    localStorage.setItem(COLLAPSED_KEY, isCollapsed ? '1' : '0');
  });
})();

// ========== Tab Keyboard Navigation ==========
document.querySelector('.tab-nav')?.addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = [...document.querySelectorAll('.tab-nav .tab-btn')];
  const current = tabs.findIndex(b => b.dataset.tab === activeTab);
  if (current === -1) return;

  let next;
  if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = tabs.length - 1;

  if (next !== undefined) {
    e.preventDefault();
    tabs[next].focus();
    switchTab(tabs[next].dataset.tab);
  }
});

// ========== Boot ==========
loadInitialState();
