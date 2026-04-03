import { spawnClaude } from './spawner.js';
import { spawnCodex } from './codex-spawner.js';
import type { SpawnOptions, SpawnResult } from './spawner.js';
import type { ProviderModel } from '../db/repository.js';

export async function spawnProvider(
  prompt: string,
  config: ProviderModel,
  options?: SpawnOptions,
): Promise<SpawnResult> {
  const opts: SpawnOptions = { ...options, model: config.model };
  return config.provider === 'codex'
    ? spawnCodex(prompt, opts)
    : spawnClaude(prompt, opts);
}
