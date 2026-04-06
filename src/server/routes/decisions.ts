import { Hono } from 'hono';
import {
  getDecisionTimeline,
  getDecisionStats,
  getDeferredReminders,
  DEFERRED_REMINDER_DAYS,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const decisionsRoute = new Hono();

decisionsRoute.get('/', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab') || undefined;
  const status = c.req.query('status') || undefined;
  const from = c.req.query('from') || undefined;
  const to = c.req.query('to') || undefined;
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const { decisions, total } = getDecisionTimeline(db, { tab, status, from, to, page, limit });
  const stats = getDecisionStats(db);
  const deferredReminders = getDeferredReminders(db, DEFERRED_REMINDER_DAYS);

  return c.json({ decisions, total, stats, deferredReminders });
});

export default decisionsRoute;
