import { Hono } from 'hono';
import { getAllActiveBaselines, checkFreezeReadiness, PIPELINE_REQUIRED_BASELINES, type Tab } from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const workflowRoute = new Hono();

const PIPELINE_ORDER: Tab[] = ['review', 'ux', 'backend', 'frontend', 'features'];

const TAB_LABELS: Record<Tab, string> = {
  review: '기획 리뷰',
  ux: 'UX 설계',
  backend: 'BE 설계',
  frontend: 'FE 설계',
  features: '다음버전',
};

type StageStatus =
  | 'locked'           // 선행 baseline 부족
  | 'not_ready'        // 잠기지 않았지만 freeze 불가 (문서 없음 등)
  | 'ready_to_freeze'  // 처음 freeze 가능
  | 'frozen'           // active baseline 있음, re-freeze 불가
  | 'ready_to_refreeze'; // active baseline 있음, re-freeze 가능

interface StageInfo {
  tab: Tab;
  label: string;
  status: StageStatus;
  isLocked: boolean;
  activeBaseline: any | null;
  requiredBaselines: Tab[];
  missingBaselines: Tab[];
  freezeReadiness: { ready: boolean; blockingReasons: string[]; warnings: string[] } | null;
}

// GET /api/workflow/stages — 전체 파이프라인 상태
workflowRoute.get('/stages', (c) => {
  const { db } = requireRequestContext(c);
  const activeMap = getAllActiveBaselines(db);

  const stages: StageInfo[] = PIPELINE_ORDER.map((tab) => {
    const required = PIPELINE_REQUIRED_BASELINES[tab] || [];
    const missing = required.filter((t) => !activeMap[t]);
    const isLocked = missing.length > 0;

    // 잠기지 않은 탭은 항상 freeze readiness 체크 (초기/re-freeze 모두)
    let freezeReadiness: StageInfo['freezeReadiness'] = null;
    let status: StageStatus;

    if (isLocked) {
      status = 'locked';
    } else {
      const r = checkFreezeReadiness(db, tab, activeMap);
      freezeReadiness = { ready: r.ready, blockingReasons: r.blockingReasons, warnings: r.warnings };

      const hasFrozen = !!activeMap[tab];
      if (hasFrozen) {
        status = r.ready ? 'ready_to_refreeze' : 'frozen';
      } else {
        status = r.ready ? 'ready_to_freeze' : 'not_ready';
      }
    }

    return {
      tab,
      label: TAB_LABELS[tab],
      status,
      isLocked,
      activeBaseline: activeMap[tab] ?? null,
      requiredBaselines: required,
      missingBaselines: missing,
      freezeReadiness,
    };
  });

  return c.json({ stages });
});

export default workflowRoute;
