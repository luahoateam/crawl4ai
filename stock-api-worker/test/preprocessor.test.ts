import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';
// @ts-ignore - Sẽ được định nghĩa ở bước Green
import { FinancialOcrPreprocessor } from '../src/utils/preprocessor';

describe('FinancialOcrPreprocessor Unit Tests', () => {
  it('should clean duplicate whitespaces and retain max 1 consecutive empty line', () => {
    const rawText = "   Dòng 1     chứa   nhiều  khoảng   trắng.   \n\n\n\nDòng 2 sau nhiều dòng trống.   \n   \n   Dòng 3";
    const expected = "Dòng 1 chứa nhiều khoảng trắng.\n\nDòng 2 sau nhiều dòng trống.\n\nDòng 3";
    
    // cleanWhitespace loại bỏ khoảng trắng thừa đầu cuối dòng, nén khoảng trắng giữa từ,
    // và nén nhiều dòng trống liên tiếp thành tối đa 1 dòng trống (\n\n).
    const cleaned = FinancialOcrPreprocessor.cleanWhitespace(rawText);
    expect(cleaned).toBe(expected);
  });

  it('should remove OCR non-printable characters and line separators garbage', () => {
    const rawText = "Văn bản sạch.\n\nKý tự lỗi quét   hoặc  rác.\n_ _ _ _ _ _ _ _\n.......\n-------\nBCTC Hợp Nhất 2024";
    const expected = "Văn bản sạch.\n\nKý tự lỗi quét hoặc rác.\nBCTC Hợp Nhất 2024";
    
    // Dùng process để test khả năng dọn rác và nén khoảng trắng tích hợp
    const cleaned = FinancialOcrPreprocessor.process(rawText);
    expect(cleaned).toBe(expected);
  });

  it('should normalize Vietnamese Unicode NFC encoding', () => {
    // Ký tự Unicode phân rã (NFD): "hòạ" -> "h" + "o" + "̀" + "a" + "̣"
    const decompressed = "hòạ"; // Thực tế NFD có dấu tách rời
    const normalized = FinancialOcrPreprocessor.normalizeVietnamese(decompressed);
    
    // Chuẩn hóa NFC
    expect(normalized.normalize('NFC')).toBe(normalized);
  });
});

describe('CreateDocument API Integration with Preprocessor (Parallel Storage)', () => {
  it('POST /api/companies/AAA/documents should store both raw and preprocessed content in R2', async () => {
    const fileName = "bctc_dirty_2024.txt";
    const rawContent = "   Công ty   AAA   \n\n\n\n\n--- Bảng cân đối kế toán ---\n-------\nDoanh thu: 1000 tỷ.   ";
    
    const payload = {
      year: 2024,
      fileName: fileName,
      content: rawContent,
      label: "Bản Kiểm Thử Preprocessor"
    };

    const res = await app.request('/api/companies/AAA/documents', {
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

    const r2Key = data.result.r2Key;
    expect(r2Key).toBe(`documents/AAA/2024/${fileName}`);

    // 1. Kiểm tra xem file đã làm sạch (preprocessed) có được lưu tại r2Key
    const preprocessedObject = await env.BUCKET.get(r2Key);
    expect(preprocessedObject).toBeDefined();
    const preprocessedContent = await preprocessedObject!.text();
    
    // File preprocessed phải được làm sạch
    expect(preprocessedContent).toContain("Công ty AAA");
    expect(preprocessedContent).not.toContain("-------");
    expect(preprocessedContent).toContain("Doanh thu: 1000 tỷ.");

    // 2. Kiểm tra xem file gốc (raw) có được lưu song song tại documents/AAA/2024/raw_bctc_dirty_2024.txt
    const rawKey = `documents/AAA/2024/raw_${fileName}`;
    const rawObject = await env.BUCKET.get(rawKey);
    expect(rawObject).toBeDefined();
    const retrievedRawContent = await rawObject!.text();
    
    // File raw phải trùng khớp 100% với nội dung thô gửi lên ban đầu
    expect(retrievedRawContent).toBe(rawContent);
  });
});
