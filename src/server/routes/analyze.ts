import { Hono } from 'hono';
import crypto from 'crypto';
import {
  getWorkspaceMeta,
  getIssues,
  getRefItems,
  createJob,
  updateJob,
  appendJobLog,
  bulkUpsertIssues,
  bulkSetRefItems,
  getProviderModel,
  markSupersededJobs,
  isJobRunnable,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';
import { spawnProviderWithHandle } from '../../claude/provider.js';
import { registerProcess, unregisterProcess } from '../../claude/process-registry.js';
import { chunkToLogText } from '../../claude/log-extractor.js';
import { buildReviewPlanPrompt } from '../../claude/prompts/review-plan.js';
import { buildBackendPrompt } from '../../claude/prompts/design-backend.js';
import { buildFrontendPrompt } from '../../claude/prompts/design-frontend.js';
import { buildFeaturesPrompt } from '../../claude/prompts/plan-features.js';
import { requireRequestContext } from '../context.js';
import { validateAnalyzeResults } from '../analysis-schema.js';

const analyzeRoute = new Hono();

interface AnalyzeResult {
  mode?: string;
  issues?: unknown;
  refItems?: unknown;
}

function extractCandidates(text: string): AnalyzeResult[] {
  const codeBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(match => match[1].trim());
  const candidates = codeBlocks.length > 0 ? codeBlocks : [text];
  const results: AnalyzeResult[] = [];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
      continue;
    } catch {
      // try best-effort JSON extraction below
    }

    let depth = 0;
    let start = -1;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{' || ch === '[') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0 && start >= 0) {
          try {
            const parsed = JSON.parse(candidate.slice(start, i + 1));
            if (Array.isArray(parsed)) results.push(...parsed);
            else results.push(parsed);
          } catch {
            // ignore
          }
          start = -1;
        }
      }
    }
  }

  return results;
}

function buildIssueHtml(issue: { description: string; evidence?: string; conclusion?: string; callout_type?: string }): string {
  const calloutClass = issue.callout_type ?? 'blue';
  const evidenceHtml = issue.evidence
    ? `<div class="evidence"><strong>근거:</strong> ${escapeHtml(issue.evidence)}</div>`
    : '';
  const conclusionHtml = issue.conclusion
    ? `<div class="callout callout-${calloutClass}"><strong>권장 조치:</strong> ${escapeHtml(issue.conclusion)}</div>`
    : '';

  return `<p>${escapeHtml(issue.description)}</p>${evidenceHtml}${conclusionHtml}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

analyzeRoute.post('/', async (c) => {
  const { db, workspace, sessionId } = requireRequestContext(c);
  const body = await c.req.json<{ tab?: Tab }>().catch(() => ({ tab: 'review' as Tab }));
  const tab: Tab = body.tab ?? 'review';

  const meta = getWorkspaceMeta(db);
  if (!meta?.prd_path) {
    return c.json({ error: 'PRD 경로가 설정되지 않았습니다.', recovery: '먼저 PRD를 생성하거나 불러오세요.' }, 400);
  }
  const prdPath = meta.prd_path;

  const jobId = crypto.randomUUID();
  const providerModel = getProviderModel(db);
  const sourceVersion = tab === 'review' ? 'prd' : getIssues(db, 'review').length > 0 ? 'review-ready' : 'draft';

  markSupersededJobs(db, { session_id: sessionId, type: `analyze-${tab}`, tab, run_key: tab }, jobId);
  createJob(db, jobId, `analyze-${tab}`, {
    tab,
    session_id: sessionId,
    capability: 'analysis',
    run_key: tab,
    source_version: sourceVersion,
    workspace_root: workspace.rootPath,
  });
  appendJobLog(db, jobId, `[${providerModel.provider}:${providerModel.model}] 분석 시작...\n`);

  (async () => {
    try {
      let prompt: string;
      if (tab === 'review') {
        prompt = buildReviewPlanPrompt(prdPath);
      } else if (tab === 'backend') {
        prompt = buildBackendPrompt(prdPath);
      } else if (tab === 'frontend') {
        const refItems = getRefItems(db).map(item => item.content);
        prompt = buildFrontendPrompt(prdPath, refItems);
      } else if (tab === 'features') {
        const deferredIssues = getIssues(db, 'features')
          .filter(issue => issue.tag === 'deferred')
          .map(issue => ({ id: issue.id, title: issue.title, memo: issue.memo }));
        prompt = buildFeaturesPrompt(prdPath, deferredIssues);
      } else {
        updateJob(db, jobId, 'failed', `알 수 없는 탭: ${tab}`);
        return;
      }

      const handle = spawnProviderWithHandle(prompt, providerModel, {
        onChunk: (chunk) => {
          if (!isJobRunnable(db, jobId)) return;
          const text = chunkToLogText(chunk, providerModel.provider);
          if (text) appendJobLog(db, jobId, text);
        },
      });
      handle.childReady.then(child => {
        if (child) registerProcess(jobId, child);
      });
      let result: Awaited<typeof handle.promise>;
      try {
        result = await handle.promise;
      } finally {
        unregisterProcess(jobId);
      }
      if (!isJobRunnable(db, jobId)) return;
      if (!result.success) {
        updateJob(db, jobId, 'failed', result.error);
        return;
      }

      const parsed = extractCandidates(result.result);
      const { issues: validIssues, refItems } = validateAnalyzeResults(parsed, tab);
      if (validIssues.length === 0) {
        updateJob(db, jobId, 'failed', '분석 결과가 유효한 JSON 스키마를 만족하지 않습니다.');
        return;
      }

      bulkUpsertIssues(db, validIssues.map((issue, idx) => ({
        id: issue.id,
        tab,
        category: issue.category,
        title: issue.title,
        html_content: buildIssueHtml(issue),
        tag: issue.tag ?? null,
        priority: issue.priority ?? null,
        badge: null,
        status: 'pending' as IssueStatus,
        memo: '',
        sort_order: idx,
        origin_id: null,
        assignee: null,
        updated_by: 'ai',
        applied_at: null,
        source_run_id: jobId,
        confidence: issue.confidence ?? null,
      })));

      if (refItems.length > 0) {
        bulkSetRefItems(db, refItems.map(content => ({ content })));
      }

      updateJob(db, jobId, 'completed');
    } catch (e) {
      if (!isJobRunnable(db, jobId)) return;
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

export default analyzeRoute;
