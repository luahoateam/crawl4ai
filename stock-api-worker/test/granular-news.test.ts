import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('Granular News API (TDD)', () => {
  it('POST /api/companies/AAA/news should save article with sourceUrl and publishedDate', async () => {
    const payload = {
      title: "TDD Granular Article",
      content: "This is a granular news content for testing TDD.",
      sourceUrl: "https://example.com/news/1",
      publishedDate: "2025-10-28T10:00:00Z"
    };

    const res = await app.request('/api/companies/AAA/news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'Luahoachungkhoan@ssi'
      },
      body: JSON.stringify(payload)
    }, env);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result.sourceUrl).toBe(payload.sourceUrl);
    expect(new Date(data.result.publishedDate).getTime()).toBe(new Date(payload.publishedDate).getTime());
    
    // Check if it appears in list
    const listRes = await app.request('/api/companies/AAA/news', undefined, env);
    const listData = await listRes.json();
    expect(listData.result.some((n: any) => n.id === data.result.id)).toBe(true);
  });
});
