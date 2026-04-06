import type { Tab } from '../db/repository.js';

export interface AnalyzeIssueInput {
  id?: unknown;
  category?: unknown;
  title?: unknown;
  tag?: unknown;
  priority?: unknown;
  description?: unknown;
  evidence?: unknown;
  conclusion?: unknown;
  callout_type?: unknown;
  confidence?: unknown;
}

export interface AnalyzeResultInput {
  issues?: unknown;
  refItems?: unknown;
}

export interface ValidAnalyzeIssue {
  id: string;
  category: string;
  title: string;
  tag?: string;
  priority?: string;
  description: string;
  evidence?: string;
  conclusion?: string;
  callout_type?: string;
  confidence?: number;
}

function normalizeString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function normalizeConfidence(v: unknown, priority?: string): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  if (priority === 'P0') return 0.95;
  if (priority === 'P1') return 0.75;
  return 0.55;
}

export function validateAnalyzeResults(items: AnalyzeResultInput[], tab: Tab): { issues: ValidAnalyzeIssue[]; refItems: string[] } {
  const issueIds = new Set<string>();
  const validIssues: ValidAnalyzeIssue[] = [];
  const refItems: string[] = [];

  for (const item of items) {
    if (Array.isArray(item.refItems)) {
      for (const ref of item.refItems) {
        const normalized = normalizeString(ref);
        if (normalized) refItems.push(normalized);
      }
    }

    if (!Array.isArray(item.issues)) continue;

    for (const raw of item.issues as AnalyzeIssueInput[]) {
      const id = normalizeString(raw.id);
      const category = normalizeString(raw.category);
      const title = normalizeString(raw.title);
      const description = normalizeString(raw.description);
      const priority = normalizeString(raw.priority) ?? 'P2';

      if (!id || !category || !title || !description) continue;
      if (issueIds.has(id)) continue;

      issueIds.add(id);
      validIssues.push({
        id,
        category,
        title,
        description,
        tag: normalizeString(raw.tag) ?? undefined,
        priority,
        evidence: normalizeString(raw.evidence) ?? undefined,
        conclusion: normalizeString(raw.conclusion) ?? undefined,
        callout_type: normalizeString(raw.callout_type) ?? undefined,
        confidence: normalizeConfidence(raw.confidence, priority),
      });
    }
  }

  if (tab === 'review') {
    validIssues.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }

  return { issues: validIssues, refItems: Array.from(new Set(refItems)) };
}
