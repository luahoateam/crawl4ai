import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('News API (TDD)', () => {
  it('POST /api/companies/AAA/news should upload content and return metadata', async () => {
    // 1. Giả lập dữ liệu doanh nghiệp AAA phải tồn tại trước (nếu không sẽ bị 404)
    // Trong môi trường test thực tế, ta sẽ dùng Drizzle/Waddler để nạp vào mock DB.
    // Ở đây ta test luồng logic chính.
    
    const payload = {
      title: "Merged News Test 2026",
      content: "# Title\nThis is a test news content for AAA."
    };

    const res = await app.request('/api/companies/AAA/news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'Luahoachungkhoan@ssi' // Dùng key production vừa thiết lập
      },
      body: JSON.stringify(payload)
    }, env);

    // Mong đợi kết quả thành công (200) hoặc lỗi logic (nếu chưa nạp AAA)
    // Với TDD, ta muốn thấy test fail trước.
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result.symbol).toBe('AAA');
    expect(data.result.r2Key).toContain('AAA');
  });
});
