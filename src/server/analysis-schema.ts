import type { Tab } from '../db/repository.js';

export interface AnalyzeIssueInput {
  id?: unknown;
  basis_issue_id?: unknown;
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
  flows?: unknown;
  screens?: unknown;
  screenStates?: unknown;
}

export interface ValidAnalyzeIssue {
  id: string;
  basis_issue_id?: string | null;
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

export function validateAnalyzeResults(items: AnalyzeResultInput[], tab: Tab): {
  issues: ValidAnalyzeIssue[];
  refItems: string[];
  flows?: unknown[];
  screens?: unknown[];
  screenStates?: unknown[];
} {
  const validIssues: ValidAnalyzeIssue[] = [];
  const refItems: string[] = [];
  const flows: unknown[] = [];
  const screens: unknown[] = [];
  const screenStates: unknown[] = [];

  for (const item of items) {
    if (Array.isArray(item.refItems)) {
      for (const ref of item.refItems) {
        const normalized = normalizeString(ref);
        if (normalized) refItems.push(normalized);
      }
    }

    // UX 탭: flows, screens, screenStates 추출
    if (tab === 'ux') {
      if (Array.isArray(item.flows)) {
        for (const flow of item.flows) {
          if (flow && typeof flow === 'object' && 'id' in flow && 'name' in flow) {
            flows.push(flow);
          }
        }
      }
      if (Array.isArray(item.screens)) {
        for (const screen of item.screens) {
          if (screen && typeof screen === 'object' && 'id' in screen && 'name' in screen) {
            screens.push(screen);
          }
        }
      }
      if (Array.isArray(item.screenStates)) {
        for (const state of item.screenStates) {
          if (state && typeof state === 'object' && 'screenId' in state && 'stateType' in state) {
            screenStates.push(state);
          }
        }
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

      const basis_issue_id = normalizeString(raw.basis_issue_id) ?? null;
      validIssues.push({
        id,
        basis_issue_id,
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

  const result: {
    issues: ValidAnalyzeIssue[];
    refItems: string[];
    flows?: unknown[];
    screens?: unknown[];
    screenStates?: unknown[];
  } = {
    issues: validIssues,
    refItems: Array.from(new Set(refItems)),
  };

  if (tab === 'ux') {
    result.flows = flows;
    result.screens = screens;
    result.screenStates = screenStates;
  }

  return result;
}
