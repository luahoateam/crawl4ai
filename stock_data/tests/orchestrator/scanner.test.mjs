import { describe, it, expect } from 'vitest';
import { scanOcrDirectory } from '../../src/orchestrator/scanner.mjs';

describe('OCR Scanner', () => {
  it('should find all _extracted.txt files', async () => {
    const files = await scanOcrDirectory('./ocr_data');
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(f => f.filePath.endsWith('_extracted.txt'))).toBe(true);
  });

  it('should extract correct metadata from file path', async () => {
    const files = await scanOcrDirectory('./ocr_data');
    const aaa = files.find(f => f.ticker === 'AAA' && f.year === 2024);
    expect(aaa).toBeDefined();
    expect(aaa.year).toBe(2024);
    expect(aaa.reportType).toMatch(/consolidated|parent/);
  });
});
