import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('Stats API (TDD)', () => {
  it('GET /api/stats should return stats for all 5 tables', async () => {
    const res = await app.request('/api/stats', undefined, env);
    expect(res.status).toBe(200);
    
    // Check Cache-Control header
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('public');
    expect(cacheControl).toContain('max-age=3600');

    const data: any = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.result).toBeDefined();
    expect(typeof data.result.companies).toBe('number');
    expect(typeof data.result.businessModels).toBe('number');
    expect(typeof data.result.dailyResearch).toBe('number');
    expect(typeof data.result.news).toBe('number');
    expect(typeof data.result.documents).toBe('number');

    expect(data.result.companies).toBeGreaterThanOrEqual(0);
    expect(data.result.businessModels).toBeGreaterThanOrEqual(0);
    expect(data.result.dailyResearch).toBeGreaterThanOrEqual(0);
    expect(data.result.news).toBeGreaterThanOrEqual(0);
    expect(data.result.documents).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/stats should return 500 when DB is missing', async () => {
    const brokenEnv = { ...env, DB: undefined as any };
    const res = await app.request('/api/stats', undefined, brokenEnv);
    expect(res.status).toBe(500);
    const data: any = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});
