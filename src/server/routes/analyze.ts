import { Hono } from 'hono';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import {
  getWorkspaceMeta,
  getIssues,
  getRefItems,
  createJob,
  updateJob,
  bulkUpsertIssues,
  bulkSetRefItems,
  getProviderModel,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';
import { spawnProvider } from '../../claude/provider.js';
import { buildReviewPlanPrompt } from '../../claude/prompts/review-plan.js';
import { buildBackendPrompt } from '../../claude/prompts/design-backend.js';
import { buildFrontendPrompt } from '../../claude/prompts/design-frontend.js';
import { buildFeaturesPrompt } from '../../claude/prompts/plan-features.js';

const analyzeRoute = new Hono();

interface AnalyzeIssue {
  id: string;
  category: string;
  title: string;
  tag?: string;
  priority?: string;
  description: string;
  evidence?: string;
  conclusion?: string;
  callout_type?: string;
}

interface AnalyzeResult {
  mode: string;
  issues: AnalyzeIssue[];
  refItems?: string[];
}

function buildIssueHtml(issue: AnalyzeIssue): string {
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

// POST /api/analyze
analyzeRoute.post('/', async (c) => {
  const db = getDb();
  const body = await c.req.json<{ tab?: Tab }>().catch(() => ({ tab: 'review' as Tab }));
  const tab: Tab = body.tab ?? 'review';

  const meta = getWorkspaceMeta(db);
  if (!meta?.prd_path) {
    return c.json({ error: 'PRD 경로가 설정되지 않았습니다.' }, 400);
  }

  const jobId = crypto.randomUUID();
  createJob(db, jobId, `analyze-${tab}`);

  // 비동기 분석 실행
  (async () => {
    try {
      let prompt: string;
      if (tab === 'review') {
        prompt = buildReviewPlanPrompt(meta.prd_path!);
      } else if (tab === 'backend') {
        prompt = buildBackendPrompt(meta.prd_path!);
      } else if (tab === 'frontend') {
        const refItems = getRefItems(db).map(r => r.content);
        prompt = buildFrontendPrompt(meta.prd_path!, refItems);
      } else if (tab === 'features') {
        const deferredIssues = getIssues(db, 'features')
          .filter(i => i.tag === 'deferred')
          .map(i => ({ id: i.id, title: i.title, memo: i.memo }));
        prompt = buildFeaturesPrompt(meta.prd_path!, deferredIssues);
      } else {
        updateJob(db, jobId, 'failed', `알 수 없는 탭: ${tab}`);
        return;
      }

      const result = await spawnProvider(prompt, getProviderModel(db));
      if (!result.success) {
        updateJob(db, jobId, 'failed', result.error);
        return;
      }

      // JSON 파싱
      const jsonMatch = result.result.match(/```json\s*([\s\S]*?)```|(\{[\s\S]*\})/);
      const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[2] ?? result.result;
      const parsed: AnalyzeResult = JSON.parse(jsonStr.trim());

      // issues를 DB에 저장
      const issues = parsed.issues.map((issue, idx) => ({
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
      }));

      bulkUpsertIssues(db, issues);

      // refItems 저장
      if (parsed.refItems?.length) {
        bulkSetRefItems(db, parsed.refItems.map(content => ({ content })));
      }

      updateJob(db, jobId, 'completed');
    } catch (e) {
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

export default analyzeRoute;
