import { vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  env: {
    API_URL: 'http://localhost:8787'
  }
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { fetchCompanies, fetchCompanyPack, fetchStats, fetchGlobalNews, fetchGlobalDocuments, fetchGlobalResearch, normalizeValueChain } from './api';

describe('API Client Library', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchCompanies', () => {
    it('should return a list of companies on success with COMPANY_NAMES mapping and badge fields', async () => {
      const mockApiResult = [
        { symbol: 'HPG', exchange: 'HOSE', industry: 'Thép', hasBusinessModel: true, hasResearch: false, newsCount: 5, docCount: 2 },
        { symbol: 'XYZ', exchange: 'HNX', industry: 'Công nghệ', hasBusinessModel: false, hasResearch: true, newsCount: 0, docCount: 0 }
      ];

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: mockApiResult }),
      } as Response);

      const result = await fetchCompanies();
      
      expect(result).toEqual([
        { symbol: 'HPG', name: 'Tập đoàn Hòa Phát', exchange: 'HOSE', industry: 'Thép', hasBusinessModel: true, hasResearch: false, newsCount: 5, docCount: 2 },
        { symbol: 'XYZ', name: 'Doanh nghiệp XYZ', exchange: 'HNX', industry: 'Công nghệ', hasBusinessModel: false, hasResearch: true, newsCount: 0, docCount: 0 }
      ]);
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
    it('should return company pack data on success and parse JSON strings from D1', async () => {
      const mockApiPack = {
        profile: { symbol: 'HPG', exchange: 'HOSE', industry: 'Thép', description: 'Mô tả Hòa Phát' },
        businessModel: {
          revenueStruct: JSON.stringify([{ item: 'Thép', value: 100 }]),
          profitStruct: JSON.stringify([{ item: 'Thép', value: 100 }]),
          inputs: JSON.stringify([{ item: 'Quặng', ratio: '50%' }]),
          production: '[]',
          outputs: '[]'
        },
        news: [
          { id: 1, title: 'Tin HPG', sourceUrl: 'http://news', createdAt: '2026-05-27T00:00:00.000Z' }
        ],
        documents: [
          { id: 1, fileName: 'BC 2025.pdf', fileUrl: 'http://docs', label: 'Báo cáo', createdAt: '2026-05-27T00:00:00.000Z' }
        ],
        research: {
          summary: 'Báo cáo nghiên cứu',
          lastUpdated: '2026-05-27T00:00:00.000Z'
        }
      };

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: mockApiPack }),
      } as Response);

      const result = await fetchCompanyPack('HPG');
      
      expect(result.company.name).toBe('Tập đoàn Hòa Phát');
      expect(result.businessModel.revenueStruct).toEqual([{ item: 'Thép', value: 100 }]);
      expect(result.businessModel.production).toEqual([]);
      expect(result.news[0].title).toBe('Tin HPG');
      expect(result.documents[0].type).toBe('Báo cáo');
      expect(result.dailyResearch[0].summary).toBe('Báo cáo nghiên cứu');
    });

    it('should fallback to empty arrays when business model JSON columns are malformed or empty', async () => {
      const mockApiPackMalformed = {
        profile: { symbol: 'XYZ', exchange: 'HNX', industry: 'Điện' },
        businessModel: {
          revenueStruct: '{malformed-json-string}',
          profitStruct: null,
          inputs: undefined
        },
        news: null,
        documents: undefined,
        research: null
      };

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: mockApiPackMalformed }),
      } as Response);

      const result = await fetchCompanyPack('XYZ');
      
      expect(result.company.name).toBe('Doanh nghiệp XYZ');
      expect(result.company.industry).toBe('Điện');
      expect(result.businessModel.revenueStruct).toEqual([]);
      expect(result.businessModel.profitStruct).toEqual([]);
      expect(result.news).toEqual([]);
      expect(result.documents).toEqual([]);
      expect(result.dailyResearch).toEqual([]);
    });

    it('should throw if company is not found (404)', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(fetchCompanyPack('INVALID')).rejects.toThrow('Company not found: INVALID');
    });
  });

  describe('fetchStats', () => {
    it('should return stats data on success', async () => {
      const mockStats = {
        companies: 1617,
        businessModels: 1429,
        dailyResearch: 560,
        news: 14888,
        documents: 18185
      };

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: mockStats }),
      } as Response);

      const result = await fetchStats();
      expect(result).toEqual(mockStats);
    });
  });

  describe('fetchGlobalNews', () => {
    it('should fetch global news with query params', async () => {
      const mockNews = [
        { id: 1, symbol: 'HPG', title: 'Tin HPG', sourceUrl: 'http://news', createdAt: '2026-05-27T00:00:00Z' }
      ];
      const mockPagination = { page: 1, perPage: 30, total: 1 };

      const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: mockNews, pagination: mockPagination }),
      } as Response);

      const result = await fetchGlobalNews({ symbol: 'HPG', page: 2, perPage: 10 });
      
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('/api/news?symbol=HPG&page=2&per_page=10'), expect.anything());
      expect(result.result).toBeDefined();
      expect(result.result[0].title).toBe('Tin HPG');
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('fetchGlobalDocuments', () => {
    it('should fetch global documents with query params', async () => {
      const mockDocs = [
        { id: 1, symbol: 'VNM', year: 2024, fileName: 'BC 2024.pdf', fileUrl: 'http://docs', label: 'Báo cáo', createdAt: '2026-05-27T00:00:00Z' }
      ];
      const mockPagination = { page: 1, perPage: 30, total: 1 };

      const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: mockDocs, pagination: mockPagination }),
      } as Response);

      const result = await fetchGlobalDocuments({ year: 2024 });
      
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('/api/documents?year=2024'), expect.anything());
      expect(result.result[0].fileName).toBe('BC 2024.pdf');
    });
  });

  describe('fetchGlobalResearch', () => {
    it('should fetch global research with query params', async () => {
      const mockResearch = [
        { symbol: 'HPG', summary: 'Tóm tắt HPG', lastUpdated: '2026-05-27T00:00:00Z', exchange: 'HOSE', industry: 'Thép' }
      ];
      const mockPagination = { page: 1, perPage: 20, total: 1 };

      const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, result: mockResearch, pagination: mockPagination }),
      } as Response);

      const result = await fetchGlobalResearch({ page: 1, perPage: 20 });
      
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('/api/research?page=1&per_page=20'), expect.anything());
      expect(result.result[0].summary).toBe('Tóm tắt HPG');
    });
  });

  describe('normalizeValueChain', () => {
    it('TC-U1: should return empty array for null, undefined, or empty string', () => {
      expect(normalizeValueChain(null)).toEqual([]);
      expect(normalizeValueChain(undefined)).toEqual([]);
      expect(normalizeValueChain('')).toEqual([]);
    });

    it('TC-U2: should parse valid JSON string of ValueChainItem array', () => {
      const json = '[{"item":"X","ratio":"45%","description":"Y"}]';
      expect(normalizeValueChain(json)).toEqual([
        { item: 'X', ratio: '45%', description: 'Y' }
      ]);
    });

    it('TC-U3: should parse raw text with dash bullet points', () => {
      const rawText = '- Dòng thứ nhất\n- Dòng thứ hai';
      expect(normalizeValueChain(rawText)).toEqual([
        { item: 'Dòng thứ nhất', ratio: '', description: '' },
        { item: 'Dòng thứ hai', ratio: '', description: '' }
      ]);
    });

    it('TC-U4: should parse raw text with asterisk bullet points', () => {
      const rawText = '* Dòng hoa thị một\n* Dòng hoa thị hai';
      expect(normalizeValueChain(rawText)).toEqual([
        { item: 'Dòng hoa thị một', ratio: '', description: '' },
        { item: 'Dòng hoa thị hai', ratio: '', description: '' }
      ]);
    });

    it('TC-U5: should return empty array and not throw on malformed JSON string', () => {
      expect(normalizeValueChain('[{bad}]')).toEqual([]);
    });

    it('TC-U6: should truncate items with more than 5 words and append "..."', () => {
      const rawText = '- Một hai ba bốn năm sáu bảy\n- Ngắn dưới năm từ';
      expect(normalizeValueChain(rawText)).toEqual([
        { item: 'Một hai ba bốn năm...', ratio: '', description: '' },
        { item: 'Ngắn dưới năm từ', ratio: '', description: '' }
      ]);
    });

    it('TC-U7: should return the array itself if the input is already an array', () => {
      const arr = [{ item: 'X', ratio: '45%', description: 'Y' }];
      expect(normalizeValueChain(arr)).toEqual(arr);
    });
  });
});
