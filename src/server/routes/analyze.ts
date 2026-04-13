import { Hono } from 'hono';
import crypto from 'crypto';
import {
  getWorkspaceMeta,
  createJob,
  updateJob,
  appendJobLog,
  bulkUpsertIssues,
  bulkSetRefItems,
  getProviderModel,
  markSupersededJobs,
  isJobRunnable,
  getActivePerspectives,
  createOrResumeCycle,
  updateCycleStatus,
  hasPendingDrafts,
  type Tab,
  type IssueStatus,
  type Perspective,
} from '../../db/repository.js';
import { spawnProviderWithHandle } from '../../claude/provider.js';
import { registerProcess, unregisterProcess } from '../../claude/process-registry.js';
import { createLogExtractor } from '../../claude/log-extractor.js';
import { buildReviewPlanPrompt } from '../../claude/prompts/review-plan.js';
import { buildBackendPrompt } from '../../claude/prompts/design-backend.js';
import { buildFrontendPrompt } from '../../claude/prompts/design-frontend.js';
import { buildFeaturesPrompt } from '../../claude/prompts/plan-features.js';
import { buildContextPackage } from '../../claude/context-package.js';
import type { SpawnResult, UsageTotals } from '../../claude/spawner.js';
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

interface AnalyzeRequest {
  tab?: Tab;
  perspectiveIds?: string[];
}

analyzeRoute.post('/', async (c) => {
  const { db, workspace, sessionId } = requireRequestContext(c);
  const body = await c.req.json<AnalyzeRequest>().catch(() => ({ tab: 'review' as Tab })) as AnalyzeRequest;
  const tab: Tab = body.tab ?? 'review';

  if (hasPendingDrafts(db, tab)) {
    return c.json(
      { error: '반영하지 않은 변경사항이 있습니다. "반영하기"를 먼저 실행하세요.', recovery: '"반영하기" 버튼을 클릭하여 변경사항을 반영한 후 다시 시도하세요.' },
      400
    );
  }

  const meta = getWorkspaceMeta(db);
  const ctxPackage = buildContextPackage(db, workspace.docsPath, tab as any, meta?.prd_path ?? null);

  const jobId = crypto.randomUUID();
  const providerModel = getProviderModel(db);
  const sourceVersion = tab === 'review' ? 'prd' : ctxPackage.prd ? 'review-ready' : 'draft';

  markSupersededJobs(db, { session_id: sessionId, type: `analyze-${tab}`, tab, run_key: tab }, jobId);
  createJob(db, jobId, `analyze-${tab}`, {
    tab,
    session_id: sessionId,
    capability: 'analysis',
    run_key: tab,
    source_version: sourceVersion,
    workspace_root: workspace.rootPath,
  });

  const cycle = createOrResumeCycle(db, tab);
  const cycleId = cycle.id;

  (async () => {
    try {
      if (!ctxPackage.prd && !ctxPackage.projectOverview) {
        updateJob(db, jobId, 'failed', 'PRD 또는 프로젝트 개요 문서가 없습니다. 먼저 문서를 작성하세요.');
        updateCycleStatus(db, cycleId, 'failed');
        return;
      }

      let perspectives = getActivePerspectives(db, tab);
      if (body.perspectiveIds && body.perspectiveIds.length > 0) {
        const selectedIds = new Set(body.perspectiveIds);
        perspectives = perspectives.filter((p: Perspective) => selectedIds.has(p.id));
      }

      let promptBuilder: (ctx: typeof ctxPackage, perspectives?: Perspective[]) => string;
      if (tab === 'review') {
        promptBuilder = buildReviewPlanPrompt;
      } else if (tab === 'backend') {
        promptBuilder = buildBackendPrompt;
      } else if (tab === 'frontend') {
        promptBuilder = buildFrontendPrompt;
      } else if (tab === 'features') {
        promptBuilder = buildFeaturesPrompt;
      } else {
        updateJob(db, jobId, 'failed', `알 수 없는 탭: ${tab}`);
        updateCycleStatus(db, cycleId, 'failed');
        return;
      }

      appendJobLog(db, jobId, `[${providerModel.provider}:${providerModel.model}] 분석 시작 (${perspectives.length}개 관점 병렬)...\n`);

      // Spawn one AI process per perspective in parallel
      const settledResults = await Promise.allSettled(
        perspectives.map(async (perspective: Perspective) => {
          const prompt = promptBuilder(ctxPackage, [perspective]);
          const extractor = createLogExtractor(providerModel.provider);

          const handle = spawnProviderWithHandle(prompt, providerModel, {
            onChunk: (chunk) => {
              if (!isJobRunnable(db, jobId)) return;
              const text = extractor.processChunk(chunk);
              if (text) appendJobLog(db, jobId, `[${perspective.name}] ${text}`);
            },
          });

          const child = await handle.childReady;
          if (child) registerProcess(jobId, child);

          let result: Awaited<typeof handle.promise>;
          try {
            result = await handle.promise;
          } finally {
            if (child) unregisterProcess(jobId, child);
          }

          if (!result.success) {
            throw new Error(result.error ?? `관점 "${perspective.name}" 분석 실패`);
          }

          return result;
        })
      );

      if (!isJobRunnable(db, jobId)) return;

      const fulfilled = settledResults.filter(
        (r): r is PromiseFulfilledResult<SpawnResult> =>
          r.status === 'fulfilled'
      );
      const rejected = settledResults.filter(r => r.status === 'rejected');

      if (rejected.length > 0) {
        const failMessages = (rejected as PromiseRejectedResult[])
          .map(r => String(r.reason))
          .join('; ');
        updateJob(db, jobId, 'failed', `${rejected.length}개 관점 분석 실패: ${failMessages}`);
        updateCycleStatus(db, cycleId, 'failed');
        return;
      }

      const combinedText = fulfilled.map(r => r.value.result).join('\n');
      const parsed = extractCandidates(combinedText);
      const { issues: validIssues, refItems } = validateAnalyzeResults(parsed, tab);

      if (validIssues.length === 0) {
        updateJob(db, jobId, 'failed', '분석 결과가 유효한 JSON 스키마를 만족하지 않습니다.');
        updateCycleStatus(db, cycleId, 'failed');
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
        decision_at: null,
        decision_quality: null,
      })));

      if (refItems.length > 0) {
        bulkSetRefItems(db, refItems.map(content => ({ content })));
      }

      // Sum token usage across all successful results
      const totalUsage = fulfilled.reduce<UsageTotals>(
        (acc, r) => {
          const u = r.value.usage;
          if (!u) return acc;
          return {
            inputTokens: acc.inputTokens + u.inputTokens,
            outputTokens: acc.outputTokens + u.outputTokens,
            cacheCreationTokens: acc.cacheCreationTokens + u.cacheCreationTokens,
            cacheReadTokens: acc.cacheReadTokens + u.cacheReadTokens,
          };
        },
        { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }
      );

      updateJob(db, jobId, 'completed', undefined, { usage: totalUsage });
    } catch (e) {
      if (!isJobRunnable(db, jobId)) return;
      updateJob(db, jobId, 'failed', String(e));
      updateCycleStatus(db, cycleId, 'failed');
    }
  })();

  return c.json({ jobId });
});

export default analyzeRoute;
