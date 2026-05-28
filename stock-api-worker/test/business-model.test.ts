import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('Business Model API', () => {
  it('GET /api/companies/AAA/business-model should return profitStruct', async () => {
    const res = await app.request('/api/companies/AAA/business-model', {
      headers: {
        'X-API-Key': 'Luahoachungkhoan@ssi'
      }
    }, env);

    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.result.symbol).toBe('AAA');
    expect(data.result.revenueStruct).toBe('Bao bì nhựa (80%)');
    expect(data.result.profitStruct).toBe('Mảng bao bì xanh đóng góp 25% lợi nhuận gộp');
  });

  it('PUT /api/companies/AAA/business-model should update revenueStruct and profitStruct', async () => {
    const updateBody = {
      revenueStruct: 'Bao bì xuất khẩu (85%)',
      profitStruct: 'Mảng xuất khẩu đóng góp 30% lợi nhuận',
      inputs: 'Hạt nhựa tái sinh',
      production: 'Dây chuyền mới',
      outputs: 'Túi tự hủy sinh học',
      others: 'Dịch vụ logistics'
    };

    const res = await app.request('/api/companies/AAA/business-model', {
      method: 'PUT',
      headers: {
        'X-API-Key': 'Luahoachungkhoan@ssi',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    }, env);

    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.success).toBe(true);
    expect(data.result.symbol).toBe('AAA');
    expect(data.result.revenueStruct).toBe('Bao bì xuất khẩu (85%)');
    expect(data.result.profitStruct).toBe('Mảng xuất khẩu đóng góp 30% lợi nhuận');
    expect(data.result.inputs).toBe('Hạt nhựa tái sinh');

    // GET lại để verify database thực sự cập nhật
    const getRes = await app.request('/api/companies/AAA/business-model', {
      headers: {
        'X-API-Key': 'Luahoachungkhoan@ssi'
      }
    }, env);
    const getData = await getRes.json();
    expect(getData.result.revenueStruct).toBe('Bao bì xuất khẩu (85%)');
    expect(getData.result.profitStruct).toBe('Mảng xuất khẩu đóng góp 30% lợi nhuận');
  });

  it('PUT /api/companies/XYZ/business-model should return 404 for non-existent company', async () => {
    const updateBody = {
      revenueStruct: 'Unknown',
      profitStruct: 'Unknown'
    };

    const res = await app.request('/api/companies/XYZ/business-model', {
      method: 'PUT',
      headers: {
        'X-API-Key': 'Luahoachungkhoan@ssi',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    }, env);

    expect(res.status).toBe(404);
  });
});
