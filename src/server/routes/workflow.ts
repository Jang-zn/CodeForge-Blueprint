import { Hono } from 'hono';
import { getActiveBaseline, getAllActiveBaselines, PIPELINE_REQUIRED_BASELINES, type Tab } from '../../db/repository.js';
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
}

// GET /api/workflow/stages — 전체 파이프라인 상태
workflowRoute.get('/stages', (c) => {
  const { db } = requireRequestContext(c);
  const activeMap = getAllActiveBaselines(db);

  const stages: StageInfo[] = PIPELINE_ORDER.map((tab) => {
    const required = PIPELINE_REQUIRED_BASELINES[tab] || [];
    const missing = required.filter((t) => !activeMap[t]);

    return {
      tab,
      label: TAB_LABELS[tab],
      isLocked: missing.length > 0,
      activeBaseline: activeMap[tab] ?? null,
      requiredBaselines: required,
      missingBaselines: missing,
    };
  });

  return c.json({ stages });
});

export default workflowRoute;
