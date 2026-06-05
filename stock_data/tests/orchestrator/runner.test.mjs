import { describe, it, expect } from 'vitest';
import { runExtractor } from '../../src/orchestrator/runner.mjs';

describe('Python Extractor Runner', () => {
  it('should call python and receive valid JSON', async () => {
    const result = await runExtractor({
      filePath: './python/tests/fixtures/aaa_2024_sample.txt',
      ticker: 'AAA',
      businessModel: 'manufacturing'
    });
    
    expect(result.audit_report).toBeDefined();
    expect(result.audit_report.auditor_name).toMatch(/Ernst & Young/);
    expect(result.audit_report.audit_opinion).toBe('unqualified');
  }, 240000);
});
