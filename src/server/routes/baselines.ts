import { Hono } from 'hono';
import {
  listBaselines,
  getAllBaselines,
  getActiveBaseline,
  getAllActiveBaselines,
  createBaseline,
  supersedeBaseline,
  checkFreezeReadiness,
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

  // 문서 스냅샷 가져오기
  let docSnapshot: string | null = null;
  const latestDoc = db.prepare(
    `SELECT * FROM documents WHERE tab = ? ORDER BY created_at DESC LIMIT 1`
  ).get(tab);
  if (latestDoc) {
    docSnapshot = JSON.stringify(latestDoc);
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
