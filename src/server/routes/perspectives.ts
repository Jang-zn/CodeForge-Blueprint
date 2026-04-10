import { Hono } from 'hono';
import {
  getPerspectives,
  getPerspective,
  createPerspective,
  updatePerspective,
  deletePerspective,
  lockPerspective,
  unlockPerspective,
  type PerspectiveInput,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const perspectivesRoute = new Hono();

perspectivesRoute.get('/', (c) => {
  const { db } = requireRequestContext(c);
  const type = c.req.query('type');
  const perspectives = getPerspectives(db, type);
  return c.json({ perspectives });
});

perspectivesRoute.get('/:id', (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'), 10);
  const perspective = getPerspective(db, id);
  if (!perspective) return c.json({ error: 'Perspective not found' }, 404);
  return c.json({ perspective });
});

perspectivesRoute.post('/', async (c) => {
  const { db } = requireRequestContext(c);
  const body = await c.req.json<PerspectiveInput>();

  if (!body.type || !body.name) {
    return c.json({ error: 'type과 name은 필수입니다.' }, 400);
  }

  try {
    const perspective = createPerspective(db, body);
    return c.json({ perspective }, 201);
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: `${body.type}에 이미 "${body.name}" 관점이 존재합니다.` }, 409);
    }
    throw err;
  }
});

perspectivesRoute.put('/:id', async (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<Partial<PerspectiveInput>>();

  try {
    const perspective = updatePerspective(db, id, body);
    return c.json({ perspective });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return c.json({ error: 'Perspective not found' }, 404);
    }
    if (err.message.includes('locked')) {
      return c.json({ error: 'Perspective is locked' }, 409);
    }
    if (err.message.includes('UNIQUE constraint failed')) {
      return c.json({ error: '이미 같은 이름의 관점이 존재합니다.' }, 409);
    }
    throw err;
  }
});

perspectivesRoute.delete('/:id', (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'), 10);
  const perspective = getPerspective(db, id);
  if (!perspective) {
    return c.json({ error: 'Perspective not found' }, 404);
  }

  try {
    deletePerspective(db, id);
    return c.body(null, 204);
  } catch (err: any) {
    if (err.message.includes('locked')) {
      return c.json({ error: 'Perspective is locked' }, 409);
    }
    throw err;
  }
});

perspectivesRoute.post('/:id/lock', (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'), 10);
  const perspective = getPerspective(db, id);
  if (!perspective) {
    return c.json({ error: 'Perspective not found' }, 404);
  }

  const locked = lockPerspective(db, id);
  return c.json({ perspective: locked });
});

perspectivesRoute.post('/:id/unlock', (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'), 10);
  const perspective = getPerspective(db, id);
  if (!perspective) {
    return c.json({ error: 'Perspective not found' }, 404);
  }

  const unlocked = unlockPerspective(db, id);
  return c.json({ perspective: unlocked });
});

perspectivesRoute.get('/export/json', (c) => {
  const { db } = requireRequestContext(c);
  const type = c.req.query('type');
  const perspectives = getPerspectives(db, type);
  c.header('Content-Type', 'application/json');
  return c.json(perspectives);
});

export default perspectivesRoute;
