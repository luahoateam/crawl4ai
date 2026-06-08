import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('Company Profile API (TDD)', () => {
  it('GET /api/companies/VNM returns company profile', async () => {
    const res = await app.request('/api/companies/VNM', undefined, env);
    const body: any = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result).toBeDefined();
    expect(body.result.symbol).toBe('VNM');
    expect(body.result.exchange).toBe('HOSE');
    
    // CamelCase checks
    expect(body.result).not.toHaveProperty('updated_at');
    expect(body.result).toHaveProperty('updatedAt');
  });

  it('GET /api/companies/INVALID returns 404', async () => {
    const res = await app.request('/api/companies/INVALID123', undefined, env);
    const body: any = await res.json();
    expect(res.status).toBe(404);
  });
});
