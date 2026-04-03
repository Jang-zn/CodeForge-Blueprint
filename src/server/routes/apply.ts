import { Hono } from 'hono';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import {
  getIssues,
  addDecisionLog,
  upsertIssue,
  deleteIssue,
  getTabVersion,
  setTabVersion,
  addChangelog,
  createJob,
  updateJob,
  type Tab,
  type IssueStatus,
} from '../../db/repository.js';

const applyRoute = new Hono();

interface IssueState {
  id: string;
  status: IssueStatus;
  memo: string;
}

function bumpMinorVersion(version: string): string {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor + 1}.${patch ?? 0}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// POST /api/apply — 리뷰 결과 반영 (decision log, deferred 이동, 버전 bump)
applyRoute.post('/', async (c) => {
  const db = getDb();
  const body = await c.req.json<{ tab: Tab; issues: IssueState[] }>();
  const { tab, issues } = body;

  if (!tab || !issues?.length) {
    return c.json({ error: '탭과 이슈 목록이 필요합니다.' }, 400);
  }

  const jobId = crypto.randomUUID();
  createJob(db, jobId, 'apply');

  (async () => {
    try {
      const todayStr = today();
      let deferredCount = 0;
      let resolvedCount = 0;
      const defMovedItems: string[] = [];

      const existingFeatures = tab === 'review' ? getIssues(db, 'features') : [];
      const allIssues = tab === 'review' ? getIssues(db) : [];

      for (const issueState of issues) {
        if (!issueState.memo?.trim() && issueState.status === 'pending') continue;

        if (issueState.memo?.trim() || issueState.status !== 'pending') {
          addDecisionLog(db, {
            issue_id: issueState.id,
            date: todayStr,
            status: issueState.status,
            memo: issueState.memo || `상태: ${issueState.status}`,
          });
        }

        if (issueState.status === 'resolved') resolvedCount++;

        if (issueState.status === 'deferred' && tab === 'review') {
          deferredCount++;
          const defId = `ft-def${existingFeatures.length + deferredCount}`;
          const original = allIssues.find(i => i.id === issueState.id);

          if (original) {
            upsertIssue(db, {
              id: defId,
              tab: 'features',
              category: 'FT-DEF',
              title: `[보류→검토] ${original.title}`,
              html_content: original.html_content,
              tag: 'deferred',
              priority: original.priority,
              badge: null,
              status: 'pending',
              memo: issueState.memo || '',
              sort_order: existingFeatures.length + deferredCount,
              origin_id: issueState.id,
            });
            defMovedItems.push(original.title);
          }
        }
      }

      // 버전 bump
      const currentVersion = getTabVersion(db, tab);
      const newVersion = bumpMinorVersion(currentVersion);
      setTabVersion(db, tab, newVersion);

      // Changelog
      const parts: string[] = [];
      if (resolvedCount > 0) parts.push(`${resolvedCount}건 확정`);
      if (deferredCount > 0) parts.push(`${deferredCount}건 보류→다음버전 이동`);
      addChangelog(db, {
        tab,
        version: newVersion,
        date: todayStr,
        description: parts.join(', ') || '리뷰 반영',
      });

      updateJob(db, jobId, 'completed');
    } catch (e) {
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

export default applyRoute;
