import { waddler } from 'waddler/d1';

// This is the ingestion logic for the AAA pilot using Waddler
export async function ingestAAA(env: { DB: D1Database; BUCKET: R2Bucket }) {
  console.log('🚀 Nạp dữ liệu AAA bằng Waddler (Correct Object Syntax)...');
  // @ts-ignore - Thư viện waddler 0.1.1 yêu cầu { client: DB } thay vì DB trực tiếp
  const sql = waddler({ client: env.DB });

  const now = Date.now();


  // 1. Insert Profile (Multi-tenant style with symbol)
  await sql`
    INSERT OR REPLACE INTO companies (symbol, exchange, industry, updated_at)
    VALUES ('AAA', 'HOSE', 'Bao bì', ${now})
  `.run();

  // 2. Insert Business Model
  await sql`
    INSERT OR REPLACE INTO business_models (symbol, revenue_struct, inputs, production, outputs)
    VALUES ('AAA', 'Bao bì nhựa (80%)', 'Hạt nhựa nguyên sinh', 'Dây chuyền extrude', 'Túi tự hủy')
  `.run();

  // 3. Insert Daily Research
  await sql`
    INSERT OR REPLACE INTO daily_research (symbol, summary, ssi_review, last_updated)
    VALUES ('AAA', 'Triển vọng tích cực từ mảng bao bì xanh', 'Duy trì khuyến nghị Khả quan', ${now})
  `.run();

  // 4. Record R2 Key
  await sql`
    INSERT INTO news_index (symbol, title, r2_key, created_at)
    VALUES ('AAA', 'Merged News 2026', 'content/AAA/news_merged.md', ${now})
  `.run();

  // 5. R2 Upload
  const content = `# Merged News for AAA (Waddler Wrapped)
- Date: 2026-05-17
- Summary: AAA is leading in biodegradable packaging.
- Financials: Revenue growth expected at 15% YoY.

Dữ liệu đã được nạp thành công qua lớp bọc Waddler trên Cloudflare D1!`;

  await env.BUCKET.put('content/AAA/news_merged.md', content);
  console.log('✅ AAA seeded successfully with Waddler!');
}
