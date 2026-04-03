// ========== Load Initial State from HTML JSON blocks ==========
function loadInitialState() {
  const tabs = ['review', 'features', 'backend', 'frontend'];
  const merged = {};
  tabs.forEach(tab => {
    const el = document.getElementById(`state-${tab}`);
    if (el) {
      try { Object.assign(merged, JSON.parse(el.textContent)); } catch (e) { /* skip invalid */ }
    }
  });
  return merged;
}

const INITIAL_STATE = loadInitialState();

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

// NOTE: {{PROJECT_NAME}} is replaced with the actual project name when generating a new shell.
const STORAGE_KEY = '{{PROJECT_NAME}}-plan-state-v1';
const STATUS_MAP = {
  pending:   { label: '미검토', cls: 'active-pending' },
  reviewing: { label: '검토중', cls: 'active-reviewing' },
  resolved:  { label: '확정',   cls: 'active-resolved' },
  deferred:  { label: '보류',   cls: 'active-deferred' },
  dismissed: { label: '삭제',   cls: 'active-dismissed' }
};
const STATUS_DOT_COLORS = {
  pending: 'transparent', reviewing: 'var(--orange)', resolved: 'var(--green)',
  deferred: 'var(--text-muted)', dismissed: 'var(--red)'
};

function applyStatusDot(dot, status) {
  dot.style.background = STATUS_DOT_COLORS[status] || 'transparent';
  dot.style.border = status === 'pending' ? '1px solid var(--border)' : 'none';
}

let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { ...INITIAL_STATE };

// ========== Tab System ==========
let activeTab = 'review';

const CAT_LABELS = {
  // 기획 리뷰 (A~F)
  'A': '기획 정합성',
  'B': '수익/과금 모델',
  'C': '사용자 획득/유지',
  'D': '구현 가능성',
  'E': '운영 확장성',
  'F': '법적/규제 리스크',
  // 다음버전
  'FT-MKT': '마케팅',
  'FT-OPS': '운영',
  'FT-SVC': '서비스 기획',
  'FT-TECH': '기술',
  'FT-DEF': '기획 리뷰 보류',
  // BE 설계
  'BE-API': 'API 설계',
  'BE-DB': 'DB 스키마',
  'BE-INFRA': '인프라',
  'BE-LIB': '라이브러리',
  'BE-SVC': '서비스 레이어',
  // FE 설계
  'FE-COMP': '화면/컴포넌트',
  'FE-STATE': '상태 관리',
  'FE-ROUTE': '라우팅',
  'FE-API': 'API 연동',
  'FE-TOKEN': '디자인 시스템',
};

const TAB_ID_PATTERNS = {
  review:   /^[a-f]\d+$/,
  features: /^ft-[a-z]+\d+$/,
  backend:  /^be-[a-z]+\d+$/,
  frontend: /^fe-[a-z]+\d+$/,
};

