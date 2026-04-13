import type { Issue, IssueStatus, Tab } from '../db/repository.js';
import type { ValidAnalyzeIssue } from './analysis-schema.js';

export interface ReconciledAnalyzeIssue {
  id: string;
  tab: Tab;
  category: string;
  title: string;
  html_content: string;
  tag: string | null;
  priority: string | null;
  badge: string | null;
  status: IssueStatus;
  memo: string;
  sort_order: number;
  origin_id: string | null;
  assignee: string | null;
  updated_by: string | null;
  applied_at: string | null;
  source_run_id: string | null;
  confidence: number | null;
  decision_at: string | null;
  decision_quality: string | null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractIdPrefix(id: string): string {
  const match = id.match(/^(.*?)(\d+)$/);
  return (match?.[1] ?? id).trim();
}

function titleSimilarity(a: string, b: string): number {
  const aTokens = new Set(normalizeText(a).split(' ').filter(Boolean));
  const bTokens = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return (2 * overlap) / (aTokens.size + bTokens.size);
}

function isSafeDirectIdMatch(issue: ValidAnalyzeIssue, existing: Issue): boolean {
  if (normalizeText(issue.title) === normalizeText(existing.title)) return true;
  if (existing.category !== issue.category) return false;
  return titleSimilarity(issue.title, existing.title) >= 0.55;
}

function nextAvailableId(rawId: string, usedIds: Set<string>, allIds: Set<string>): string {
  if (!usedIds.has(rawId) && !allIds.has(rawId)) {
    return rawId;
  }

  const prefix = extractIdPrefix(rawId);
  const numbers = [...allIds, ...usedIds]
    .filter(id => extractIdPrefix(id) === prefix)
    .map(id => Number(id.match(/(\d+)$/)?.[1] ?? '0'));

  const nextNumber = Math.max(0, ...numbers) + 1;
  return `${prefix}${nextNumber}`;
}

export interface ReconcileOptions {
  globalIssueIds?: Set<string>;
}

export function reconcileAnalyzeIssues(
  issues: ValidAnalyzeIssue[],
  existingIssues: Issue[],
  tab: Tab,
  sourceRunId: string,
  buildIssueHtml: (issue: ValidAnalyzeIssue) => string,
  options?: ReconcileOptions,
): ReconciledAnalyzeIssue[] {
  const existingMap = new Map(existingIssues.map(i => [i.id, i]));
  const usedIds = new Set<string>();
  // 전체 테이블 ID로 충돌 방지 (다른 탭 이슈 보호)
  const allIds = options?.globalIssueIds ?? new Set(existingMap.keys());

  return issues.map((issue, idx) => {
    let matched: Issue | null = null;
    let finalId: string;

    // Tier 1: AI가 명시한 basis_issue_id 기반 매칭
    const basisTarget = issue.basis_issue_id ? existingMap.get(issue.basis_issue_id) : undefined;
    if (basisTarget && basisTarget.status !== 'dismissed') {
      matched = basisTarget;
      finalId = issue.id === issue.basis_issue_id
        ? matched.id
        : nextAvailableId(issue.id, usedIds, allIds);
    }
    // Tier 2: 직접 ID 매칭 + 안전 검사 폴백
    else if (existingMap.has(issue.id) && isSafeDirectIdMatch(issue, existingMap.get(issue.id)!)) {
      const direct = existingMap.get(issue.id)!;
      if (direct.status !== 'dismissed') {
        matched = direct;
        finalId = matched.id;
      } else {
        finalId = nextAvailableId(issue.id, usedIds, allIds);
      }
    }
    // Tier 3: 신규 이슈
    else {
      finalId = nextAvailableId(issue.id, usedIds, allIds);
    }

    usedIds.add(finalId);

    const inherited = matched !== null && finalId === matched.id ? matched : null;
    return {
      id: finalId,
      tab,
      category: issue.category,
      title: issue.title,
      html_content: buildIssueHtml(issue),
      tag: issue.tag ?? null,
      priority: issue.priority ?? null,
      badge: inherited?.badge ?? null,
      status: inherited?.status ?? 'pending',
      memo: inherited?.memo ?? '',
      sort_order: idx,
      origin_id: (!inherited && matched) ? (issue.basis_issue_id ?? null) : (matched?.origin_id ?? null),
      assignee: matched?.assignee ?? null,
      updated_by: 'ai',
      applied_at: inherited?.applied_at ?? null,
      source_run_id: sourceRunId,
      confidence: issue.confidence ?? null,
      decision_at: inherited?.decision_at ?? null,
      decision_quality: inherited?.decision_quality ?? null,
    };
  });
}
