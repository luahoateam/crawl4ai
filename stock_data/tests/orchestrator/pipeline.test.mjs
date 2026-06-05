import { describe, it, expect } from 'vitest';
import { runPipelineWithConcurrency, processSingleReport } from '../../src/orchestrator/pipeline.mjs';

describe('Pipeline Concurrency', () => {
  it('should not exceed max concurrency', async () => {
    let maxConcurrent = 0;
    let current = 0;
    
    const mockRunner = async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise(resolve => setTimeout(resolve, 50));
      current--;
      return {};
    };
    
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    await runPipelineWithConcurrency(items, mockRunner, { concurrency: 3 });
    
    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(maxConcurrent).toBeGreaterThan(1);
  });

  it('should skip reports already in D1 (idempotency)', async () => {
    let apiCallCount = 0;
    const mockRunner = async () => {
      apiCallCount++;
      return {};
    };
    
    const mockExistsChecker = async () => true;
    
    await processSingleReport(
      { ticker: 'AAA', year: 2024, reportType: 'consolidated', filePath: '...' },
      { runner: mockRunner, existsChecker: mockExistsChecker }
    );
    
    expect(apiCallCount).toBe(0);
  });
});
