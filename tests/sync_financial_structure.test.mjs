import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as conductor from '../scripts/sync_financial_structure.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Conductor Script - runSync should orchestrate full flow and skip synced', async (t) => {
  const ocrDataDir = path.resolve(__dirname, '..', 'tmp', 'test_ocr_dir');
  const stateFile = path.resolve(__dirname, '..', 'tmp', 'test_sync_state.json');
  const tempDir = path.resolve(__dirname, '..', 'tmp', 'test_temp_sync');

  // 1. Tạo môi trường mock file system
  fs.mkdirSync(path.join(ocrDataDir, 'AAA', '2025'), { recursive: true });
  fs.mkdirSync(path.join(ocrDataDir, 'BBB', '2025'), { recursive: true });
  
  fs.writeFileSync(path.join(ocrDataDir, 'AAA', '2025', 'report.txt'), 'Văn bản BCTC AAA 2025');
  fs.writeFileSync(path.join(ocrDataDir, 'BBB', '2025', 'report.txt'), 'Văn bản BCTC BBB 2025');

  // Xóa file state cũ nếu có
  if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);

  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  let syncedSymbols = [];

  // Mock fetch API call
  globalThis.fetch = async (url, options) => {
    fetchCallCount++;
    const parts = url.split('/');
    const symbol = parts[parts.length - 2];
    syncedSymbols.push(symbol);
    return {
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
      text: async () => 'OK'
    };
  };

  // Mock Python command-line execution
  const mockCommand = async (inPath, outPath) => {
    const rawContent = fs.readFileSync(inPath, 'utf8');
    const symbol = rawContent.includes('AAA') ? 'AAA' : 'BBB';
    const mockExtraction = {
      revenue_struct: `Doanh thu mảng ${symbol} đạt 100 tỷ`,
      profit_struct: `Lợi nhuận mảng ${symbol} đạt 20 tỷ`
    };
    fs.writeFileSync(outPath, JSON.stringify(mockExtraction, null, 2), 'utf8');
  };

  try {
    // 2. Chạy sync lần đầu (xử lý cả 2 báo cáo AAA và BBB)
    const result = await conductor.runSync({
      ocrDataDir,
      stateFile,
      tempDir,
      mockCommand,
      apiKey: 'test-key',
      apiBaseUrl: 'http://test-api/api'
    });

    assert.strictEqual(result.processed, 2);
    assert.strictEqual(result.success, 2);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(fetchCallCount, 2);
    assert.deepStrictEqual(syncedSymbols.sort(), ['AAA', 'BBB']);

    // Xác nhận file state đã lưu trạng thái
    const state = conductor.loadState(stateFile);
    assert.strictEqual(state.success_list.length, 2);
    assert.ok(state.success_list.includes('AAA:2025'));
    assert.ok(state.success_list.includes('BBB:2025'));

    // 3. Tạo thêm báo cáo mới CCC
    fs.mkdirSync(path.join(ocrDataDir, 'CCC', '2025'), { recursive: true });
    fs.writeFileSync(path.join(ocrDataDir, 'CCC', '2025', 'report.txt'), 'Văn bản BCTC CCC 2025');

    // Chạy sync lần hai (chỉ xử lý CCC, bỏ qua AAA và BBB đã sync)
    syncedSymbols = [];
    fetchCallCount = 0;

    const result2 = await conductor.runSync({
      ocrDataDir,
      stateFile,
      tempDir,
      mockCommand,
      apiKey: 'test-key',
      apiBaseUrl: 'http://test-api/api'
    });

    assert.strictEqual(result2.processed, 1); // Chỉ xử lý CCC
    assert.strictEqual(result2.success, 1);
    assert.strictEqual(result2.failed, 0);
    assert.strictEqual(fetchCallCount, 1);
    assert.deepStrictEqual(syncedSymbols, ['CCC']);

    // Xác nhận file state đã cập nhật đầy đủ 3 reports
    const finalState = conductor.loadState(stateFile);
    assert.strictEqual(finalState.success_list.length, 3);
    assert.ok(finalState.success_list.includes('CCC:2025'));

  } finally {
    // 4. Khôi phục global fetch và dọn dẹp file system test
    globalThis.fetch = originalFetch;

    // Dọn dẹp thư mục test
    const rmSafe = (p) => {
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    };
    rmSafe(ocrDataDir);
    rmSafe(tempDir);
    rmSafe(stateFile);
  }
});
