import type { Issue } from '../db/repository.js';

const MAX_RECOMMENDATIONS_PER_BUCKET = 3;

export interface RecommendationItem {
  id: string;
  title: string;
  priority: string | null;
  tag: string | null;
  reason: string;
}

export interface Recommendations {
  now: RecommendationItem[];
  defer: RecommendationItem[];
  judge: RecommendationItem[];
}

type Bucket = 'now' | 'defer' | 'judge';

function normPriority(priority: string | null): string | null {
  if (!priority) return null;
  return priority.toUpperCase();
}

function normTag(tag: string | null): string | null {
  if (!tag) return null;
  return tag.toLowerCase();
}

function classifyReview(p: string | null, t: string | null): { bucket: Bucket; reason: string } {
  if (p === 'P0' && t === 'contradiction') return { bucket: 'now', reason: 'P0 정합성 모순 — 개발 착수 전 반드시 해결' };
  if (p === 'P0' && (t === 'blind' || t === 'risk')) return { bucket: 'judge', reason: 'P0이지만 트레이드오프가 있어 판단 필요' };
  if (p === 'P1' && t === 'contradiction') return { bucket: 'now', reason: '주요 흐름 모순 — 조기 수정 권장' };
  if (p === 'P1' && t === 'blind') return { bucket: 'judge', reason: '놓친 관점 — 검토 후 결정' };
  if (p === 'P1' && t === 'risk') return { bucket: 'defer', reason: '운영 리스크 — 출시 후 대응 가능' };
  if (p === 'P2') return { bucket: 'defer', reason: '프로덕션 단계에서 다뤄도 충분' };
  return { bucket: 'judge', reason: '우선순위 미지정 — 검토 후 분류' };
}

function classifyBackendFrontend(p: string | null, t: string | null): { bucket: Bucket; reason: string } {
  if (p === 'P0' && (t === 'decision' || t === 'dependency')) return { bucket: 'now', reason: '핵심 설계 결정 — 후속 작업 블로커' };
  if (p === 'P0' && t === 'trade-off') return { bucket: 'judge', reason: '양면이 있는 설계 — 맥락 판단 필요' };
  if (p === 'P1' && t === 'dependency') return { bucket: 'now', reason: '의존성 — 미리 결정해야 병렬 작업 가능' };
  if (p === 'P1' && t === 'decision') return { bucket: 'judge', reason: '설계 선택지 — 비교 후 결정' };
  if (p === 'P1' && t === 'trade-off') return { bucket: 'defer', reason: '트레이드오프 — 구현 중 재검토 가능' };
  if (p === 'P2') return { bucket: 'defer', reason: '최적화 단계에서 검토' };
  return { bucket: 'judge', reason: '우선순위 미지정 — 검토 후 분류' };
}

function classifyFeatures(p: string | null, t: string | null): { bucket: Bucket; reason: string } {
  if (p === 'P0') return { bucket: 'now', reason: '핵심 기능 — 다음 버전 필수' };
  if (p === 'P1' && t === 'service') return { bucket: 'now', reason: '서비스 핵심 — 사용자 가치 직결' };
  if (p === 'P1' && (t === 'tech' || t === 'marketing')) return { bucket: 'judge', reason: '기술/마케팅 관점 — ROI 판단 필요' };
  if (p === 'P1' && t === 'ops') return { bucket: 'defer', reason: '운영 개선 — 안정화 후 적용' };
  if (p === 'P2') return { bucket: 'defer', reason: '낮은 우선순위 — 여유 있을 때 검토' };
  return { bucket: 'judge', reason: '우선순위 미지정 — 검토 후 분류' };
}

export function computeRecommendations(issues: Issue[]): Recommendations {
  const result: Recommendations = { now: [], defer: [], judge: [] };

  const active = issues.filter(i => i.status === 'pending' || i.status === 'reviewing');

  for (const issue of active) {
    const p = normPriority(issue.priority);
    const t = normTag(issue.tag);

    let classification: { bucket: Bucket; reason: string };

    if (issue.tab === 'review') {
      classification = classifyReview(p, t);
    } else if (issue.tab === 'backend' || issue.tab === 'frontend') {
      classification = classifyBackendFrontend(p, t);
    } else {
      // features
      classification = classifyFeatures(p, t);
    }

    const item: RecommendationItem = {
      id: issue.id,
      title: issue.title,
      priority: issue.priority,
      tag: issue.tag,
      reason: classification.reason,
    };

    result[classification.bucket].push(item);
  }

  // 각 버킷은 sort_order 오름차순 (issues는 이미 sort_order ASC로 조회됨)
  result.now = result.now.slice(0, MAX_RECOMMENDATIONS_PER_BUCKET);
  result.defer = result.defer.slice(0, MAX_RECOMMENDATIONS_PER_BUCKET);
  result.judge = result.judge.slice(0, MAX_RECOMMENDATIONS_PER_BUCKET);

  return result;
}
