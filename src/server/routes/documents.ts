import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import {
  getDocTypes,
  getDocType,
  getDocByType,
  getDocSections,
  createTypedDocument,
  upsertDocSection,
  assembleMarkdown,
  getDocuments,
  getDocument,
  updateDocumentSummary,
  parseSectionsFromMarkdown,
  type TemplateSectionDef,
} from '../../db/repository.js';
import { buildContextPackage } from '../../claude/context-package.js';
import { requireRequestContext } from '../context.js';

const documentsRoute = new Hono();

// GET /api/doc-types — 문서 유형 목록
documentsRoute.get('/types', (c) => {
  const { db } = requireRequestContext(c);
  const types = getDocTypes(db);
  return c.json(types.map(t => ({
    slug: t.slug,
    label: t.label,
    sort_order: t.sort_order,
    sections: JSON.parse(t.template_sections) as TemplateSectionDef[],
  })));
});

// GET /api/documents — 전체 문서 목록 (?type= 필터)
documentsRoute.get('/', (c) => {
  const { db } = requireRequestContext(c);
  const docType = c.req.query('type');
  const docs = getDocuments(db);
  const filtered = docType ? docs.filter(d => d.doc_type === docType) : docs;
  return c.json(filtered);
});

// GET /api/documents/context-package?profile=review
documentsRoute.get('/context-package', (c) => {
  const { db, workspace } = requireRequestContext(c);
  const profile = c.req.query('profile') ?? 'default';
  const pkg = buildContextPackage(db, workspace.docsPath, profile);
  return c.json(pkg);
});

// GET /api/documents/by-type/:type — 해당 유형의 최신 문서
documentsRoute.get('/by-type/:type', (c) => {
  const { db } = requireRequestContext(c);
  const docType = c.req.param('type');
  const doc = getDocByType(db, docType);
  if (!doc) return c.json({ error: 'Not found' }, 404);
  const sections = getDocSections(db, doc.id);
  return c.json({ ...doc, sections });
});

// GET /api/documents/:id — 단일 문서 + 섹션
documentsRoute.get('/:id', (c) => {
  const { db } = requireRequestContext(c);
  const id = parseInt(c.req.param('id'), 10);
  const doc = getDocument(db, id);
  if (!doc) return c.json({ error: 'Not found' }, 404);
  const sections = getDocSections(db, doc.id);
  return c.json({ ...doc, sections });
});

// POST /api/documents — 새 typed 문서 생성
documentsRoute.post('/', async (c) => {
  const { db, workspace } = requireRequestContext(c);
  const body = await c.req.json<{ doc_type: string; sections?: Record<string, string> }>().catch(() => null);
  if (!body?.doc_type) return c.json({ error: 'doc_type is required' }, 400);

  const docType = getDocType(db, body.doc_type);
  if (!docType) return c.json({ error: `Unknown doc_type: ${body.doc_type}` }, 400);

  // 기존 문서가 있으면 반환 (싱글톤)
  const existing = getDocByType(db, body.doc_type);
  if (existing) {
    if (body.sections) {
      for (const [key, content] of Object.entries(body.sections)) {
        upsertDocSection(db, existing.id, key, content);
      }
      const markdown = assembleMarkdown(db, existing.id);
      fs.writeFileSync(existing.file_path, markdown, 'utf-8');
    }
    return c.json({ id: existing.id, created: false });
  }

  const filePath = path.join(workspace.docsPath, `${body.doc_type}.md`);
  fs.mkdirSync(workspace.docsPath, { recursive: true });

  const docId = createTypedDocument(db, body.doc_type, filePath);

  if (body.sections) {
    for (const [key, content] of Object.entries(body.sections)) {
      upsertDocSection(db, docId, key, content);
    }
  }

  const markdown = assembleMarkdown(db, docId);
  fs.writeFileSync(filePath, markdown, 'utf-8');

  return c.json({ id: docId, created: true });
});

// PUT /api/documents/:id/sections/:key — 섹션 저장 → .md 재조립
documentsRoute.put('/:id/sections/:key', async (c) => {
  const { db } = requireRequestContext(c);
  const docId = parseInt(c.req.param('id'), 10);
  const sectionKey = c.req.param('key');
  const body = await c.req.json<{ content: string }>().catch(() => null);
  if (body?.content === undefined) return c.json({ error: 'content is required' }, 400);

  upsertDocSection(db, docId, sectionKey, body.content);

  // .md 파일 재조립
  const doc = getDocument(db, docId);
  if (doc) {
    const markdown = assembleMarkdown(db, docId);
    if (markdown) fs.writeFileSync(doc.file_path, markdown, 'utf-8');
  }

  return c.json({ ok: true });
});

// PUT /api/documents/:id/summary — 요약 저장
documentsRoute.put('/:id/summary', async (c) => {
  const { db } = requireRequestContext(c);
  const docId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{ summary: string }>().catch(() => null);
  if (!body?.summary) return c.json({ error: 'summary is required' }, 400);
  updateDocumentSummary(db, docId, body.summary);
  return c.json({ ok: true });
});

// POST /api/documents/import/:type — .md 파일에서 섹션 파싱해서 import
documentsRoute.post('/import/:type', async (c) => {
  const { db, workspace } = requireRequestContext(c);
  const docType = c.req.param('type');
  const body = await c.req.json<{ content: string }>().catch(() => null);
  if (!body?.content) return c.json({ error: 'content is required' }, 400);

  const typeDef = getDocType(db, docType);
  if (!typeDef) return c.json({ error: `Unknown doc_type: ${docType}` }, 400);

  const templateSections: TemplateSectionDef[] = JSON.parse(typeDef.template_sections);
  const parsedSections = parseSectionsFromMarkdown(body.content, templateSections);

  let doc = getDocByType(db, docType);
  if (!doc) {
    const filePath = path.join(workspace.docsPath, `${docType}.md`);
    fs.mkdirSync(workspace.docsPath, { recursive: true });
    const docId = createTypedDocument(db, docType, filePath);
    doc = getDocument(db, docId);
  }
  if (!doc) return c.json({ error: 'Failed to create document' }, 500);

  for (const [key, content] of Object.entries(parsedSections)) {
    upsertDocSection(db, doc.id, key, content);
  }

  const markdown = assembleMarkdown(db, doc.id);
  fs.writeFileSync(doc.file_path, markdown, 'utf-8');

  return c.json({ ok: true, id: doc.id, sections: Object.keys(parsedSections) });
});

export default documentsRoute;
