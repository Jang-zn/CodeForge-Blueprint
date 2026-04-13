import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileAnalyzeIssues } from '../../src/server/issue-reconciliation.js';
import { makeIssue } from '../helpers.js';
import type { ValidAnalyzeIssue } from '../../src/server/analysis-schema.js';

function html(issue: ValidAnalyzeIssue): string {
  return `<p>${issue.description}</p>`;
}

describe('reconcileAnalyzeIssues', () => {
  let existing: ReturnType<typeof makeIssue>[];

  beforeEach(() => {
    existing = [];
  });

  // Tier 1: basis_issue_id 명시 — 계승
  test('basis_issue_id 계승: 같은 id를 가리키면 기존 canonical id와 상태를 유지한다', () => {
    existing = [
      makeIssue({ id: 'p1', tab: 'review', category: 'P', title: '온보딩 단계 정의가 불명확함', status: 'resolved', memo: '회원가입 단계를 2단계로 줄이기' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'p1',
        basis_issue_id: 'p1',
        category: 'P',
        title: '온보딩 단계 정의가 불명확함',
        description: '같은 문제를 다시 지적',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-1', html);
    assert.equal(reconciled[0].id, 'p1');
    assert.equal(reconciled[0].status, 'resolved');
    assert.equal(reconciled[0].memo, '회원가입 단계를 2단계로 줄이기');
    assert.equal(reconciled[0].origin_id, null);
  });

  // Tier 1: basis_issue_id 명시 — 분할
  test('basis_issue_id 분할: 다른 id를 제안하면 split이 되고 origin_id가 설정된다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'review', category: 'A', title: '온보딩 문제', status: 'pending', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a1-1',
        basis_issue_id: 'a1',
        category: 'A',
        title: '온보딩 1단계 문제',
        description: '분할 이슈 1',
      },
      {
        id: 'a1-2',
        basis_issue_id: 'a1',
        category: 'A',
        title: '온보딩 2단계 문제',
        description: '분할 이슈 2',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-2', html);
    assert.equal(reconciled[0].id, 'a1-1');
    assert.equal(reconciled[0].origin_id, 'a1');
    assert.equal(reconciled[0].status, 'pending');
    assert.equal(reconciled[1].id, 'a1-2');
    assert.equal(reconciled[1].origin_id, 'a1');
  });

  // Tier 3: basis_issue_id 없어도 제목이 같으면 풀 매칭으로 계승
  test('basis_issue_id 없음: 제목이 같으면 Tier3 풀 매칭으로 기존 id와 상태를 계승한다', () => {
    existing = [
      makeIssue({ id: 'p1', tab: 'review', category: 'P', title: '온보딩 단계 정의가 불명확함', status: 'resolved', memo: '기존 메모' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a1',
        category: 'P',
        title: '온보딩 단계 정의가 불명확함',
        description: '같은 문제를 다시 지적',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-3', html);
    // basis_issue_id 없어도 Tier3 풀 매칭으로 p1 계승
    assert.equal(reconciled[0].id, 'p1');
    assert.equal(reconciled[0].status, 'resolved');
    assert.equal(reconciled[0].memo, '기존 메모');
  });

  // Tier 1 안전 검사: 잘못된 basis_issue_id는 차단
  test('Tier 1 안전 검사: 카테고리도 다르고 제목 유사도도 낮으면 basis_issue_id를 무시한다', () => {
    existing = [
      makeIssue({ id: 'be-api1', tab: 'backend', category: 'BE-API', title: '인증 API 설계', status: 'pending', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'fe-comp1',
        basis_issue_id: 'be-api1',
        category: 'FE-COMP',
        title: '화면 컴포넌트 계층 구조',
        description: '완전히 다른 도메인의 이슈',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'frontend', 'job-safe', html);
    // 카테고리 다름 + 제목 유사도 낮음 → Tier 1 차단 → fe-comp1로 신규 생성
    assert.equal(reconciled[0].id, 'fe-comp1');
    assert.equal(reconciled[0].status, 'pending');
    assert.equal(reconciled[0].memo, '');
  });

  // Tier 3 풀 매칭에서 deferred 제외
  test('Tier 3 풀 매칭: deferred 이슈는 풀에서 제외되어 매칭되지 않는다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'review', category: 'A', title: '동일한 제목의 이슈', status: 'deferred', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a2',
        category: 'A',
        title: '동일한 제목의 이슈',
        description: '같은 제목이지만 deferred라 풀 매칭 제외',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-pool-deferred', html);
    // deferred는 풀에서 제외 → a2로 신규 생성
    assert.equal(reconciled[0].id, 'a2');
    assert.equal(reconciled[0].status, 'pending');
  });

  // features 탭에서는 deferred 이슈도 풀 매칭 가능
  test('Tier 3 풀 매칭: features 탭에서는 deferred 이슈가 매칭된다', () => {
    existing = [
      makeIssue({ id: 'ft-def1', tab: 'features', category: 'FT-DEF', title: '보류 기능 재검토', status: 'deferred', memo: '다음 버전에 검토' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'ft1',
        category: 'FT-DEF',
        title: '보류 기능 재검토',
        description: 'features 탭이라 deferred도 매칭됨',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'features', 'job-feat-def', html);
    // features 탭 → deferred 매칭 허용
    assert.equal(reconciled[0].id, 'ft-def1');
    assert.equal(reconciled[0].status, 'deferred');
  });

  // archived 이슈는 어느 탭에서도 매칭 불가
  test('Tier 3 풀 매칭: archived 이슈는 features 탭에서도 매칭되지 않는다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'features', category: 'A', title: '동일한 제목의 이슈', status: 'archived', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      { id: 'a2', category: 'A', title: '동일한 제목의 이슈', description: 'archived는 제외' },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'features', 'job-archived', html);
    assert.equal(reconciled[0].id, 'a2');
    assert.equal(reconciled[0].status, 'pending');
  });

  // Tier 3 풀 매칭에서 dismissed 제외
  test('Tier 3 풀 매칭: dismissed 이슈는 풀에서 제외되어 매칭되지 않는다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'review', category: 'A', title: '동일한 제목의 이슈', status: 'dismissed', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a2',
        category: 'A',
        title: '동일한 제목의 이슈',
        description: '같은 제목이지만 dismissed라 풀 매칭 제외',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-pool-dismissed', html);
    // dismissed는 풀에서 제외 → a2로 신규 생성
    assert.equal(reconciled[0].id, 'a2');
    assert.equal(reconciled[0].status, 'pending');
  });

  // Tier 2: 직접 ID 매칭 — deferred 이슈는 매칭 불가, 신규 생성
  test('Tier 2 직접 매칭: id와 제목이 같아도 deferred 이슈는 계승하지 않고 신규 생성된다', () => {
    existing = [
      makeIssue({ id: 'p1', tab: 'review', category: 'P', title: '핵심 가치 전달이 약함', status: 'deferred', memo: '다음 사이클에서 검토' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'p1',
        category: 'P',
        title: '핵심 가치 전달이 약함',
        description: '같은 취지의 문제',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-4', html);
    // deferred는 매칭 불가 → p1 충돌 → p2 신규 생성
    assert.equal(reconciled[0].id, 'p2');
    assert.equal(reconciled[0].status, 'pending');
    assert.equal(reconciled[0].memo, '');
  });

  // Tier 3: 신규 이슈 — id가 기존과 충돌하면 다음 번호 할당
  test('매칭되지 않는 새 이슈는 충돌 없는 새 id를 사용한다', () => {
    existing = [
      makeIssue({ id: 'p1', tab: 'review', category: 'P', title: '기존 이슈' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'p1',
        category: 'P',
        title: '완전히 새로운 이슈',
        description: '신규 발견',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-5', html);
    assert.equal(reconciled[0].id, 'p2');
    assert.equal(reconciled[0].status, 'pending');
    assert.equal(reconciled[0].memo, '');
  });

  test('Tier 2 직접 매칭: id가 같아도 제목 유사도가 낮으면 새 이슈로 처리된다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'review', category: 'A', title: '전혀 다른 이슈 제목입니다', status: 'pending', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a1',
        category: 'A',
        title: '완전히 새로운 다른 이슈',
        description: '신규',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-6', html);
    assert.equal(reconciled[0].id, 'a2');
    assert.equal(reconciled[0].status, 'pending');
  });

  // deferred 이슈는 Tier 1에서도 계승 불가
  test('deferred basis_issue_id: AI가 deferred 이슈를 가리켜도 매칭하지 않는다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'review', category: 'A', title: '보류된 이슈', status: 'deferred', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a1',
        basis_issue_id: 'a1',
        category: 'A',
        title: '보류된 이슈 재활용 시도',
        description: '이것은 차단되어야 함',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-def1', html);
    assert.equal(reconciled[0].id, 'a2');
    assert.equal(reconciled[0].status, 'pending');
  });

  // dismissed 이슈는 Tier 1에서도 계승/분할 불가
  test('dismissed basis_issue_id: AI가 dismissed 이슈를 가리켜도 매칭하지 않는다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'review', category: 'A', title: '삭제된 이슈', status: 'dismissed', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a1',
        basis_issue_id: 'a1',
        category: 'A',
        title: '삭제된 이슈 재활용 시도',
        description: '이것은 차단되어야 함',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-d1', html);
    assert.equal(reconciled[0].id, 'a2');
    assert.equal(reconciled[0].status, 'pending');
  });

  // dismissed 이슈는 Tier 2에서도 매칭 불가
  test('dismissed 직접 매칭: 제목이 같아도 dismissed 이슈는 계승하지 않는다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'review', category: 'A', title: '동일한 제목', status: 'dismissed', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a1',
        category: 'A',
        title: '동일한 제목',
        description: '같은 제목이지만 dismissed라 매칭 안됨',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-d2', html);
    assert.equal(reconciled[0].id, 'a2');
    assert.equal(reconciled[0].status, 'pending');
  });

  // 여러 이슈 — usedIds 충돌 방지
  test('여러 이슈 처리 시 id 중복 없이 각각 고유 id를 갖는다', () => {
    const analyzed: ValidAnalyzeIssue[] = [
      { id: 'a1', category: 'A', title: '이슈 1', description: '설명 1' },
      { id: 'a1', category: 'A', title: '이슈 2', description: '설명 2' },
      { id: 'a1', category: 'A', title: '이슈 3', description: '설명 3' },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, [], 'review', 'job-7', html);
    const ids = reconciled.map(r => r.id);
    assert.deepEqual(ids, ['a1', 'a2', 'a3']);
  });

  // 크로스탭 ID 충돌 방지: globalIssueIds로 다른 탭 이슈 보호
  test('globalIssueIds: 다른 탭에 존재하는 ID와 충돌하면 다음 번호를 할당한다', () => {
    const analyzed: ValidAnalyzeIssue[] = [
      { id: 'a1', category: 'A', title: '백엔드 이슈', description: '설명' },
    ];

    // a1은 review 탭에 존재하지만 backend 탭에는 없음
    const globalIds = new Set(['a1', 'b1', 'c1']);
    const reconciled = reconcileAnalyzeIssues(analyzed, [], 'backend', 'job-g1', html, { globalIssueIds: globalIds });
    assert.equal(reconciled[0].id, 'a2');
  });

  // Tier 3 카테고리 격리: 카테고리가 다른 동일 제목 이슈는 풀 매칭 제외
  test('Tier 3 풀 매칭: 카테고리가 다르면 제목이 같아도 매칭하지 않는다', () => {
    existing = [
      makeIssue({ id: 'be1', tab: 'backend', category: 'BE', title: '동일한 제목의 이슈', status: 'resolved', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'fe1',
        category: 'FE',
        title: '동일한 제목의 이슈',
        description: '카테고리가 달라서 풀 매칭 제외',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'frontend', 'job-cat1', html);
    // 카테고리 불일치 → 신규 이슈
    assert.equal(reconciled[0].id, 'fe1');
    assert.equal(reconciled[0].status, 'pending');
  });

  // 거부된 basis_issue_id는 Tier 3 풀 매칭으로 fallthrough하지 않는다
  test('거부된 basis_issue_id: Tier 1 차단 후 같은 제목 풀 이슈가 있어도 신규 생성된다', () => {
    existing = [
      makeIssue({ id: 'a1', tab: 'review', category: 'A', title: '기존 이슈 제목', status: 'resolved', memo: '' }),
      makeIssue({ id: 'b1', tab: 'review', category: 'B', title: '완전히 다른 이슈', status: 'pending', memo: '' }),
    ];

    const analyzed: ValidAnalyzeIssue[] = [
      {
        id: 'a2',
        basis_issue_id: 'b1',       // b1은 카테고리 다르고 제목 유사도 낮음 → Tier 1 거부
        category: 'A',
        title: '기존 이슈 제목',     // a1과 제목 동일하지만 basis_issue_id가 거부됐으므로 Tier 3 진입 불가
        description: '거부된 참조',
      },
    ];

    const reconciled = reconcileAnalyzeIssues(analyzed, existing as any, 'review', 'job-reject1', html);
    // Tier 1 거부 → Tier 3 건너뜀 → Tier 4 신규
    assert.equal(reconciled[0].status, 'pending');
    assert.equal(reconciled[0].memo, '');
    // a1과 충돌하므로 a2 또는 그 이상
    assert.notEqual(reconciled[0].id, 'a1');
  });
});
