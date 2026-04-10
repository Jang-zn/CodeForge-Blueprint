import { Hono } from 'hono';
import {
  getIssues,
  getIssue,
  getLastDecisionLogsBulk,
  createIssuePreview,
  getAllIssuePreviews,
  deleteIssuePreview,
  clearAllPreviewsForTab,
  getReviewMetrics,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const applyPreviewRoute = new Hono();

interface IssueStateChange {
  id: string;
  status: IssueStatus;
  memo: string;
  reason?: string;
}

interface PreviewResult {
  issue_id: string;
  current_status: IssueStatus;
  new_status: IssueStatus;
  changed: boolean;
  memo: string;
}

interface ApplyPreviewResponse {
  tab: Tab;
  previews: PreviewResult[];
  changes_count: number;
  metrics_before: any;
  metrics_after: any;
}

/**
 * Calculate what the metrics would look like after applying changes
 */
function calculateProjectedMetrics(
  db: any,
  tab: Tab,
  changes: Map<string, IssueStatus>,
): any {
  const issues = getIssues(db, tab);
  const total = issues.length;

  if (total === 0) {
    return {
      totalIssues: 0,
      decidedIssues: 0,
      resolvePct: 0,
      deferPct: 0,
      dismissPct: 0,
      completionPct: 0,
    };
  }

  let resolved = 0;
  let deferred = 0;
  let dismissed = 0;

  for (const issue of issues) {
    const newStatus = changes.get(issue.id) ?? issue.status;
    if (newStatus === 'resolved') resolved++;
    else if (newStatus === 'deferred') deferred++;
    else if (newStatus === 'dismissed') dismissed++;
  }

  const decided = resolved + deferred + dismissed;

  return {
    totalIssues: total,
    decidedIssues: decided,
    resolvePct: Math.round((resolved / total) * 100),
    deferPct: Math.round((deferred / total) * 100),
    dismissPct: Math.round((dismissed / total) * 100),
    completionPct: Math.round((decided / total) * 100),
  };
}

/**
 * POST /apply-preview — Preview what changes will be made without applying
 */
applyPreviewRoute.post('/', async (c) => {
  const { db } = requireRequestContext(c);
  const body = await c.req.json<{ tab: Tab; issues: IssueStateChange[] }>();
  const { tab, issues } = body;

  if (!tab || !issues?.length) {
    return c.json({ error: '탭과 이슈 목록이 필요합니다.' }, 400);
  }

  const allIssues = getIssues(db, tab);
  const lastLogs = getLastDecisionLogsBulk(db, issues.map(issue => issue.id));
  const changes = new Map<string, IssueStatus>();
  const previews: PreviewResult[] = [];

  for (const issueState of issues) {
    const issue = allIssues.find(i => i.id === issueState.id);
    if (!issue) continue;

    const lastLog = lastLogs[issueState.id];
    const currentStatus = issue.status;
    const newStatus = issueState.status;
    const statusChanged = lastLog ? newStatus !== lastLog.status : newStatus !== 'pending';
    const hasMemo = !!issueState.memo?.trim();

    if (statusChanged || hasMemo) {
      changes.set(issueState.id, newStatus);
      previews.push({
        issue_id: issueState.id,
        current_status: currentStatus,
        new_status: newStatus,
        changed: statusChanged || hasMemo,
        memo: issueState.memo?.trim() || '',
      });
    }
  }

  const metricsBefore = getReviewMetrics(db, tab);
  const metricsAfter = calculateProjectedMetrics(db, tab, changes);

  return c.json({
    tab,
    previews,
    changes_count: previews.length,
    metrics_before: metricsBefore,
    metrics_after: metricsAfter,
  } as ApplyPreviewResponse);
});

/**
 * POST /:issueId/preview — Create/update preview for single issue (quick action)
 */
applyPreviewRoute.post('/:issueId', async (c) => {
  const { db } = requireRequestContext(c);
  const issueId = c.req.param('issueId');
  const body = await c.req.json<{ status: IssueStatus; memo?: string }>();

  const issue = getIssue(db, issueId);
  if (!issue) {
    return c.json({ error: 'Issue not found' }, 404);
  }

  const preview = createIssuePreview(db, issueId, body.status, body.memo || '');
  return c.json({ preview }, 201);
});

/**
 * GET /:tab/previews — Get all previews for a tab
 */
applyPreviewRoute.get('/:tab', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.param('tab') as Tab;

  const previews = getAllIssuePreviews(db, tab);
  const metrics = getReviewMetrics(db, tab);

  return c.json({ tab, previews, metrics });
});

/**
 * DELETE /:issueId — Clear preview for single issue
 */
applyPreviewRoute.delete('/:issueId', (c) => {
  const { db } = requireRequestContext(c);
  const issueId = c.req.param('issueId');

  deleteIssuePreview(db, issueId);
  return c.body(null, 204);
});

/**
 * DELETE /:tab/all — Clear all previews for a tab
 */
applyPreviewRoute.delete('/:tab/all', (c) => {
  const { db } = requireRequestContext(c);
  const tab = c.req.param('tab') as Tab;

  clearAllPreviewsForTab(db, tab);
  return c.body(null, 204);
});

export default applyPreviewRoute;
