import { Hono } from 'hono';
import crypto from 'crypto';
import {
  getIssues,
  getIssue,
  getAllIssuePreviews,
  clearAllPreviewsForTab,
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
  getCurrentCycle,
  updateCycleStatus,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';
import { requireRequestContext } from '../context.js';

const applyRoute = new Hono();

interface IssueState {
  id: string;
  status: IssueStatus;
  memo: string;
  reason?: string;
}

const STATUS_LABELS: Record<string, string> = {
  resolved: '확정',
  deferred: '보류',
  dismissed: '삭제',
  reviewing: '검토중',
  pending: '미검토',
  candidate: '후보',
  promoted: '승격',
  archived: '보관',
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
  const body = await c.req.json<{ tab: Tab }>();
  const { tab } = body;

  if (!tab) {
    return c.json({ error: '탭이 필요합니다.' }, 400);
  }

  // 서버의 draft에서 처리 대상 읽기
  const drafts = getAllIssuePreviews(db, tab);
  const issues: IssueState[] = drafts.map(d => ({
    id: d.issue_id,
    status: d.preview_status as IssueStatus,
    memo: d.preview_memo,
  }));

  if (issues.length === 0) {
    // draft가 없으면 즉시 완료
    const jobId = crypto.randomUUID();
    createJob(db, jobId, `apply-${tab}`, {
      tab,
      session_id: sessionId,
      capability: 'apply',
      run_key: tab,
      source_version: getTabVersion(db, tab),
      workspace_root: workspace.rootPath,
    });
    updateJob(db, jobId, 'completed');
    return c.json({ jobId });
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

      const cycle = getCurrentCycle(db, tab);
      const existingFeatures = tab !== 'features' ? getIssues(db, 'features') : [];
      const allIssues = tab !== 'features' ? getIssues(db) : [];
      // ft-defN 최대 인덱스를 미리 계산하여 번호 충돌 방지
      const maxFtDefIndex = existingFeatures
        .map(i => Number(i.id.match(/^ft-def(\d+)$/)?.[1] ?? '0'))
        .reduce((max, n) => Math.max(max, n), 0);
      const lastLogs = getLastDecisionLogsBulk(db, issues.map(issue => issue.id));

      for (const issueState of issues) {
        const lastLog = lastLogs[issueState.id];
        const statusChanged = lastLog ? issueState.status !== lastLog.status : issueState.status !== 'pending';
        const hasMemo = !!issueState.memo?.trim();
        if (!statusChanged && !hasMemo) continue;

        const statusLabel = STATUS_LABELS[issueState.status] || issueState.status;
        const memoText = issueState.memo?.trim() ? `: "${issueState.memo.trim()}"` : '';
        changeLines.push(`- ${issueState.id} [${statusLabel}]${memoText}`);

        const issue = allIssues.find(i => i.id === issueState.id) ?? getIssue(db, issueState.id);
        addDecisionLog(db, {
          issue_id: issueState.id,
          date: todayStr,
          status: issueState.status,
          memo: issueState.memo?.trim() || `상태: ${issueState.status}`,
          old_status: lastLog?.status ?? null,
          tab: issue?.tab ?? tab,
          reason: issueState.reason?.trim() || null,
          cycle_id: cycle?.id ?? null,
        });

        updateIssueStatus(db, issueState.id, issueState.status, '', {
          updated_by: 'user',
          applied_at: issueState.status === 'resolved' ? new Date().toISOString() : null,
        });

        if (issueState.status === 'deferred' && tab !== 'features') {
          const defId = `ft-def${maxFtDefIndex + deferredCount + 1}`;
          const original = allIssues.find(issue => issue.id === issueState.id);
          const existingDeferred = existingFeatures.find(issue => issue.origin_id === issueState.id);
          if (original) {
            upsertIssue(db, {
              id: existingDeferred?.id ?? defId,
              tab: 'features',
              category: 'FT-DEF',
              title: `[${tab}/보류→검토] ${original.title}`,
              html_content: original.html_content,
              tag: 'deferred',
              priority: original.priority,
              badge: null,
              status: 'pending',
              memo: issueState.memo || '',
              sort_order: existingDeferred?.sort_order ?? (maxFtDefIndex + deferredCount),
              origin_id: issueState.id,
              assignee: null,
              updated_by: 'system',
              applied_at: null,
              source_run_id: original.source_run_id,
              confidence: original.confidence,
              decision_at: null,
              decision_quality: null,
            });
            if (!existingDeferred) deferredCount++;
            // features로 이관 완료 — 원래 탭에서 archived로 보존 (decision_logs 접근 유지)
            updateIssueStatus(db, issueState.id, 'archived', '', { updated_by: 'system' });
          }
        }
      }

      if (changeLines.length === 0) {
        clearAllPreviewsForTab(db, tab);
        updateJob(db, jobId, 'completed');
        return;
      }

      const currentVersion = getTabVersion(db, tab);
      const newVersion = bumpMinorVersion(currentVersion);
      setTabVersion(db, tab, newVersion);

      const changelogDesc = `v${newVersion} 리뷰 반영 (${changeLines.length}건)\n${changeLines.join('\n')}`;
      addChangelog(db, { tab, version: newVersion, date: todayStr, description: changelogDesc });

      // features 탭에 보류 이슈를 이관한 경우 features 버전도 bump
      if (deferredCount > 0) {
        const featuresVersion = getTabVersion(db, 'features');
        const newFeaturesVersion = bumpMinorVersion(featuresVersion);
        setTabVersion(db, 'features', newFeaturesVersion);
        addChangelog(db, {
          tab: 'features',
          version: newFeaturesVersion,
          date: todayStr,
          description: `v${newFeaturesVersion} 보류 이슈 ${deferredCount}건 이관 (from ${tab})`,
        });
      }

      // 사이클 상태를 'applied'로 업데이트
      if (cycle) {
        updateCycleStatus(db, cycle.id, 'applied');
      }

      clearAllPreviewsForTab(db, tab);
      updateJob(db, jobId, 'completed');
    } catch (e) {
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

export default applyRoute;
