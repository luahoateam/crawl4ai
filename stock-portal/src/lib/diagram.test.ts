import { describe, it, expect } from 'vitest';
import { formatRatio, calculateColorIntensity } from './diagram';

describe('Diagram Helpers', () => {
  describe('formatRatio', () => {
    it('should format decimals to percentage strings', () => {
      expect(formatRatio(0.45)).toBe('45%');
      expect(formatRatio(0.085)).toBe('8.5%');
    });

    it('should format round numbers to percentage strings', () => {
      expect(formatRatio(45)).toBe('45%');
      expect(formatRatio(8)).toBe('8%');
    });

    it('should return percentage string as-is if formatted correctly', () => {
      expect(formatRatio('45%')).toBe('45%');
      expect(formatRatio('8.5%')).toBe('8.5%');
    });

    it('should default to empty string or 0% for invalid inputs', () => {
      expect(formatRatio('')).toBe('0%');
      expect(formatRatio(null as any)).toBe('0%');
    });
  });

  describe('calculateColorIntensity', () => {
    it('should return dark shades for high ratios', () => {
      expect(calculateColorIntensity('80%')).toBe('rgba(59, 130, 246, 0.9)');
      expect(calculateColorIntensity(75)).toBe('rgba(59, 130, 246, 0.9)');
    });

    it('should return medium shades for medium ratios', () => {
      expect(calculateColorIntensity('40%')).toBe('rgba(59, 130, 246, 0.65)');
    });

    it('should return light shades for small ratios', () => {
      expect(calculateColorIntensity('8%')).toBe('rgba(59, 130, 246, 0.3)');
    });
  });
});
