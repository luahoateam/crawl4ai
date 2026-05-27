import { describe, it, expect } from 'vitest';
import { filterCompanies } from './search';
import type { Company } from './api';

describe('Search Utility', () => {
  const mockCompanies: Company[] = [
    { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', exchange: 'HOSE', industry: 'Thép' },
    { symbol: 'HSG', name: 'Tập đoàn Hoa Sen', exchange: 'HOSE', industry: 'Thép' },
    { symbol: 'VCB', name: 'Ngân hàng Vietcombank', exchange: 'HOSE', industry: 'Ngân hàng' },
    { symbol: 'ACB', name: 'Ngân hàng ACB', exchange: 'HNX', industry: 'Ngân hàng' },
    { symbol: 'VND', name: 'Chứng khoán VNDirect', exchange: 'HOSE', industry: 'Chứng khoán' },
    { symbol: 'SSI', name: 'Chứng khoán SSI', exchange: 'HOSE', industry: 'Chứng khoán' },
    { symbol: 'FPT', name: 'Tập đoàn FPT', exchange: 'HOSE', industry: 'Công nghệ' },
    { symbol: 'MWG', name: 'Thế Giới Di Động', exchange: 'HOSE', industry: 'Bán lẻ' },
    { symbol: 'PNJ', name: 'Vàng bạc Phú Nhuận', exchange: 'HOSE', industry: 'Bán lẻ' }
  ];

  it('should return empty array if query is empty', () => {
    expect(filterCompanies('', mockCompanies)).toEqual([]);
    expect(filterCompanies('   ', mockCompanies)).toEqual([]);
  });

  it('should match by symbol case-insensitively', () => {
    expect(filterCompanies('hpg', mockCompanies)).toEqual([
      { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', exchange: 'HOSE', industry: 'Thép' }
    ]);
    expect(filterCompanies('HSG', mockCompanies)).toEqual([
      { symbol: 'HSG', name: 'Tập đoàn Hoa Sen', exchange: 'HOSE', industry: 'Thép' }
    ]);
  });

  it('should match by name case-insensitively', () => {
    const result = filterCompanies('chứng khoán', mockCompanies);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.symbol)).toContain('VND');
    expect(result.map(c => c.symbol)).toContain('SSI');
  });

  it('should limit results to maximum of 8 items', () => {
    const broadCompanies = Array.from({ length: 15 }, (_, i) => ({
      symbol: `C${i}`,
      name: `Company ${i}`,
      exchange: 'HOSE',
      industry: 'Test'
    }));

    const result = filterCompanies('company', broadCompanies);
    expect(result.length).toBe(8);
  });
});
