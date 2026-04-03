import { Hono } from 'hono';
import { getDb } from '../../db/index.js';
import { upsertWorkspaceMeta } from '../../db/repository.js';

const workspaceRoute = new Hono();

// PATCH /api/workspace — prd_path 등 메타 업데이트
workspaceRoute.patch('/', async (c) => {
  const db = getDb();
  const body = await c.req.json<{ prd_path?: string; tech_stack_path?: string; name?: string }>();
  upsertWorkspaceMeta(db, body);
  return c.json({ ok: true });
});

export default workspaceRoute;
