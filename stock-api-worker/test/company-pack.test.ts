import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('Company Pack API (TDD)', () => {
  it('GET /api/companies/VNM/pack should include documents list', async () => {
    const res = await app.request('/api/companies/VNM/pack', {
        headers: {
            'X-API-Key': 'Luahoachungkhoan@ssi'
        }
    }, env);

    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.profile).toBeDefined();
    expect(data.profile.symbol).toBe('VNM');
    
    // Kiểm tra xem trường documents có tồn tại và là mảng không
    expect(data.documents).toBeDefined();
    expect(Array.isArray(data.documents)).toBe(true);
    
    // Nếu có dữ liệu VNM đã nạp, kiểm tra xem có bản ghi nào không
    if (data.documents.length > 0) {
        const firstDoc = data.documents[0];
        expect(firstDoc).toHaveProperty('id');
        expect(firstDoc).toHaveProperty('year');
        expect(firstDoc).toHaveProperty('fileUrl');
        expect(firstDoc.fileUrl).toContain('/api/documents/');
    }
  });
});
