import { spawnClaude, spawnClaudeWithHandle } from './spawner.js';
import { spawnCodex, spawnCodexWithHandle } from './codex-spawner.js';
import type { SpawnOptions, SpawnResult } from './spawner.js';
import type { ChildProcess } from 'child_process';
import type { ProviderModel } from '../db/repository.js';
import { getProviderCapability, getProviderCapabilities } from './capabilities.js';

export interface ProviderHandle {
  promise: Promise<SpawnResult>;
  childReady: Promise<ChildProcess | null>;
}

function mockResult(prompt: string): string {
  if (prompt.includes('PRD(Product Requirements Document)')) {
    return `# Mock PRD v0.1.0

## 1. 서비스 개요
### 1.1 서비스 비전
사용자 아이디어를 빠르게 구조화해 문서화합니다.

## 2. 타겟 사용자
기획자와 개발자

## 3. 서비스 범위 (MVP)
PRD 생성, 리뷰, 설계 문서 생성

## 4. 기능 명세
- 아이디어 입력
- 리뷰 이슈 관리
- 문서 생성

## 5. 수익 모델
TBD

## 6. 기술 스택 (안)
TypeScript, Hono, SQLite

## 7. 배포 및 운영 환경
로컬 브라우저 대시보드

## 8. 제약 사항 및 리스크
LLM 출력 포맷 흔들림

## 9. 성공 지표 (KPI)
문서 생성 성공률`;
  }

  if (prompt.includes('기획 검토 전문가')) {
    return JSON.stringify({
      mode: 'A',
      issues: [
        {
          id: 'a1',
          category: 'A',
          title: '결제 정책 정의 부족',
          tag: 'blind',
          priority: 'P1',
          description: '구독/환불 경계가 문서에 부족합니다.',
          evidence: '수익 모델이 TBD로 남아 있습니다.',
          conclusion: '무료/유료 경계를 먼저 확정하세요.',
          callout_type: 'orange',
        },
        {
          id: 'd1',
          category: 'D',
          title: '비동기 상태 전환 설명 부족',
          tag: 'risk',
          priority: 'P1',
          description: '문서 생성과 리뷰 반영 사이의 상태 전이가 정의되지 않았습니다.',
          evidence: '작업 파이프라인 상세 정의가 없습니다.',
          conclusion: '작업 단계와 실패 복구 규칙을 추가하세요.',
          callout_type: 'orange',
        },
      ],
      refItems: ['낙관적 상태 업데이트 시 서버 동기화 실패 복구 필요'],
    });
  }

  if (prompt.includes('시니어 백엔드 아키텍트')) {
    return JSON.stringify({
      issues: [
        { id: 'be-api1', category: 'BE-API', title: '작업 상태 조회 API', tag: 'decision', priority: 'P1', description: 'job polling API를 분리합니다.', evidence: '장시간 AI 작업이 존재합니다.', conclusion: '세션 기반 조회를 사용합니다.', callout_type: 'blue' },
        { id: 'be-db1', category: 'BE-DB', title: '문서 기록 테이블', tag: 'decision', priority: 'P1', description: '생성 문서 메타데이터를 별도 저장합니다.', evidence: '버전 추적이 필요합니다.', conclusion: 'documents 테이블 추가', callout_type: 'blue' },
      ],
    });
  }

  if (prompt.includes('시니어 프론트엔드 아키텍트')) {
    return JSON.stringify({
      issues: [
        { id: 'fe-comp1', category: 'FE-COMP', title: '상태 대시보드 헤더', tag: 'decision', priority: 'P1', description: '현재 단계/오류/최근 문서를 한 곳에 보여줍니다.', evidence: '단계 인지가 어렵습니다.', conclusion: '상단 summary strip 추가', callout_type: 'blue' },
        { id: 'fe-api1', category: 'FE-API', title: '세션 헤더 주입', tag: 'dependency', priority: 'P1', description: '모든 API 요청에 세션 헤더를 실어 보냅니다.', evidence: '멀티 세션 안전성 필요', conclusion: 'API client 공통 처리', callout_type: 'blue' },
      ],
    });
  }

  if (prompt.includes('다음 버전 기능을 4개 관점')) {
    return JSON.stringify({
      issues: [
        { id: 'ft-mkt1', category: 'FT-MKT', title: '템플릿 갤러리', tag: 'marketing', priority: 'P1', description: '공개 템플릿으로 유입을 늘립니다.', evidence: '초기 유입 루프가 약합니다.', conclusion: 'build: 공유 가능한 결과물이 유입 경로가 됩니다.', callout_type: 'green' },
        { id: 'ft-tech1', category: 'FT-TECH', title: '스키마 검증 파이프라인', tag: 'tech', priority: 'P1', description: 'LLM 결과 검증 레이어를 추가합니다.', evidence: '구조화 출력 의존도가 높습니다.', conclusion: 'build: 안정성 향상', callout_type: 'green' },
      ],
    });
  }

  return `# Generated Document

- Mock output for testing
- Prompt length: ${prompt.length}`;
}

export function spawnProviderWithHandle(
  prompt: string,
  config: ProviderModel,
  options?: SpawnOptions,
): ProviderHandle {
  if (process.env.CODEFORGE_MOCK_PROVIDER === '1') {
    const result = mockResult(prompt);
    options?.onChunk?.(result);
    return {
      promise: Promise.resolve({ success: true, result }),
      childReady: Promise.resolve(null),
    };
  }
  const opts: SpawnOptions = { ...options, model: config.model };
  return config.provider === 'codex'
    ? spawnCodexWithHandle(prompt, opts)
    : spawnClaudeWithHandle(prompt, opts);
}

export async function spawnProvider(
  prompt: string,
  config: ProviderModel,
  options?: SpawnOptions,
): Promise<SpawnResult> {
  if (process.env.CODEFORGE_MOCK_PROVIDER === '1') {
    const result = mockResult(prompt);
    options?.onChunk?.(result);
    return { success: true, result };
  }
  const opts: SpawnOptions = { ...options, model: config.model };
  return config.provider === 'codex'
    ? spawnCodex(prompt, opts)
    : spawnClaude(prompt, opts);
}

export { getProviderCapability, getProviderCapabilities };
