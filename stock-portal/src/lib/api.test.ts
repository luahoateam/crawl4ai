import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCompanies, fetchCompanyPack } from './api';

describe('API Client Library', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchCompanies', () => {
    it('should return a list of companies on success', async () => {
      const mockCompanies = [
        { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', exchange: 'HOSE', industry: 'Thép' },
        { symbol: 'VCB', name: 'Vietcombank', exchange: 'HOSE', industry: 'Ngân hàng' }
      ];

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockCompanies,
      } as Response);

      const result = await fetchCompanies();
      expect(result).toEqual(mockCompanies);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8787/api/companies');
    });

    it('should throw an error on API failure', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(fetchCompanies()).rejects.toThrow('Failed to fetch companies: Internal Server Error');
    });
  });

  describe('fetchCompanyPack', () => {
    it('should return company pack data on success', async () => {
      const mockPack = {
        company: { symbol: 'HPG', name: 'Tập đoàn Hòa Phát' },
        businessModel: {
          revenueStruct: [],
          profitStruct: [],
          inputs: [],
          production: [],
          outputs: []
        },
        news: [],
        documents: [],
        dailyResearch: []
      };

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockPack,
      } as Response);

      const result = await fetchCompanyPack('HPG');
      expect(result).toEqual(mockPack);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8787/api/companies/HPG/pack');
    });

    it('should return null or throw if company not found', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(fetchCompanyPack('INVALID')).rejects.toThrow('Company not found: INVALID');
    });
  });
});
