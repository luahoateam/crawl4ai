import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

function hasSnakeCaseKeys(obj: any): boolean {
  if (obj === null || obj === undefined) return false;
  if (Array.isArray(obj)) {
    return obj.some(item => hasSnakeCaseKeys(item));
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (key.includes('_')) {
        return true;
      }
      if (hasSnakeCaseKeys(value)) {
        return true;
      }
    }
  }
  return false;
}

describe('CamelCase Response Verification', () => {
  it('/api/companies/VNM/pack has NO snake_case keys', async () => {
    const res = await app.request('/api/companies/VNM/pack', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(hasSnakeCaseKeys(body)).toBe(false);
  });

  it('/api/companies/VNM/business-model has NO snake_case keys', async () => {
    const res = await app.request('/api/companies/VNM/business-model', {
      headers: { 'X-API-Key': 'Luahoachungkhoan@ssi' }
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(hasSnakeCaseKeys(body)).toBe(false);
  });

  it('/api/companies/VNM/research has NO snake_case keys', async () => {
    const res = await app.request('/api/companies/VNM/research', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(hasSnakeCaseKeys(body)).toBe(false);
  });
});
