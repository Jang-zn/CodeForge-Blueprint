import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import {
  listBaselines,
  getAllBaselines,
  getActiveBaseline,
  getAllActiveBaselines,
  createBaseline,
  supersedeBaseline,
  checkFreezeReadiness,
  getUserFlows,
  getScreens,
  getScopeItems,
  type Tab,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const baselinesRoute = new Hono();

// GET /api/baselines — 전체 또는 탭별 baseline 목록
baselinesRoute.get('/', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab') as Tab | undefined;

  if (tab) {
    return c.json(listBaselines(db, tab));
  }

  return c.json(getAllBaselines(db));
});

// GET /api/baselines/active — 활성 baseline 조회 (tab별 또는 전체)
baselinesRoute.get('/active', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab') as Tab | undefined;

  if (tab) {
    const baseline = getActiveBaseline(db, tab);
    return c.json(baseline);
  }

  const all = getAllActiveBaselines(db);
  return c.json(all);
});

// GET /api/baselines/freeze-readiness — freeze 준비 상태 확인
baselinesRoute.get('/freeze-readiness', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab');

  if (!tab || typeof tab !== 'string') {
    return c.json({ error: 'tab is required' }, 400);
  }

  const result = checkFreezeReadiness(db, tab as Tab);
  return c.json(result);
});

// POST /api/baselines/freeze — baseline freeze 수행
baselinesRoute.post('/freeze', async (c) => {
  const { db } = requireRequestContext(c);
  const body = await c.req.json<{ tab: string; version?: string }>().catch(() => null);

  if (!body?.tab) {
    return c.json({ error: 'tab is required' }, 400);
  }

  const tab = body.tab as Tab;

  // freeze 준비 상태 확인
  const readiness = checkFreezeReadiness(db, tab);
  if (!readiness.ready) {
    return c.json(
      { error: 'Not ready to freeze', reasons: readiness.reasons },
      400
    );
  }

  // 현재 활성 baseline을 먼저 가져옴 (생성 전에)
  const currentActive = getActiveBaseline(db, tab);

  // 버전 결정
  let version = body.version;
  if (!version) {
    if (currentActive) {
      // patch version +1
      const parts = currentActive.version.split('.');
      const patch = parseInt(parts[2] || '0', 10) + 1;
      version = `${parts[0]}.${parts[1]}.${patch}`;
    } else {
      version = '1.0.0';
    }
  }

  // 문서 스냅샷 가져오기 — 실제 파일 내용 + 구조화 데이터 포함
  let docSnapshot: string | null = null;
  const latestDoc = db.prepare(
    `SELECT * FROM documents WHERE tab = ? ORDER BY created_at DESC LIMIT 1`
  ).get(tab);
  if (latestDoc) {
    let content: string | null = null;
    try {
      if (latestDoc.file_path) {
        if (latestDoc.file_path.endsWith('index.md')) {
          const folderPath = path.dirname(latestDoc.file_path);
          if (fs.statSync(folderPath).isDirectory()) {
            const mdFiles = fs.readdirSync(folderPath).filter((f: string) => f.endsWith('.md')).sort();
            content = mdFiles.map((f: string) => fs.readFileSync(path.join(folderPath, f), 'utf-8')).join('\n\n---\n\n');
          }
        }
        if (!content) {
          content = fs.readFileSync(latestDoc.file_path, 'utf-8');
        }
      }
    } catch { /* 파일 읽기 실패 시 null */ }

    const structuredData: any = {};
    try {
      const flows = getUserFlows(db, tab);
      const screens = getScreens(db, tab);
      const scopeItems = getScopeItems(db, tab);
      if (flows.length > 0) structuredData.flows = flows;
      if (screens.length > 0) structuredData.screens = screens;
      if (scopeItems.length > 0) structuredData.scopeItems = scopeItems;
    } catch { /* 구조화 데이터 없으면 무시 */ }

    docSnapshot = JSON.stringify({ document: latestDoc, content, structuredData });
  }

  // 새 baseline 생성 + 이전 baseline supersede를 단일 트랜잭션으로 처리
  const baseline = db.transaction(() => {
    const created = createBaseline(db, tab, version as string, docSnapshot);
    if (currentActive) {
      supersedeBaseline(db, currentActive.id, created.id);
    }
    return created;
  })();

  return c.json(baseline, 201);
});

export default baselinesRoute;
