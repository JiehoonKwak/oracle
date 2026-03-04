import { describe, expect, test, vi } from 'vitest';
import { runDryRunSummary } from '../../src/cli/dryRun.js';
import type { RunOracleOptions } from '../../src/oracle.js';

const baseRunOptions: RunOracleOptions = {
  prompt: 'Explain the issue',
  model: 'gpt-5.2-pro',
  file: [],
};

describe('runDryRunSummary', () => {
  test('prints API token summary and file stats', async () => {
    const log = vi.fn();
    await runDryRunSummary(
      {
        runOptions: { ...baseRunOptions, file: ['notes.md'] },
        cwd: '/repo',
        version: '1.2.3',
        log,
      },
      {
        readFilesImpl: async () => [{ path: '/repo/notes.md', content: 'console.log("dry run")' }],
      },
    );
    const header = log.mock.calls.find(([entry]) => String(entry).includes('would call gpt-5.2-pro'));
    expect(header?.[0]).toContain('[dry-run]');
    expect(log.mock.calls.some(([entry]) => String(entry).includes('File Token Usage'))).toBe(true);
  });
});
