import { describe, expect, test } from 'vitest';
import { resolveProvider } from '../../src/oracle/providerResolver.js';

describe('resolveProvider', () => {
  test('resolves Google provider from bare and prefixed model names', () => {
    expect(resolveProvider('gemini-3-pro')).toBe('google');
    expect(resolveProvider('google/gemini-3.1-pro-preview')).toBe('google');
  });

  test('resolves xAI provider from bare and prefixed model names', () => {
    expect(resolveProvider('grok-4.1')).toBe('xai');
    expect(resolveProvider('x-ai/grok-4.1-fast')).toBe('xai');
  });

  test('resolves OpenAI provider from various model prefixes', () => {
    expect(resolveProvider('gpt-5.2-pro')).toBe('openai');
    expect(resolveProvider('o1-preview')).toBe('openai');
    expect(resolveProvider('o3-mini')).toBe('openai');
    expect(resolveProvider('o4-mini')).toBe('openai');
  });

  test('resolves Anthropic provider from bare and prefixed model names', () => {
    expect(resolveProvider('claude-4.5-sonnet')).toBe('anthropic');
    expect(resolveProvider('anthropic/claude-4.5-sonnet')).toBe('anthropic');
  });

  test('returns other for unknown models', () => {
    expect(resolveProvider('custom-model')).toBe('other');
    expect(resolveProvider('mistral/mixtral-8x7b')).toBe('other');
  });
});
