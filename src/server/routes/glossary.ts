import { Hono } from 'hono';
import {
  getGlossaryTerms,
  upsertGlossaryTerm,
  deleteGlossaryTerm,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const glossaryRoute = new Hono();

// GET /api/glossary — 전체 용어 목록 (?category= 필터)
glossaryRoute.get('/', (c) => {
  const { db } = requireRequestContext(c);
  const category = c.req.query('category');
  return c.json(getGlossaryTerms(db, category));
});

// POST /api/glossary — 용어 추가
glossaryRoute.post('/', async (c) => {
  const { db } = requireRequestContext(c);
  const body = await c.req.json<{ term: string; definition: string; category?: string; aliases?: string }>().catch(() => null);
  if (!body?.term || !body?.definition) {
    return c.json({ error: 'term and definition are required' }, 400);
  }
  const created = upsertGlossaryTerm(db, {
    term: body.term.trim(),
    definition: body.definition.trim(),
    category: body.category?.trim() ?? null,
    aliases: body.aliases?.trim() ?? null,
  });
  return c.json(created, 201);
});

// PUT /api/glossary/:id — 용어 수정
glossaryRoute.put('/:id', async (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{ term: string; definition: string; category?: string; aliases?: string }>().catch(() => null);
  if (!body?.term || !body?.definition) {
    return c.json({ error: 'term and definition are required' }, 400);
  }
  const updated = upsertGlossaryTerm(db, {
    id,
    term: body.term.trim(),
    definition: body.definition.trim(),
    category: body.category?.trim() ?? null,
    aliases: body.aliases?.trim() ?? null,
  });
  return c.json(updated);
});

// DELETE /api/glossary/:id — 용어 삭제
glossaryRoute.delete('/:id', (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'), 10);
  deleteGlossaryTerm(db, id);
  return c.json({ ok: true });
});

export default glossaryRoute;
