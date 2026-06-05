import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheManager } from '../../src/api/cache/cache-manager';

// Mock global caches API of Cloudflare
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
};

global.caches = {
  default: mockCache,
} as any;

describe('CacheManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeUrl', () => {
    it('should normalize query parameters in alphabetical order', () => {
      const url1 = 'http://localhost/api/v1/stock?ticker=VCB&year=2024&reportType=consolidated';
      const url2 = 'http://localhost/api/v1/stock?reportType=consolidated&year=2024&ticker=VCB';
      
      const norm1 = CacheManager.normalizeUrl(url1);
      const norm2 = CacheManager.normalizeUrl(url2);
      
      expect(norm1).toBe(norm2);
      expect(norm1).toContain('reportType=consolidated');
      expect(norm1).toContain('ticker=VCB');
      expect(norm1).toContain('year=2024');
    });

    it('should handle URLs without query parameters', () => {
      const url = 'http://localhost/api/v1/stock';
      const norm = CacheManager.normalizeUrl(url);
      expect(norm).toBe(url);
    });
  });

  describe('get', () => {
    it('should return null when cache miss', async () => {
      mockCache.match.mockResolvedValue(undefined);
      
      const req = new Request('http://localhost/api/v1/stock?ticker=VCB');
      const res = await CacheManager.get(req);
      
      expect(res).toBeNull();
      expect(mockCache.match).toHaveBeenCalled();
    });

    it('should return response with X-Cache-Status: HIT when cache hit', async () => {
      const cachedRes = new Response(JSON.stringify({ data: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      mockCache.match.mockResolvedValue(cachedRes);
      
      const req = new Request('http://localhost/api/v1/stock?ticker=VCB');
      const res = await CacheManager.get(req);
      
      expect(res).not.toBeNull();
      expect(res!.headers.get('X-Cache-Status')).toBe('HIT');
      
      const body = await res!.json();
      expect(body).toEqual({ data: 'ok' });
    });
  });

  describe('put', () => {
    it('should not cache non-200 responses', async () => {
      const req = new Request('http://localhost/api/v1/stock?ticker=VCB');
      const res = new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
      
      await CacheManager.put(req, res);
      
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it('should cache 200 responses with Cache-Control header and X-Cache-Status: MISS', async () => {
      const req = new Request('http://localhost/api/v1/stock?ticker=VCB');
      const res = new Response(JSON.stringify({ data: 'ok' }), { status: 200 });
      
      await CacheManager.put(req, res, 600); // 10 minutes TTL
      
      expect(mockCache.put).toHaveBeenCalled();
      
      const [, putRes] = mockCache.put.mock.calls[0];
      expect(putRes.headers.get('Cache-Control')).toBe('public, max-age=600');
      expect(putRes.headers.get('X-Cache-Status')).toBe('MISS');
    });
  });
});
