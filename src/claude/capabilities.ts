import type { ProviderType } from '../db/repository.js';

export interface ProviderCapability {
  provider: ProviderType;
  model: string;
  label: string;
  supportsStreaming: boolean;
  supportsStructuredJson: boolean;
  maxPromptChars: number;
}

const CAPABILITIES: ProviderCapability[] = [
  {
    provider: 'claude',
    model: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    supportsStreaming: true,
    supportsStructuredJson: false,
    maxPromptChars: 200_000,
  },
  {
    provider: 'claude',
    model: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    supportsStreaming: true,
    supportsStructuredJson: false,
    maxPromptChars: 200_000,
  },
  {
    provider: 'codex',
    model: 'gpt-5.4',
    label: 'GPT-5.4',
    supportsStreaming: true,
    supportsStructuredJson: true,
    maxPromptChars: 120_000,
  },
];

export function getProviderCapabilities(): ProviderCapability[] {
  return CAPABILITIES;
}

export function getProviderCapability(provider: ProviderType, model: string): ProviderCapability | null {
  return CAPABILITIES.find(item => item.provider === provider && item.model === model) ?? null;
}
