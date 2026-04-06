import { Hono } from 'hono';
import crypto from 'crypto';
import {
  getIssues,
  addDecisionLog,
  updateIssueStatus,
  upsertIssue,
  getTabVersion,
  setTabVersion,
  addChangelog,
  createJob,
  updateJob,
  appendJobLog,
  getLastDecisionLogsBulk,
  markSupersededJobs,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const applyRoute = new Hono();

interface IssueState {
  id: string;
  status: IssueStatus;
  memo: string;
}

const STATUS_LABELS: Record<string, string> = {
  resolved: '확정',
  deferred: '보류',
  dismissed: '삭제',
  reviewing: '검토중',
  pending: '미검토',
};

function bumpMinorVersion(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor + 1}.${patch ?? 0}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

applyRoute.post('/', async (c) => {
  const { db, workspace, sessionId } = requireRequestContext(c);
  const body = await c.req.json<{ tab: Tab; issues: IssueState[] }>();
  const { tab, issues } = body;

  if (!tab || !issues?.length) {
    return c.json({ error: '탭과 이슈 목록이 필요합니다.' }, 400);
  }

  const jobId = crypto.randomUUID();
  markSupersededJobs(db, { session_id: sessionId, type: `apply-${tab}`, tab, run_key: tab }, jobId);
  createJob(db, jobId, `apply-${tab}`, {
    tab,
    session_id: sessionId,
    capability: 'apply',
    run_key: tab,
    source_version: getTabVersion(db, tab),
    workspace_root: workspace.rootPath,
  });
  appendJobLog(db, jobId, `[apply] 반영 처리 시작 (${issues.length}건)...\n`);

  (async () => {
    try {
      const todayStr = today();
      let deferredCount = 0;
      const changeLines: string[] = [];

      const existingFeatures = tab === 'review' ? getIssues(db, 'features') : [];
      const allIssues = tab === 'review' ? getIssues(db) : [];
      const lastLogs = getLastDecisionLogsBulk(db, issues.map(issue => issue.id));

      for (const issueState of issues) {
        const lastLog = lastLogs[issueState.id];
        const statusChanged = lastLog ? issueState.status !== lastLog.status : issueState.status !== 'pending';
        const hasMemo = !!issueState.memo?.trim();
        if (!statusChanged && !hasMemo) continue;

        const statusLabel = STATUS_LABELS[issueState.status] || issueState.status;
        const memoText = issueState.memo?.trim() ? `: "${issueState.memo.trim()}"` : '';
        changeLines.push(`- ${issueState.id} [${statusLabel}]${memoText}`);

        addDecisionLog(db, {
          issue_id: issueState.id,
          date: todayStr,
          status: issueState.status,
          memo: issueState.memo?.trim() || `상태: ${issueState.status}`,
        });

        updateIssueStatus(db, issueState.id, issueState.status, '', {
          updated_by: 'user',
          applied_at: issueState.status === 'resolved' ? new Date().toISOString() : null,
        });

        if (issueState.status === 'deferred' && tab === 'review') {
          const nextDeferredIndex = existingFeatures.length + deferredCount + 1;
          const defId = `ft-def${nextDeferredIndex}`;
          const original = allIssues.find(issue => issue.id === issueState.id);
          const existingDeferred = existingFeatures.find(issue => issue.origin_id === issueState.id);
          if (original) {
            upsertIssue(db, {
              id: existingDeferred?.id ?? defId,
              tab: 'features',
              category: 'FT-DEF',
              title: `[보류→검토] ${original.title}`,
              html_content: original.html_content,
              tag: 'deferred',
              priority: original.priority,
              badge: null,
              status: 'pending',
              memo: issueState.memo || '',
              sort_order: existingDeferred?.sort_order ?? nextDeferredIndex,
              origin_id: issueState.id,
              assignee: null,
              updated_by: 'system',
              applied_at: null,
              source_run_id: original.source_run_id,
              confidence: original.confidence,
            });
            if (!existingDeferred) deferredCount++;
          }
        }
      }

      if (changeLines.length === 0) {
        updateJob(db, jobId, 'completed');
        return;
      }

      const currentVersion = getTabVersion(db, tab);
      const newVersion = bumpMinorVersion(currentVersion);
      setTabVersion(db, tab, newVersion);

      const changelogDesc = `v${newVersion} 리뷰 반영 (${changeLines.length}건)\n${changeLines.join('\n')}`;
      addChangelog(db, { tab, version: newVersion, date: todayStr, description: changelogDesc });

      updateJob(db, jobId, 'completed');
    } catch (e) {
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

export default applyRoute;
