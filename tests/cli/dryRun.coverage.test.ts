import { describe, expect, test, vi } from 'vitest';
import { runDryRunSummary } from '../../src/cli/dryRun.js';
import type { RunOracleOptions } from '../../src/oracle/types.js';

const baseRunOptions: RunOracleOptions = {
  prompt: 'Do it',
  system: 'SYS',
  file: [],
  model: 'gpt-5.2-pro',
};

describe('runDryRunSummary', () => {
  test('api dry run logs when no files match', async () => {
    const log = vi.fn();
    const readFilesImpl = vi.fn().mockResolvedValue([]);

    await runDryRunSummary(
      { runOptions: baseRunOptions, cwd: '/repo', version: '0.4.1', log },
      { readFilesImpl },
    );

    expect(log).toHaveBeenCalledWith(expect.stringContaining('[dry-run] Oracle (0.4.1) would call gpt-5.2-pro'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No files matched'));
  });
});
