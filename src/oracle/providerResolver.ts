export type ModelProvider = 'openai' | 'google' | 'anthropic' | 'xai' | 'other';

export function resolveProvider(model: string): ModelProvider {
  const bare = model.includes('/') ? model.split('/').slice(1).join('/') : model;
  if (bare.startsWith('gemini')) return 'google';
  if (bare.startsWith('claude')) return 'anthropic';
  if (bare.startsWith('grok')) return 'xai';
  if (bare.startsWith('gpt') || bare.startsWith('o1') || bare.startsWith('o3') || bare.startsWith('o4')) return 'openai';
  return 'other';
}
