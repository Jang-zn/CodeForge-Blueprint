import fs from 'fs';
import path from 'path';
import {
  getDocByType,
  getDocSections,
  getDocType,
  getRecentDecisionLogs,
  getRefItems,
  buildGlossaryMarkdown,
  assembleMarkdown,
} from '../db/repository.js';

export interface ContextPackage {
  projectOverview?: string;
  aiGuide?: string;
  glossary?: string;
  prd?: string;
  decisions?: { date: string; status: string; memo: string; reason?: string | null }[];
  refItems?: string[];
}

type ContextProfile = 'default' | 'review' | 'backend' | 'frontend' | 'features';

const PROFILE_DOCS: Record<ContextProfile, string[]> = {
  default:  ['project-overview', 'ai-guide', 'glossary'],
  review:   ['project-overview', 'ai-guide', 'glossary', 'prd'],
  backend:  ['project-overview', 'ai-guide', 'glossary', 'prd', 'decisions:recent'],
  frontend: ['project-overview', 'ai-guide', 'glossary', 'prd', 'ref-items', 'decisions:recent'],
  features: ['project-overview', 'ai-guide', 'glossary', 'prd', 'decisions:deferred'],
};

function readDocContent(db: any, docType: string, docsPath: string): string | undefined {
  const doc = getDocByType(db, docType);
  if (!doc) return undefined;

  // 섹션이 있으면 DB에서 조립, 없으면 디스크 파일 읽기
  const sections = getDocSections(db, doc.id);
  if (sections.length > 0) {
    const content = assembleMarkdown(db, doc.id);
    if (content) return content;
  }

  // 디스크 파일 fallback
  const filePath = path.isAbsolute(doc.file_path)
    ? doc.file_path
    : path.join(docsPath, doc.file_path);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

export function buildContextPackage(
  db: any,
  docsPath: string,
  profile: string,
  legacyPrdPath?: string | null,
): ContextPackage {
  const ctx: ContextPackage = {};
  const includes = PROFILE_DOCS[profile as ContextProfile] ?? PROFILE_DOCS.default;

  for (const item of includes) {
    if (item === 'project-overview') {
      ctx.projectOverview = readDocContent(db, 'project-overview', docsPath);
    } else if (item === 'ai-guide') {
      ctx.aiGuide = readDocContent(db, 'ai-guide', docsPath);
    } else if (item === 'glossary') {
      const glossaryDoc = readDocContent(db, 'glossary', docsPath);
      const termsMarkdown = buildGlossaryMarkdown(db);
      ctx.glossary = termsMarkdown || glossaryDoc;
    } else if (item === 'prd') {
      const prdDoc = readDocContent(db, 'prd', docsPath);
      if (prdDoc) {
        ctx.prd = prdDoc;
      } else if (legacyPrdPath && fs.existsSync(legacyPrdPath)) {
        // 레거시 워크스페이스: prd_path 파일 사용
        ctx.prd = fs.readFileSync(legacyPrdPath, 'utf-8');
      }
    } else if (item === 'ref-items') {
      const refItems = getRefItems(db);
      if (refItems.length > 0) ctx.refItems = refItems.map(r => r.content);
    } else if (item === 'decisions:recent') {
      const logs = getRecentDecisionLogs(db, ['resolved', 'deferred']);
      if (logs.length > 0) {
        ctx.decisions = logs.map(log => ({
          date: log.date,
          status: log.status,
          memo: log.memo,
          reason: log.reason,
        }));
      }
    } else if (item === 'decisions:deferred') {
      const logs = getRecentDecisionLogs(db, ['deferred']);
      if (logs.length > 0) {
        ctx.decisions = logs.map(log => ({
          date: log.date,
          status: log.status,
          memo: log.memo,
          reason: log.reason,
        }));
      }
    }
  }

  return ctx;
}

export function formatContextForPrompt(ctx: ContextPackage): string {
  const parts: string[] = [];

  if (ctx.projectOverview) {
    parts.push(`<context:project-overview>\n${ctx.projectOverview}\n</context:project-overview>`);
  }
  if (ctx.aiGuide) {
    parts.push(`<context:ai-guide>\n${ctx.aiGuide}\n</context:ai-guide>`);
  }
  if (ctx.glossary) {
    parts.push(`<context:glossary>\n${ctx.glossary}\n</context:glossary>`);
  }
  if (ctx.prd) {
    parts.push(`<context:prd>\n${ctx.prd}\n</context:prd>`);
  }
  if (ctx.refItems?.length) {
    parts.push(`<context:ref-items>\n${ctx.refItems.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n</context:ref-items>`);
  }
  if (ctx.decisions?.length) {
    const lines = ctx.decisions.map(d => {
      const reason = d.reason ? ` (이유: ${d.reason})` : '';
      return `- [${d.date}] ${d.status}: ${d.memo}${reason}`;
    });
    parts.push(`<context:decisions>\n${lines.join('\n')}\n</context:decisions>`);
  }

  return parts.join('\n\n');
}
