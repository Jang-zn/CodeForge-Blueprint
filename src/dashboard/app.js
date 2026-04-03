// ========== API Client ==========
const API = {
  async get(path) {
    const res = await fetch('/api' + path);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async post(path, body) {
    const res = await fetch('/api' + path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async put(path, body) {
    const res = await fetch('/api' + path, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
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
  dismissed: { label: '삭제',   cls: 'active-dismissed' }
};
const STATUS_DOT_COLORS = {
  pending: 'transparent', reviewing: 'var(--orange)', resolved: 'var(--green)',
  deferred: 'var(--text-muted)', dismissed: 'var(--red)'
};

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
};

const TAB_ID_PATTERNS = {
  review:   /^[a-f]\d+$/,
  features: /^ft-[a-z]+\d+$/,
  backend:  /^be-[a-z]+\d+$/,
  frontend: /^fe-[a-z]+\d+$/,
};

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ========== State ==========
let state = {};
let activeTab = 'review';
let currentFilter = 'all';

function applyStatusDot(dot, status) {
  dot.style.background = STATUS_DOT_COLORS[status] || 'transparent';
  dot.style.border = status === 'pending' ? '1px solid var(--border)' : 'none';
}

function getIssueIds() {
  const pattern = TAB_ID_PATTERNS[activeTab];
  return Array.from(document.querySelectorAll(`#panel-${activeTab} h3[id]`))
    .map(el => el.id)
    .filter(id => pattern.test(id));
}

function getIssueState(id) { return state[id] || { status: 'pending', memo: '' }; }

async function setIssueState(id, patch) {
  state[id] = { ...getIssueState(id), ...patch };
  try {
    await API.put('/issues/' + id, { status: state[id].status, memo: state[id].memo });
  } catch (e) {
    console.error('Failed to save issue state:', e);
  }
  refreshUI();
}

// ========== Tab System ==========
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
  loadIssues(tabId);
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

function refreshUI() {
  updateCounts();
  updateSidebarDots();
  buildStatusSidebar();
}

// ========== Issue Loading ==========
async function loadIssues(tab) {
  try {
    const data = await API.get('/issues?tab=' + tab);
    const issues = data.issues || [];

    const panel = document.getElementById(`panel-${tab}`);
    if (!panel) return;

    // Sync local state from server (status + memo)
    issues.forEach(issue => {
      state[issue.id] = { status: issue.status || 'pending', memo: issue.memo || '' };
    });

    // Get or create issue-content area (preserves filter-bar / action-bar siblings)
    let contentArea = panel.querySelector('.issue-content');
    if (!contentArea) {
      contentArea = document.createElement('div');
      contentArea.className = 'issue-content';
      panel.appendChild(contentArea);
    }

    if (issues.length === 0) {
      contentArea.innerHTML = '<p style="color:var(--text-muted);padding:16px 0;">분석 결과가 없습니다. "분석하기" 버튼을 클릭하세요.</p>';
    } else {
      contentArea.innerHTML = issues.map(issue => {
        const tagHtml = issue.tag ? `<span class="tag tag-${escapeHtml(issue.tag)}">${escapeHtml(issue.tag)}</span> ` : '';
        const priorityHtml = issue.priority ? `<span class="tag">${escapeHtml(issue.priority)}</span>` : '';
        return `<h3 id="${escapeHtml(issue.id)}">${escapeHtml(issue.id.toUpperCase())}. ${escapeHtml(issue.title)}</h3>` +
          `<div class="issue-meta" style="margin-bottom:6px;">${tagHtml}${priorityHtml}</div>` +
          `<div class="issue-body">${issue.html_content}</div>`;
      }).join('\n');

      injectIssueControls();

      // Register new h3s with intersection observer
      contentArea.querySelectorAll('h3[id]').forEach(el => obs.observe(el));
    }

    // Enable action buttons
    ['btn-analyze', 'btn-apply', 'btn-generate'].forEach(id => {
      document.getElementById(id)?.removeAttribute('disabled');
    });

    refreshUI();
  } catch (e) {
    console.error('Failed to load issues:', e);
  }
}

// ========== Collect current tab issue states ==========
function collectCurrentTabState() {
  return getIssueIds().map(id => {
    const s = getIssueState(id);
    return { id, status: s.status, memo: s.memo };
  });
}

// ========== Toast ==========
const _toast = document.createElement('div');
_toast.id = 'app-toast';
_toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a18;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;';
document.body.appendChild(_toast);
let toastTimer;
function showToast(msg, type) {
  clearTimeout(toastTimer);
  _toast.textContent = msg;
  _toast.style.background = type === 'error' ? '#7f1d1d' : '#1a1a18';
  _toast.style.opacity = '1';
  toastTimer = setTimeout(() => { _toast.style.opacity = '0'; }, 2500);
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
    serviceType: document.querySelector('input[name="service-type"]:checked')?.value,
    targets: [...document.querySelectorAll('input[name="target"]:checked')].map(el => el.value),
    revenues: [...document.querySelectorAll('input[name="revenue"]:checked')].map(el => el.value),
    features: [...document.querySelectorAll('input[name="feature"]:checked')].map(el => el.value),
    feTech: [...document.querySelectorAll('input[name="fe-tech"]:checked')].map(el => el.value),
    beTech: [...document.querySelectorAll('input[name="be-tech"]:checked')].map(el => el.value),
    dbTech: [...document.querySelectorAll('input[name="db-tech"]:checked')].map(el => el.value),
    detail,
  };
  const btn = document.getElementById('btn-generate-prd');
  btn.disabled = true;
  btn.textContent = 'PRD 생성 중...';
  try {
    const { jobId } = await API.post('/init', data);
    pollJob(jobId, async (err) => {
      btn.disabled = false;
      btn.textContent = 'PRD 생성하기';
      if (err) { showToast('PRD 생성 실패: ' + err.message, 'error'); return; }
      try {
        const prdData = await API.get('/init/prd');
        document.getElementById('prd-content').textContent = prdData.content || '';
        document.getElementById('init-screen').classList.add('hidden');
        document.getElementById('prd-preview').classList.remove('hidden');
      } catch (e2) {
        showToast('PRD 로드 실패: ' + e2.message, 'error');
      }
    });
  } catch (e) {
    showToast('PRD 생성에 실패했습니다: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'PRD 생성하기';
  }
});

document.getElementById('init-detail')?.addEventListener('input', () => {
  document.getElementById('init-detail').classList.remove('error');
  document.getElementById('init-detail-error').style.display = 'none';
});

document.getElementById('btn-start-review')?.addEventListener('click', async () => {
  document.getElementById('prd-preview').classList.add('hidden');
  document.querySelector('.tab-content')?.classList.remove('hidden');
  document.getElementById('btn-analyze')?.click();
});

// ========== Job Polling ==========
async function pollJob(jobId, onDone) {
  const interval = setInterval(async () => {
    try {
      const job = await API.get('/jobs/' + jobId);
      if (job.status === 'completed') {
        clearInterval(interval);
        document.getElementById('job-status')?.classList.add('hidden');
        onDone(null, job);
      } else if (job.status === 'failed') {
        clearInterval(interval);
        document.getElementById('job-status')?.classList.add('hidden');
        onDone(new Error(job.error || '작업 실패'));
      }
    } catch (e) { clearInterval(interval); }
  }, 1500);
}

function showJobStatus(msg) {
  const el = document.getElementById('job-status');
  if (!el) return;
  el.innerHTML = `<div class="spinner"></div> ${msg}`;
  el.classList.remove('hidden', 'error');
}

// ========== Action Buttons ==========
document.getElementById('btn-analyze')?.addEventListener('click', async () => {
  showJobStatus('분석 중...');
  try {
    const { jobId } = await API.post('/analyze', { tab: activeTab || 'review' });
    pollJob(jobId, (err) => {
      if (err) { showToast('분석 실패: ' + err.message, 'error'); return; }
      showToast('분석 완료!');
      loadIssues(activeTab);
    });
  } catch (e) { showToast('오류: ' + e.message, 'error'); }
});

document.getElementById('btn-apply')?.addEventListener('click', async () => {
  const issues = collectCurrentTabState();
  showJobStatus('반영하기 처리 중...');
  try {
    const { jobId } = await API.post('/apply', { tab: activeTab, issues });
    pollJob(jobId, (err) => {
      if (err) { showToast('반영 실패: ' + err.message, 'error'); return; }
      showToast('반영 완료!');
      loadIssues(activeTab);
    });
  } catch (e) { showToast('오류: ' + e.message, 'error'); }
});

document.getElementById('btn-generate')?.addEventListener('click', async () => {
  showJobStatus('문서 생성 중...');
  try {
    const { jobId, downloadUrl } = await API.post('/generate', { tab: activeTab });
    pollJob(jobId, (err) => {
      if (err) { showToast('문서 생성 실패: ' + err.message, 'error'); return; }
      showToast('문서 생성 완료!');
      if (downloadUrl) window.open(downloadUrl, '_blank');
    });
  } catch (e) { showToast('오류: ' + e.message, 'error'); }
});

function setClaudeStatus(available, text) {
  const el = document.getElementById('claude-status');
  if (!el) return;
  el.classList.remove('checking', 'connected', 'disconnected');
  el.classList.add(available ? 'connected' : 'disconnected');
  el.textContent = text;
}

// ========== Initial Load ==========
async function loadInitialState() {
  try {
    const workspace = await API.get('/workspace');

    const nameEl = document.getElementById('workspace-name');
    if (nameEl) nameEl.textContent = workspace.name || 'CodeForge Blueprint';

    setClaudeStatus(workspace.claudeAvailable, workspace.claudeAvailable ? 'Claude Code 연결됨' : 'Claude Code 연결 안 됨');

    if (workspace.prd_path) {
      document.getElementById('init-screen').classList.add('hidden');
      document.getElementById('prd-preview').classList.add('hidden');
      document.querySelector('.tab-content')?.classList.remove('hidden');
      ['btn-analyze', 'btn-apply', 'btn-generate'].forEach(id => {
        document.getElementById(id)?.removeAttribute('disabled');
      });
      loadIssues(activeTab);
    } else {
      document.getElementById('init-screen').classList.remove('hidden');
      document.querySelector('.tab-content')?.classList.add('hidden');
    }
  } catch (e) {
    console.error('Failed to load workspace:', e);
    document.getElementById('init-screen').classList.remove('hidden');
    document.querySelector('.tab-content')?.classList.add('hidden');
    setClaudeStatus(false, '서버 연결 실패');
  }
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

// ========== Boot ==========
loadInitialState();
