import { Hono } from 'hono';
import {
  getIssues,
  updateIssueStatus,
  getDecisionLogs,
  getDecisionLogsBulk,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';
import { computeRecommendations } from '../recommendation.js';

const issuesRoute = new Hono();

issuesRoute.get('/', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab') as Tab | undefined;
  const issues = getIssues(db, tab);
  const logsByIssue = getDecisionLogsBulk(db, issues.map(issue => issue.id));
  return c.json({ issues: issues.map(issue => ({ ...issue, logs: logsByIssue[issue.id] ?? [] })) });
});

issuesRoute.get('/:id/logs', (c) => {
  const { db } = requireRequestContext(c);
  const logs = getDecisionLogs(db, c.req.param('id'));
  return c.json({ logs });
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
  updateIssueStatus(db, id, body.status, body.memo ?? '', { updated_by: 'user' });
  return c.json({ ok: true });
});

export default issuesRoute;
