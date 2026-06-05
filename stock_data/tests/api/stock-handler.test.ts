import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStockRequest } from '../../src/api/handlers/stock';
import { CacheManager } from '../../src/api/cache/cache-manager';

// Mock CacheManager
vi.mock('../../src/api/cache/cache-manager', () => {
  return {
    CacheManager: {
      get: vi.fn(),
      put: vi.fn(),
    }
  };
});

// Mock D1 Database
const mockD1 = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  all: vi.fn(),
};

const mockEnv = {
  DB: mockD1 as any,
};

const mockCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

describe('Stock Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ticker is missing', async () => {
    const req = new Request('http://localhost/api/v1/stock?year=2024');
    const res = await handleStockRequest(req, mockEnv, mockCtx);
    
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required params');
  });

  it('should return 400 if year is missing', async () => {
    const req = new Request('http://localhost/api/v1/stock?ticker=VCB');
    const res = await handleStockRequest(req, mockEnv, mockCtx);
    
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required params');
  });

  it('should return data from D1 and write to cache on cache miss', async () => {
    // Mock Cache Miss
    vi.mocked(CacheManager.get).mockResolvedValue(null);
    
    // Mock D1 queries
    mockD1.first.mockImplementation(async () => ({ id: '1', data: 'mocked_first' }));
    mockD1.all.mockImplementation(async () => ({ results: [{ id: '2', data: 'mocked_all' }] }));
    
    const req = new Request('http://localhost/api/v1/stock?ticker=VCB&year=2024');
    const res = await handleStockRequest(req, mockEnv, mockCtx);
    
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache-Status')).toBe('MISS');
    expect(res.headers.get('Cache-Control')).toContain('public, max-age');
    
    const body = await res.json();
    expect(body.ticker).toBe('VCB');
    expect(body.year).toBe(2024);
    expect(body.auditReport).toBeDefined();
    expect(body.relatedPartyTransactions).toBeDefined();
    
    // Verify cache.put was called
    expect(CacheManager.put).toHaveBeenCalled();
    // Verify D1 was queried
    expect(mockD1.prepare).toHaveBeenCalled();
  });

  it('should return data from cache directly on cache hit', async () => {
    // Mock Cache Hit
    const cachedData = {
      ticker: 'VCB',
      year: 2024,
      reportType: 'consolidated',
      data: 'from_cache'
    };
    const cachedResponse = new Response(JSON.stringify(cachedData), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache-Status': 'HIT'
      }
    });
    vi.mocked(CacheManager.get).mockResolvedValue(cachedResponse);
    
    const req = new Request('http://localhost/api/v1/stock?ticker=VCB&year=2024');
    const res = await handleStockRequest(req, mockEnv, mockCtx);
    
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Cache-Status')).toBe('HIT');
    
    const body = await res.json();
    expect(body.data).toBe('from_cache');
    
    // Verify D1 was NOT queried
    expect(mockD1.prepare).not.toHaveBeenCalled();
    // Verify cache.put was NOT called
    expect(CacheManager.put).not.toHaveBeenCalled();
  });
});
