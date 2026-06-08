import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('Financial Metrics Endpoints (TDD)', () => {
  it('GET /api/companies/VNM/financial-insights returns data', async () => {
    const res = await app.request('/api/companies/VNM/financial-insights', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.result)).toBe(true);
    expect(body.result.length).toBeGreaterThan(0);
    
    // Check camelCase fields
    const item = body.result[0];
    expect(item.ticker).toBe('VNM');
    expect(item).toHaveProperty('relatedPartyRisk');
    expect(item).not.toHaveProperty('related_party_risk');
    expect(item).toHaveProperty('overallAnalysis');
  });

  it('GET /api/companies/VNM/debts-breakdown returns data', async () => {
    const res = await app.request('/api/companies/VNM/debts-breakdown', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.length).toBeGreaterThan(0);
    
    // Check camelCase fields
    const item = body.result[0];
    expect(item.ticker).toBe('VNM');
    expect(item).toHaveProperty('creditorName');
    expect(item).not.toHaveProperty('creditor_name');
  });

  it('GET /api/companies/VNM/inventories returns data', async () => {
    const res = await app.request('/api/companies/VNM/inventories', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.length).toBeGreaterThan(0);
    
    // Check camelCase fields
    const item = body.result[0];
    expect(item.ticker).toBe('VNM');
    expect(item).toHaveProperty('itemName');
    expect(item).not.toHaveProperty('item_name');
  });

  it('GET /api/companies/VNM/related-party-transactions returns data', async () => {
    const res = await app.request('/api/companies/VNM/related-party-transactions', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.length).toBeGreaterThan(0);
    
    // Check camelCase fields
    const item = body.result[0];
    expect(item.ticker).toBe('VNM');
    expect(item).toHaveProperty('relatedPartyName');
    expect(item).not.toHaveProperty('related_party_name');
  });

  it('GET /api/companies/VNM/banking-metrics returns data', async () => {
    const res = await app.request('/api/companies/VNM/banking-metrics', undefined, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.length).toBeGreaterThan(0);
    
    // Check camelCase fields
    const item = body.result[0];
    expect(item.ticker).toBe('VNM');
    expect(item).toHaveProperty('casaRatio');
    expect(item).not.toHaveProperty('casa_ratio');
  });
});
