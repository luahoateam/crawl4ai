import { describe, it, expect } from 'vitest';
import { classify } from '../../src/orchestrator/classifier.mjs';

describe('Ticker Classifier', () => {
  it('should classify known tickers correctly', () => {
    expect(classify('MBB')).toBe('bank');
    expect(classify('DXG')).toBe('real_estate');
    expect(classify('MWG')).toBe('retail');
    expect(classify('SSI')).toBe('securities');
    expect(classify('HPG')).toBe('manufacturing');
    expect(classify('UNKNOWN_XYZ')).toBe('general');
  });
});
