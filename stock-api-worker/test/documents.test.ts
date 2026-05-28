import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('OCR Documents API (TDD)', () => {
  it('POST /api/companies/AAA/documents should upload content and return 200', async () => {
    // Note: We assume AAA exists in the seeded DB for integration testing
    // In local dev, we run migrations first.
    
    const payload = {
      year: 2024,
      fileName: "test_report.txt",
      content: "Nội dung văn bản OCR tiếng Việt có dấu.",
      label: "Bản nháp"
    };

    const res = await app.request('/api/companies/AAA/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'Luahoachungkhoan@ssi'
      },
      body: JSON.stringify(payload)
    }, env);

    // Check status
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result.fileUrl).toContain('/api/documents/');
    
    // Test viewing the document
    const docId = data.result.id;
    const viewRes = await app.request(`/api/documents/${docId}/view`, undefined, env);
    expect(viewRes.status).toBe(200);
    const content = await viewRes.text();
    expect(content).toBe(payload.content);
  });
});
