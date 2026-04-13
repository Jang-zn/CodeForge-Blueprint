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

issuesRoute.get('/recommendations', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab') as Tab | undefined;
  if (!tab) return c.json({ error: 'tab 파라미터가 필요합니다.' }, 400);
  const issues = getIssues(db, tab);
  const recommendations = computeRecommendations(issues);
  return c.json(recommendations);
});

issuesRoute.put('/:id', async (c) => {
  const { db } = requireRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ status: IssueStatus; memo: string }>();

  const issue = getIssue(db, id);
  const appliedStatus = issue?.status ?? 'pending';
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
