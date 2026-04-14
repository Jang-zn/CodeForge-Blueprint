import { Hono } from 'hono';
import {
  getIssues,
  getAllActiveBaselines,
  PIPELINE_REQUIRED_BASELINES,
  type Tab,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const validateRoute = new Hono();

// POST /api/validate/stage — 탭별 freeze 전 유효성 검사
validateRoute.post('/stage', async (c) => {
  const { db } = requireRequestContext(c);
  const body = await c.req.json<{ tab: string }>().catch(() => null);

  if (!body?.tab) {
    return c.json({ error: 'tab is required' }, 400);
  }

  const tab = body.tab as Tab;
  const issues: string[] = [];

  // 해당 탭 이슈 중 status='open' P0 이슈 있는지 확인
  const allIssues = getIssues(db, tab);
  const openP0Issues = allIssues.filter(
    issue => issue.status === 'pending' && issue.priority === 'P0'
  );
  if (openP0Issues.length > 0) {
    issues.push(`${openP0Issues.length}개의 미해결 P0 이슈가 있습니다.`);
  }

  const required = PIPELINE_REQUIRED_BASELINES[tab] || [];
  if (required.length > 0) {
    const activeMap = getAllActiveBaselines(db);
    for (const requiredTab of required) {
      if (!activeMap[requiredTab]) {
        issues.push(`${requiredTab} 탭의 활성 baseline이 필요합니다.`);
      }
    }
  }

  return c.json({
    valid: issues.length === 0,
    issues,
  });
});

// POST /api/validate/final-delivery — 패키지 일관성 검증
validateRoute.post('/final-delivery', (c) => {
  const { db } = requireRequestContext(c);
  const issues: string[] = [];

  // 필수 4개 탭 active baseline 존재 여부 확인 (features는 선택)
  const activeBaselines = getAllActiveBaselines(db);
  const requiredTabs: Tab[] = ['review', 'ux', 'backend', 'frontend'];
  const allDeliveryTabs: Tab[] = ['review', 'ux', 'backend', 'frontend', 'features'];
  const missingTabs = requiredTabs.filter(tab => !activeBaselines[tab]);

  if (missingTabs.length > 0) {
    issues.push(`활성 baseline이 없는 탭: ${missingTabs.join(', ')}`);
  }

  // screen/flow 참조 검증 — frozen baseline의 doc_snapshot에서 읽어야 delivery와 일치
  const allScreens: any[] = [];
  const allFlowIds = new Set<string>();
  for (const tab of allDeliveryTabs) {
    const baseline = activeBaselines[tab];
    if (!baseline) continue;
    if (!baseline.doc_snapshot) {
      if (requiredTabs.includes(tab as Tab)) {
        issues.push(`${tab} 탭의 baseline에 스냅샷 데이터가 없습니다. 다시 freeze하세요.`);
      }
      continue;
    }
    try {
      const sd = JSON.parse(baseline.doc_snapshot).structuredData ?? {};
      for (const screen of sd.screens ?? []) allScreens.push(screen);
      for (const flow of sd.flows ?? []) allFlowIds.add(flow.flow_id);
    } catch {
      if (requiredTabs.includes(tab as Tab)) {
        issues.push(`${tab} 탭의 baseline 스냅샷을 파싱할 수 없습니다. 다시 freeze하세요.`);
      }
    }
  }

  for (const screen of allScreens) {
    if (screen.flow_ids_json && Array.isArray(screen.flow_ids_json)) {
      for (const flowId of screen.flow_ids_json) {
        if (!allFlowIds.has(flowId)) {
          issues.push(
            `Screen "${screen.screen_id}"가 존재하지 않는 flow "${flowId}"을 참조합니다.`
          );
        }
      }
    }
  }

  return c.json({
    valid: issues.length === 0,
    issues,
  });
});

export default validateRoute;
