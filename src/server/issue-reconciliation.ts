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

// features 탭은 deferred 이슈를 보관하므로 매칭 허용. archived는 모든 탭에서 제외.
function isMatchableStatus(status: IssueStatus, tab: Tab): boolean {
  if (status === 'dismissed' || status === 'archived') return false;
  if (status === 'deferred') return tab === 'features';
  return true;
}

function extractIdPrefix(id: string): string {
  const match = id.match(/^(.*?)(\d+)$/);
  return (match?.[1] ?? id).trim();
}

function tokenize(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter(Boolean));
}

function tokenSimilarity(aTokens: Set<string>, bTokens: Set<string>): number {
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return (2 * overlap) / (aTokens.size + bTokens.size);
}

function titleSimilarity(a: string, b: string): number {
  return tokenSimilarity(tokenize(a), tokenize(b));
}

function isSafeDirectIdMatch(issue: ValidAnalyzeIssue, existing: Issue): boolean {
  const issueNorm = normalizeText(issue.title);
  const existingNorm = normalizeText(existing.title);
  if (issueNorm === existingNorm) return true;
  if (existing.category !== issue.category) return false;
  const issueTokens = new Set(issueNorm.split(' ').filter(Boolean));
  const existingTokens = new Set(existingNorm.split(' ').filter(Boolean));
  return tokenSimilarity(issueTokens, existingTokens) >= 0.55;
}

function findBestMatch(issue: ValidAnalyzeIssue, candidates: Issue[]): Issue | null {
  const issueNorm = normalizeText(issue.title);
  const issueTokens = new Set(issueNorm.split(' ').filter(Boolean));
  const ranked = candidates
    .map(c => {
      const candNorm = normalizeText(c.title);
      const score = tokenSimilarity(issueTokens, new Set(candNorm.split(' ').filter(Boolean)));
      return {
        c,
        score,
        exact: candNorm === issueNorm,
        sameCategory: c.category === issue.category,
        samePrefix: extractIdPrefix(c.id) === extractIdPrefix(issue.id),
      };
    })
    .filter(item => item.sameCategory && (item.exact || item.score >= 0.55))
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      if (a.sameCategory !== b.sameCategory) return a.sameCategory ? -1 : 1;
      if (a.samePrefix !== b.samePrefix) return a.samePrefix ? -1 : 1;
      return b.score - a.score;
    });
  return ranked[0]?.c ?? null;
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
  // dismissed/archived는 어느 탭에서도, deferred는 features 탭 외에서 매칭 불가
  const activeExisting = existingIssues.filter(e => isMatchableStatus(e.status, tab));

  return issues.map((issue, idx) => {
    let matched: Issue | null = null;
    let finalId: string;

    // Tier 1: AI가 명시한 basis_issue_id 기반 매칭 (카테고리 일치 또는 유사도 ≥ 0.35 안전 검사)
    const basisTarget = issue.basis_issue_id ? existingMap.get(issue.basis_issue_id) : undefined;
    const basisSafe = basisTarget
      && isMatchableStatus(basisTarget.status, tab)
      && (basisTarget.category === issue.category || titleSimilarity(issue.title, basisTarget.title) >= 0.35);
    if (basisSafe) {
      matched = basisTarget!;
      finalId = issue.id === issue.basis_issue_id
        ? matched.id
        : nextAvailableId(issue.id, usedIds, allIds);
    }
    // Tier 2: 직접 ID 매칭 + 안전 검사 폴백
    else if (existingMap.has(issue.id) && isSafeDirectIdMatch(issue, existingMap.get(issue.id)!)) {
      const direct = existingMap.get(issue.id)!;
      if (isMatchableStatus(direct.status, tab)) {
        matched = direct;
        finalId = matched.id;
      } else {
        finalId = nextAvailableId(issue.id, usedIds, allIds);
      }
    }
    // Tier 3: 풀 기반 제목 매칭 폴백 (basis_issue_id가 없을 때만 — 거부된 참조는 Tier 4로)
    else if (!issue.basis_issue_id) {
      const pool = activeExisting.filter(e => !usedIds.has(e.id));
      const poolMatch = findBestMatch(issue, pool);
      if (poolMatch) {
        matched = poolMatch;
        finalId = poolMatch.id;
      } else {
        finalId = nextAvailableId(issue.id, usedIds, allIds);
      }
    }
    // Tier 4: 신규 이슈 (basis_issue_id가 거부됐거나 매칭 없음)
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
