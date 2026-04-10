import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import {
  listPerspectives,
  getActivePerspectives,
  getPerspective,
  addCustomPerspective,
  updateCustomPerspective,
  deleteCustomPerspective,
  toggleActivePerspective,
  type CustomPerspectiveInput,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

function exportPerspectivesJson(db: any, docsPath: string): void {
  try {
    const allPerspectives = listPerspectives(db);
    const dir = path.join(docsPath, '.codeforge');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'perspectives.json'),
      JSON.stringify(allPerspectives, null, 2),
      'utf-8',
    );
  } catch {
    // non-fatal — SKILL.md will fall back to inline defaults
  }
}

const perspectivesRoute = new Hono();

perspectivesRoute.get('/', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab');
  const perspectives = listPerspectives(db, tab);
  return c.json({ perspectives });
});

perspectivesRoute.get('/active', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.query('tab');
  if (!tab) return c.json({ error: 'tab 파라미터가 필요합니다.' }, 400);
  const perspectives = getActivePerspectives(db, tab);
  return c.json({ perspectives });
});

perspectivesRoute.get('/:id', (c) => {
  const { db } = requireRequestContext(c);
  const perspective = getPerspective(db, c.req.param('id'));
  if (!perspective) return c.json({ error: 'Perspective not found' }, 404);
  return c.json({ perspective });
});

perspectivesRoute.post('/', async (c) => {
  const { db, workspace } = requireRequestContext(c);
  const body = await c.req.json<CustomPerspectiveInput>().catch(() => null);
  if (!body) return c.json({ error: '요청 본문이 필요합니다.' }, 400);

  const { tab, name, description, prompt_instruction, id_prefix } = body;
  if (!tab || !name || !description || !prompt_instruction || !id_prefix) {
    return c.json({ error: 'tab, name, description, prompt_instruction, id_prefix는 필수입니다.' }, 400);
  }

  const perspective = addCustomPerspective(db, body);
  exportPerspectivesJson(db, workspace.docsPath);
  return c.json({ perspective }, 201);
});

perspectivesRoute.put('/:id', async (c) => {
  const { db } = requireRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.json<Partial<CustomPerspectiveInput>>().catch(() => null);
  if (!body) return c.json({ error: '요청 본문이 필요합니다.' }, 400);

  try {
    const perspective = updateCustomPerspective(db, id, body);
    return c.json({ perspective });
  } catch (err: any) {
    if (err.message.includes('not found')) return c.json({ error: 'Perspective not found' }, 404);
    if (err.message.includes('locked')) return c.json({ error: 'Perspective is locked' }, 409);
    throw err;
  }
});

perspectivesRoute.delete('/:id', (c) => {
  const { db } = requireRequestContext(c);
  const id = c.req.param('id');
  const existing = getPerspective(db, id);
  if (!existing) return c.json({ error: 'Perspective not found' }, 404);

  try {
    deleteCustomPerspective(db, id);
    return c.body(null, 204);
  } catch (err: any) {
    if (err.message.includes('locked')) return c.json({ error: 'Perspective is locked' }, 409);
    throw err;
  }
});

perspectivesRoute.put('/:id/toggle', async (c) => {
  const { db } = requireRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ active: boolean }>().catch(() => null);
  if (!body || typeof body.active !== 'boolean') {
    return c.json({ error: 'active(boolean) 필드가 필요합니다.' }, 400);
  }

  try {
    toggleActivePerspective(db, id, body.active);
    const perspective = getPerspective(db, id);
    return c.json({ perspective });
  } catch (err: any) {
    if (err.message.includes('not found')) return c.json({ error: 'Perspective not found' }, 404);
    if (err.message.includes('cannot be deactivated')) return c.json({ error: '기본 관점은 비활성화할 수 없습니다.' }, 409);
    throw err;
  }
});

perspectivesRoute.get('/recommend/:tab', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.param('tab');

  // Recommendation engine: suggest custom perspectives based on:
  // 1. Perspectives with is_locked=0 (unlocked custom perspectives)
  // 2. Simple heuristic: return all unlocked perspectives for the tab
  // (Future: could add ML-based recommendation based on project characteristics)
  const allPerspectives = listPerspectives(db, tab);
  const unlocked = allPerspectives.filter(p => p.is_locked === 0);
  const locked = allPerspectives.filter(p => p.is_locked === 1);

  return c.json({
    recommended: unlocked.slice(0, 3), // Return top 3 unlocked perspectives
    available: allPerspectives,
    lockedCount: locked.length,
  });
});

export default perspectivesRoute;
