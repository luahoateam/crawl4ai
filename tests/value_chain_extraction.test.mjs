import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tạo một thư mục tạm cô lập hoàn toàn cho test chạy trên Windows
const testTempDir = path.resolve(__dirname, '..', 'tmp', `test_value_chain_extract_${Math.random().toString(36).substring(7)}`);

test.before(() => {
  fs.mkdirSync(testTempDir, { recursive: true });
});

test.after(() => {
  if (fs.existsSync(testTempDir)) {
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }
});

test('Trích xuất AI Triple-Run bóc tách chuỗi giá trị thành công', async (t) => {
  let extractModule;
  try {
    extractModule = await import('../scripts/extract_vn30_structure.mjs');
  } catch (err) {
    assert.fail(`Không thể import extract_vn30_structure.mjs: ${err.message}`);
  }

  const { runAIExtraction } = extractModule;
  
  // Tạo file mock thô trong thư mục test tạm
  const mockRawDir = path.join(testTempDir, 'stock_data', 'vnstock_raw', 'HPG', '2025');
  fs.mkdirSync(mockRawDir, { recursive: true });
  fs.writeFileSync(path.join(mockRawDir, 'financial_health.json'), JSON.stringify({ raw_financials: 'HPG 2025' }), 'utf8');
  fs.writeFileSync(path.join(mockRawDir, 'news.json'), JSON.stringify({ raw_news: 'HPG Dung Quat 2 cap nhat' }), 'utf8');

  // Chạy trích xuất với mock AI function cho cả 3 Run
  const mockAISweep = async (prompt, schema) => {
    // Phân biệt các run dựa trên schema được truyền vào
    if (schema.properties.profit_struct) {
      // Run 1: Financial Sweep
      return {
        revenue_struct: "Bán thép: 80%, Bán quặng: 20%",
        profit_struct: "Bán thép: 90%, Bán quặng: 10%"
      };
    } else if (schema.properties.inputs) {
      // Run 3: Value Chain Sweep (mới)
      return {
        inputs: "- Quặng sắt: 35%\n- Than coke: 30%",
        production: "- BF/BOF: 95%\n- EAF: 5%",
        outputs: "- Nội địa: 70%\n- Xuất khẩu: 30%"
      };
    } else {
      // Run 2: Operational Sweep (generic)
      return {
        physical_volume: "8.5 triệu tấn",
        market_share: "34%",
        key_monitor_points_2026: "Dung Quất 2 dự kiến chạy thử Q1/2026.",
        others: "Kế hoạch mở rộng."
      };
    }
  };

  const outputDir = path.join(testTempDir, 'stock_data', 'extracted_structure');
  const resultFile = path.join(outputDir, 'HPG', '2025.json');

  const unifiedData = await runAIExtraction({
    symbol: 'HPG',
    year: 2025,
    rawDir: path.join(testTempDir, 'stock_data', 'vnstock_raw'),
    outputDir,
    aiClient: mockAISweep
  });

  // Xác minh các trường dữ liệu được gộp trong kết quả trả về và file ghi cache
  assert.ok(fs.existsSync(resultFile), 'File kết quả bóc tách 2025.json phải tồn tại');
  const fileContent = JSON.parse(fs.readFileSync(resultFile, 'utf8'));

  // Kiểm tra tính đầy đủ của 3 trường mới trong cả kết quả trả về và file JSON ghi trên đĩa
  for (const data of [unifiedData, fileContent]) {
    assert.strictEqual(data.symbol, 'HPG');
    assert.strictEqual(data.year, 2025);
    assert.ok(data.revenue_struct.includes('Bán thép'));
    
    // Các trường chuỗi giá trị mới bắt buộc phải có mặt và chứa nội dung bóc tách từ Run 3
    assert.ok(data.inputs, 'Trường inputs phải tồn tại');
    assert.ok(data.production, 'Trường production phải tồn tại');
    assert.ok(data.outputs, 'Trường outputs phải tồn tại');
    
    assert.ok(data.inputs.includes('Quặng sắt'));
    assert.ok(data.production.includes('BF/BOF'));
    assert.ok(data.outputs.includes('Nội địa'));
  }
});
