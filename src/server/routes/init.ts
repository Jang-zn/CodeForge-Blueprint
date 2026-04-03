import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { upsertWorkspaceMeta, createJob, updateJob, getProviderModel } from '../../db/repository.js';
import { getWorkspace } from '../../workspace.js';
import { spawnProvider } from '../../claude/provider.js';
import { buildInitPrompt, type InitFormData } from '../../claude/prompts/init.js';

const initRoute = new Hono();

// POST /api/init — 선택지 폼 데이터 → PRD 초안 생성
initRoute.post('/', async (c) => {
  const db = getDb();
  const workspace = getWorkspace();
  const body = await c.req.json<InitFormData>();

  if (!body.detail?.trim()) {
    return c.json({ error: '상세 기획은 필수 입력입니다.' }, 400);
  }

  const jobId = crypto.randomUUID();
  createJob(db, jobId, 'generate-prd');

  // 비동기로 Claude CLI 실행
  (async () => {
    try {
      const prompt = buildInitPrompt(body);
      const result = await spawnProvider(prompt, getProviderModel(db));

      if (!result.success) {
        updateJob(db, jobId, 'failed', result.error);
        return;
      }

      // PRD 파일 저장
      const prdPath = path.join(workspace.docsPath, 'prd-v0.1.0.md');
      fs.writeFileSync(prdPath, result.result, 'utf-8');

      // workspace에 prd_path 업데이트
      upsertWorkspaceMeta(db, {
        name: body.projectName || workspace.name,
        prd_path: prdPath,
      });

      updateJob(db, jobId, 'completed');
    } catch (e) {
      updateJob(db, jobId, 'failed', String(e));
    }
  })();

  return c.json({ jobId });
});

// GET /api/init/prd — 생성된 PRD 내용 반환
initRoute.get('/prd', (c) => {
  const workspace = getWorkspace();
  const prdPath = path.join(workspace.docsPath, 'prd-v0.1.0.md');

  if (!fs.existsSync(prdPath)) {
    return c.json({ error: 'PRD 파일이 없습니다.' }, 404);
  }

  const content = fs.readFileSync(prdPath, 'utf-8');
  return c.json({ content, path: prdPath });
});

export default initRoute;
