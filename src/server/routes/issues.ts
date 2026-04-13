import { Hono } from 'hono';
import {
  getIssues,
  getIssue,
  getIssuesWithDrafts,
  createIssuePreview,
  deleteIssuePreview,
  updateIssueStatus,
  getDecisionLogs,
  getDecisionLogsBulk,
  getIssueSnapshots,
  getIssueTimeline,
  getCurrentCycle,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';
import { computeRecommendations } from '../recommendation.js';

const issuesRoute = new Hono();

issuesRoute.get('/', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab') as Tab | undefined;
  const issues = getIssuesWithDrafts(db, tab);
  const logsByIssue = getDecisionLogsBulk(db, issues.map(issue => issue.id));
  const has_pending_drafts = issues.some(i => i.draft_status != null);
  return c.json({
    issues: issues.map(issue => ({ ...issue, logs: logsByIssue[issue.id] ?? [] })),
    has_pending_drafts,
  });
});

issuesRoute.get('/cycle', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab') as Tab | undefined;
  if (!tab) return c.json({ error: '탭이 필요합니다.' }, 400);
  const cycle = getCurrentCycle(db, tab);
  return c.json({ cycle });
});

issuesRoute.get('/:id/logs', (c) => {
  const { db } = requireRequestContext(c);
  const logs = getDecisionLogs(db, c.req.param('id'));
  return c.json({ logs });
});

issuesRoute.get('/:id/snapshots', (c) => {
  const { db } = requireRequestContext(c);
  const snapshots = getIssueSnapshots(db, c.req.param('id'));
  return c.json({ snapshots });
});

issuesRoute.get('/:id/timeline', (c) => {
  const { db } = requireRequestContext(c);
  const entries = getIssueTimeline(db, c.req.param('id'));
  return c.json({ entries });
});

issuesRoute.get('/recommendations', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab') as Tab | undefined;
  if (!tab) return c.json({ error: 'tab 파라미터가 필요합니다.' }, 400);
  const issues = getIssues(db, tab);
  const recommendations = computeRecommendations(issues);
  return c.json(recommendations);
});

const FEATURES_ONLY_STATUSES: Set<IssueStatus> = new Set(['candidate', 'promoted', 'archived']);

issuesRoute.put('/:id', async (c) => {
  const { db } = requireRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ status: IssueStatus; memo: string }>();

  const issue = getIssue(db, id);
  if (!issue) return c.json({ error: '이슈를 찾을 수 없습니다.' }, 404);

  // Tab-aware status validation: candidate/promoted/archived only allowed on features tab
  if (FEATURES_ONLY_STATUSES.has(body.status) && issue.tab !== 'features') {
    return c.json({ error: `"${body.status}" 상태는 features 탭에서만 사용할 수 있습니다.` }, 400);
  }

  const appliedStatus = issue.status ?? 'pending';
  const memoEmpty = !body.memo?.trim();

  if (body.status === appliedStatus && memoEmpty) {
    deleteIssuePreview(db, id);
  } else {
    createIssuePreview(db, id, body.status, body.memo ?? '');
  }

  return c.json({ ok: true });
});

issuesRoute.delete('/:id/draft', (c) => {
  const { db } = requireRequestContext(c);
  deleteIssuePreview(db, c.req.param('id'));
  return c.json({ ok: true });
});

export default issuesRoute;
