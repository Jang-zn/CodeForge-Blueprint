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

interface StageInfo {
  tab: Tab;
  label: string;
  isLocked: boolean;
  activeBaseline: any | null;
  requiredBaselines: Tab[];
  missingBaselines: Tab[];
  freezeReadiness?: { ready: boolean; blockingReasons: string[]; warnings: string[] };
}

// GET /api/workflow/stages — 전체 파이프라인 상태
workflowRoute.get('/stages', (c) => {
  const { db } = requireRequestContext(c);
  const activeMap = getAllActiveBaselines(db);

  const stages: StageInfo[] = PIPELINE_ORDER.map((tab) => {
    const required = PIPELINE_REQUIRED_BASELINES[tab] || [];
    const missing = required.filter((t) => !activeMap[t]);
    const isLocked = missing.length > 0;

    // freeze 가능 상태 체크: 잠기지 않았고 아직 baseline이 없는 탭에만 표시
    // activeMap을 그대로 전달해 getAllActiveBaselines 재조회 방지
    let freezeReadiness: StageInfo['freezeReadiness'];
    if (!isLocked && !activeMap[tab]) {
      const r = checkFreezeReadiness(db, tab, activeMap);
      freezeReadiness = { ready: r.ready, blockingReasons: r.blockingReasons, warnings: r.warnings };
    }

    return {
      tab,
      label: TAB_LABELS[tab],
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