function getIssueIds() {
  const pattern = TAB_ID_PATTERNS[activeTab];
  return Array.from(document.querySelectorAll(`#panel-${activeTab} h3[id]`))
    .map(el => el.id)
    .filter(id => pattern.test(id));
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  buildStatusSidebar();
  if (typeof mermaid !== 'undefined') {
    try { mermaid.run({ querySelector: `#panel-${tabId} pre.mermaid:not([data-processed])` }); } catch (e) { /* ignore */ }
  }
  applyFilter();
  updateCounts();
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function getIssueState(id) { return state[id] || { status: 'pending', memo: '' }; }
function setIssueState(id, patch) {
  state[id] = { ...getIssueState(id), ...patch };
  saveState();
  refreshUI();
}

function refreshUI() {
  updateCounts();
  updateSidebarDots();
  buildStatusSidebar();
}

// ========== Issue Controls Injection ==========
Object.entries(TAB_ID_PATTERNS).forEach(([tab, pattern]) => {
  document.querySelectorAll(`#panel-${tab} h3[id]`).forEach(h3 => {
    const id = h3.id;
    if (!pattern.test(id)) return;

    const ctrl = document.createElement('div');
    ctrl.className = 'issue-controls';
    ctrl.dataset.issueId = id;

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:4px;';
    Object.entries(STATUS_MAP).forEach(([key, {label}]) => {
      const btn = document.createElement('button');
      btn.className = 'status-btn';
      btn.textContent = label;
      btn.dataset.status = key;
      btn.addEventListener('click', () => {
        setIssueState(id, { status: key });
        renderControls(id);
        applyFilter();
      });
      btnGroup.appendChild(btn);
    });
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
});

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
    toggle.innerHTML = `<span style="display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block;"></span>${label} <span class="toggle-count">${totalCount}</span></span><span class="toggle-arrow">▾</span>`;

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
        a.style.cssText = 'display:flex;align-items:center;gap:4px;';

        const dot = document.createElement('span');
        dot.className = 'status-dot';
        applyStatusDot(dot, status);

        const idSpan = document.createElement('span');
        idSpan.style.cssText = 'color:var(--text-muted);font-size:11px;flex-shrink:0;text-transform:uppercase;';
        idSpan.textContent = id.toUpperCase() + '. ';

        const titleSpan = document.createElement('span');
        const titleOnly = fullTitle.replace(/^[A-Za-z0-9-]+\.\s*/, '');
        titleSpan.textContent = titleOnly.length > 22 ? titleOnly.slice(0, 22) + '…' : titleOnly;

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
let currentFilter = 'all';
document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
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
    let el = h3;
    while (el) {
      el.style.display = show ? '' : 'none';
      el = el.nextElementSibling;
      if (!el || el.tagName === 'H3' || el.tagName === 'H2') break;
    }
    h3.style.display = show ? '' : 'none';
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
  Object.entries(counts).forEach(([k, v]) => {
    const el = document.getElementById(`count-${k}`);
    if (el) el.textContent = v;
  });
}

// ========== Export ==========
document.getElementById('exportBtn').addEventListener('click', () => {
  const ids = getIssueIds();
  const data = { _meta: { tab: activeTab, exportedAt: new Date().toISOString() } };
  ids.forEach(id => { data[id] = getIssueState(id); });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan-${activeTab}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  const ORDER = ['resolved', 'reviewing', 'deferred', 'pending', 'dismissed'];
  const buckets = Object.fromEntries(ORDER.map(s => [s, []]));
  ids.forEach(id => { const s = getIssueState(id); (buckets[s.status] || buckets['pending']).push(id); });

  let md = `# 설계 리뷰 결과 (${activeTab})\n\n> 내보내기: ${new Date().toLocaleString('ko-KR')}\n\n`;
  ORDER.forEach(status => {
    const items = buckets[status];
    if (items.length === 0) return;
    md += `## ${STATUS_MAP[status].label} (${items.length}건)\n\n`;
    items.forEach(id => {
      const s = getIssueState(id);
      const h3 = document.getElementById(id);
      const title = h3 ? h3.textContent.trim() : id;
      md += `### ${title}\n- 상태: ${STATUS_MAP[s.status].label}\n`;
      if (s.memo.trim()) md += `- 메모: ${s.memo.trim()}\n`;
      md += `\n`;
    });
  });

  navigator.clipboard.writeText(md).then(() => {
    showToast('JSON 파일 다운로드 + 마크다운 클립보드 복사 완료');
  }).catch(() => {
    showToast('JSON 파일 다운로드 완료 (클립보드 복사 실패)');
  });
});

// ========== Import ==========
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      const meta = imported._meta;
      delete imported._meta;

      if (meta && meta.tab) switchTab(meta.tab);

      state = { ...state, ...imported };
      saveState();

      Object.entries(TAB_ID_PATTERNS).forEach(([tab, pattern]) => {
        document.querySelectorAll(`#panel-${tab} h3[id]`).forEach(h3 => {
          if (!pattern.test(h3.id)) return;
          renderControls(h3.id);
          const ctrl = document.querySelector(`.issue-controls[data-issue-id="${h3.id}"]`);
          if (ctrl) {
            const memo = ctrl.querySelector('.issue-memo');
            if (memo) memo.value = getIssueState(h3.id).memo;
          }
        });
      });

      Object.entries(imported).forEach(([id, data]) => {
        if (!data.memo || !data.memo.trim()) return;
        const log = document.querySelector(`.decision-log[data-issue-id="${id}"]`);
        if (!log) return;
        const entry = document.createElement('div');
        entry.className = 'decision-entry';
        const today = new Date().toISOString().slice(0, 10);
        entry.innerHTML = `<span class="decision-date">${today}</span><span class="decision-status decision-status-${data.status}">${STATUS_MAP[data.status]?.label || data.status}</span><span class="decision-memo">${data.memo.trim()}</span>`;
        log.appendChild(entry);
      });

      refreshUI();
      applyFilter();
      showToast(`${Object.keys(imported).length}건 불러오기 완료`);
    } catch (err) {
      showToast('JSON 파일 파싱 실패');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ========== Toast ==========
const _toast = document.createElement('div');
_toast.id = 'app-toast';
_toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a18;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;';
document.body.appendChild(_toast);
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  _toast.textContent = msg;
  _toast.style.opacity = '1';
  toastTimer = setTimeout(() => { _toast.style.opacity = '0'; }, 2500);
}

// ========== Init ==========
refreshUI();
if (typeof mermaid !== 'undefined') {
  try { mermaid.run({ querySelector: `#panel-${activeTab} pre.mermaid:not([data-processed])` }); } catch (e) { /* ignore */ }
}

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
