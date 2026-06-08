import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('Company Pack API (TDD)', () => {
  it('GET /api/companies/VNM/pack should include documents list and metrics', async () => {
    const res = await app.request('/api/companies/VNM/pack', {
        headers: {
            'X-API-Key': 'Luahoachungkhoan@ssi'
        }
    }, env);

    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.profile).toBeDefined();
    expect(data.profile.symbol).toBe('VNM');
    
    // Kiểm tra xem các bảng metrics có trong pack và camelCase không
    expect(data.debtsBreakdown).toBeDefined();
    expect(Array.isArray(data.debtsBreakdown)).toBe(true);
    expect(data.debtsBreakdown.length).toBeGreaterThan(0);
    expect(data.debtsBreakdown[0]).toHaveProperty('creditorName');
    expect(data.debtsBreakdown[0]).not.toHaveProperty('creditor_name');

    expect(data.financialInsights).toBeDefined();
    expect(data.financialInsights.length).toBeGreaterThan(0);
    expect(data.financialInsights[0]).toHaveProperty('relatedPartyRisk');
    expect(data.financialInsights[0]).not.toHaveProperty('related_party_risk');

    expect(data.auditReports).toBeDefined();
    expect(data.auditReports.length).toBeGreaterThan(0);
    expect(data.auditReports[0]).toHaveProperty('auditorName');
    expect(data.auditReports[0].auditorName).toBe('KPMG');

    // Kiểm tra xem trường documents có tồn tại và là mảng không
    expect(data.documents).toBeDefined();
    expect(Array.isArray(data.documents)).toBe(true);
  });
});

