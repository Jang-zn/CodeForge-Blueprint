import { Hono } from 'hono';
import { getDb } from '../../db/index.js';
import {
  getIssues,
  updateIssueStatus,
  getDecisionLogs,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';

const issuesRoute = new Hono();

// GET /api/issues?tab=review
issuesRoute.get('/', (c) => {
  const db = getDb();
  const tab = c.req.query('tab') as Tab | undefined;
  const issues = getIssues(db, tab);
  return c.json({ issues });
});

// GET /api/issues/:id/logs
issuesRoute.get('/:id/logs', (c) => {
  const db = getDb();
  const logs = getDecisionLogs(db, c.req.param('id'));
  return c.json({ logs });
});

// PUT /api/issues/:id — status/memo 업데이트
issuesRoute.put('/:id', async (c) => {
  const db = getDb();
  const id = c.req.param('id');
  const body = await c.req.json<{ status: IssueStatus; memo: string }>();
  updateIssueStatus(db, id, body.status, body.memo ?? '');
  return c.json({ ok: true });
});

export default issuesRoute;
