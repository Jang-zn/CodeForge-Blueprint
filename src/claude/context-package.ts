import fs from 'fs';
import path from 'path';
import {
  getDocByType,
  getDocSections,
  getDocType,
  getRecentDecisionLogs,
  getRefItems,
  getIssues,
  buildGlossaryMarkdown,
  assembleMarkdown,
  getDocuments,
  type DocumentRecord,
  type Tab,
  type IssueStatus,
} from '../db/repository.js';

export interface UserFeedbackItem {
  issueId: string;
  title: string;
  status: IssueStatus;
  memo: string;
}

export interface ContextPackage {
  projectOverview?: string;
  aiGuide?: string;
  glossary?: string;
  prd?: string;
  decisions?: { date: string; status: string; memo: string; reason?: string | null }[];
  refItems?: string[];
  baseDocument?: string;
  userFeedback?: UserFeedbackItem[];
}

type ContextProfile = 'default' | 'review' | 'backend' | 'frontend' | 'features';

const PROFILE_DOCS: Record<ContextProfile, string[]> = {
  default:  ['project-overview', 'ai-guide', 'glossary'],
  review:   ['project-overview', 'ai-guide', 'glossary', 'prd', 'user-feedback', 'generated:review'],
  backend:  ['project-overview', 'ai-guide', 'glossary', 'prd', 'user-feedback', 'decisions:recent', 'generated:review', 'generated:backend'],
  frontend: ['project-overview', 'ai-guide', 'glossary', 'prd', 'user-feedback', 'ref-items', 'decisions:recent', 'generated:review', 'generated:backend', 'generated:frontend'],
  features: ['project-overview', 'ai-guide', 'glossary', 'prd', 'user-feedback', 'decisions:deferred', 'generated:review', 'generated:backend', 'generated:features'],
};

/**
 * 탭별 생성 문서 폴백 체인
 * 각 탭에서는 자신의 생성 문서 → 상위 탭의 생성 문서 → 없음 순서로 조회
 */
const GENERATED_DOC_FALLBACK: Record<Tab, Tab[]> = {
  review: ['review'],
  backend: ['backend', 'review'],
  frontend: ['frontend', 'backend', 'review'],
  features: ['features', 'backend', 'review'],
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
  const filePath = resolveDocPath(doc.file_path, docsPath);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * 문서 경로를 절대 경로로 변환
 */
function resolveDocPath(filePath: string, docsPath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(docsPath, filePath);
}

/**
 * 주어진 탭의 생성 문서셋을 읽음
 * 폴백 체인: tab → (상위 탭들) → undefined
 *
 * 생성 문서의 구조:
 * - file_path가 .../tab-vX.Y.Z/index.md 형태
 * - 해당 디렉토리에 여러 섹션 파일 존재 (01-*.md, 02-*.md 등)
 *
 * 주의: 최신 레코드가 있지만 파일을 읽을 수 없으면 다음 버전으로 계속 시도함.
 * 폴백 체인이 끝날 때까지 모든 유효한 콘텐츠를 찾으려고 시도함.
 */
function readGeneratedDocSet(db: any, tab: Tab, docsPath: string): string | undefined {
  const fallbackTabs = GENERATED_DOC_FALLBACK[tab];

  for (const fallbackTab of fallbackTabs) {
    const docs = getDocuments(db, fallbackTab);
    // 최신순으로 정렬해서 가능한 모든 생성 문서를 시도
    const generatedDocs = docs
      .filter(d => d.kind === 'generated-doc')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    for (const doc of generatedDocs) {
      const content = readGeneratedDocContent(db, doc, docsPath);
      if (content) return content;
    }
  }

  return undefined;
}

/**
 * 생성 문서 콘텐츠를 읽음
 * 폴더 기반 문서의 경우: 폴더의 모든 .md 파일을 읽고 연결
 * 레거시 단일 파일의 경우: 파일 직접 읽음
 */
function readGeneratedDocContent(db: any, doc: DocumentRecord, docsPath: string): string | undefined {
  const filePath = resolveDocPath(doc.file_path, docsPath);

  // 폴더 기반 문서 (index.md)
  if (filePath.endsWith('index.md')) {
    const folderPath = path.dirname(filePath);
    try {
      const stat = fs.statSync(folderPath);
      if (!stat.isDirectory()) {
        return undefined;
      }

      const mdFiles = fs.readdirSync(folderPath)
        .filter(f => f.endsWith('.md'))
        .sort();

      if (mdFiles.length === 0) return undefined;

      const contents = mdFiles.map(f => {
        try {
          return fs.readFileSync(path.join(folderPath, f), 'utf-8');
        } catch {
          return '';
        }
      });

      return contents.join('\n\n');
    } catch {
      return undefined;
    }
  }

  // 레거시 단일 파일 문서
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
  const profileTab = (profile as ContextProfile) as Tab;

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
    } else if (item === 'user-feedback') {
      const issues = getIssues(db, profileTab);
      const feedbackItems = issues
        .filter(i => i.status !== 'pending' && (i.memo?.trim() || i.status === 'dismissed'))
        .map(i => ({
          issueId: i.id,
          title: i.title,
          status: i.status as IssueStatus,
          memo: i.memo?.trim() || `상태: ${i.status}`,
        }));
      if (feedbackItems.length > 0) {
        ctx.userFeedback = feedbackItems;
      }
    } else if (item.startsWith('generated:')) {
      // 첫 번째 generated-* 항목에서만 baseDocument 설정 (중복 방지)
      if (!ctx.baseDocument) {
        ctx.baseDocument = readGeneratedDocSet(db, profileTab, docsPath);
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
  if (ctx.baseDocument) {
    parts.push(`<context:base-document>\n${ctx.baseDocument}\n</context:base-document>`);
  }
  if (ctx.refItems?.length) {
    parts.push(`<context:ref-items>\n${ctx.refItems.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n</context:ref-items>`);
  }
  if (ctx.userFeedback?.length) {
    const STATUS_GUIDE: Record<string, string> = {
      resolved: '확정 — 이 방향을 따르세요',
      reviewing: '검토중 — 메모의 의견을 고려하세요',
      deferred: '보류 — 이 주제는 건너뛰세요',
      dismissed: '삭제 — 이 이슈를 재생산하지 마세요',
    };
    const lines = ctx.userFeedback.map(f =>
      `- [${f.issueId}] "${f.title}" → ${STATUS_GUIDE[f.status] ?? f.status}: ${f.memo}`
    );
    parts.push(`<context:user-feedback>\n아래는 이전 분석 결과에 대한 사용자 피드백입니다. 다음 분석에 반드시 반영하세요:\n${lines.join('\n')}\n</context:user-feedback>`);
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
