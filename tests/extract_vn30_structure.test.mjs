import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tạo một thư mục tạm cô lập hoàn toàn cho test chạy trên Windows
const testTempDir = path.resolve(__dirname, '..', 'tmp', `test_extract_${Math.random().toString(36).substring(7)}`);

test.before(() => {
  fs.mkdirSync(testTempDir, { recursive: true });
});

test.after(() => {
  if (fs.existsSync(testTempDir)) {
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }
});

test('Phân ngành VN30 cho các mã chứng khoán', async (t) => {
  // Vì là RED phase nên module chưa tồn tại. Ta mock hoặc import động và catch lỗi.
  let extractModule;
  try {
    extractModule = await import('../scripts/extract_vn30_structure.mjs');
  } catch (err) {
    // RED Phase mong đợi: Ném lỗi Module not found
    assert.match(err.message, /Cannot find module/);
    return;
  }

  const { getSectorOfSymbol } = extractModule;
  assert.strictEqual(getSectorOfSymbol('TCB'), 'banking');
  assert.strictEqual(getSectorOfSymbol('VHM'), 'real_estate');
  assert.strictEqual(getSectorOfSymbol('HPG'), 'generic');
});

test('Trích xuất AI Dual-Run ghép nối 2 sweep thành công', async (t) => {
  let extractModule;
  try {
    extractModule = await import('../scripts/extract_vn30_structure.mjs');
  } catch (err) {
    assert.match(err.message, /Cannot find module/);
    return;
  }

  const { runAIExtraction } = extractModule;
  
  // Tạo file mock thô trong thư mục test tạm
  const mockRawDir = path.join(testTempDir, 'stock_data', 'vnstock_raw', 'HPG', '2025');
  fs.mkdirSync(mockRawDir, { recursive: true });
  fs.writeFileSync(path.join(mockRawDir, 'financial_health.json'), JSON.stringify({ raw_financials: 'HPG 2025' }), 'utf8');
  fs.writeFileSync(path.join(mockRawDir, 'news.json'), JSON.stringify({ raw_news: 'HPG Dung Quat 2 cap nhat' }), 'utf8');

  // Chạy trích xuất với mock AI function
  const mockAISweep = async (prompt, schema) => {
    if (schema.properties.profit_struct) {
      return {
        revenue_struct: "Bán thép: 80%, Bán quặng: 20%",
        profit_struct: "Bán thép: 90%, Bán quặng: 10%"
      };
    } else {
      return {
        others: "Dung Quất 2 dự kiến chạy thử Q1/2026, lò cao số 1 và số 2."
      };
    }
  };

  const outputDir = path.join(testTempDir, 'stock_data', 'extracted_structure');
  const resultFile = path.join(outputDir, 'HPG', '2025.json');

  await runAIExtraction({
    symbol: 'HPG',
    year: 2025,
    rawDir: path.join(testTempDir, 'stock_data', 'vnstock_raw'),
    outputDir,
    aiClient: mockAISweep
  });

  assert.ok(fs.existsSync(resultFile), 'File kết quả bóc tách 2025.json phải tồn tại');
  const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  assert.strictEqual(result.symbol, 'HPG');
  assert.strictEqual(result.year, 2025);
  assert.ok(result.revenue_struct.includes('Bán thép'));
  assert.ok(result.others.includes('Dung Quất 2'));
});
