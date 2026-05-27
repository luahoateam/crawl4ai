import { describe, it, expect } from 'vitest';
import { filterCompaniesAdvanced } from './filter';
import type { Company } from './api';

describe('Advanced Filter Utility', () => {
  const mockCompanies: Company[] = [
    { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', exchange: 'HOSE', industry: 'Thép' },
    { symbol: 'HSG', name: 'Tập đoàn Hoa Sen', exchange: 'HOSE', industry: 'Thép' },
    { symbol: 'VCB', name: 'Ngân hàng Vietcombank', exchange: 'HOSE', industry: 'Ngân hàng' },
    { symbol: 'ACB', name: 'Ngân hàng ACB', exchange: 'HNX', industry: 'Ngân hàng' },
    { symbol: 'VND', name: 'Chứng khoán VNDirect', exchange: 'HOSE', industry: 'Chứng khoán' },
    { symbol: 'SSI', name: 'Chứng khoán SSI', exchange: 'HOSE', industry: 'Chứng khoán' }
  ];

  it('should return all companies if filters are all', () => {
    const result = filterCompaniesAdvanced({ exchange: 'all', industry: 'all', searchQuery: '' }, mockCompanies);
    expect(result).toEqual(mockCompanies);
  });

  it('should filter by exchange', () => {
    const result = filterCompaniesAdvanced({ exchange: 'HOSE', industry: 'all', searchQuery: '' }, mockCompanies);
    expect(result.length).toBe(5);
    expect(result.every(c => c.exchange === 'HOSE')).toBe(true);

    const hnxResult = filterCompaniesAdvanced({ exchange: 'HNX', industry: 'all', searchQuery: '' }, mockCompanies);
    expect(hnxResult.length).toBe(1);
    expect(hnxResult[0].symbol).toBe('ACB');
  });

  it('should filter by industry', () => {
    const result = filterCompaniesAdvanced({ exchange: 'all', industry: 'Thép', searchQuery: '' }, mockCompanies);
    expect(result.length).toBe(2);
    expect(result.map(c => c.symbol)).toEqual(['HPG', 'HSG']);
  });

  it('should filter by both exchange and industry', () => {
    const result = filterCompaniesAdvanced({ exchange: 'HOSE', industry: 'Thép', searchQuery: '' }, mockCompanies);
    expect(result.length).toBe(2);

    const emptyResult = filterCompaniesAdvanced({ exchange: 'HNX', industry: 'Thép', searchQuery: '' }, mockCompanies);
    expect(emptyResult.length).toBe(0);
  });

  it('should filter with search query', () => {
    const result = filterCompaniesAdvanced({ exchange: 'all', industry: 'all', searchQuery: 'hòa phát' }, mockCompanies);
    expect(result.length).toBe(1);
    expect(result[0].symbol).toBe('HPG');
  });
});
