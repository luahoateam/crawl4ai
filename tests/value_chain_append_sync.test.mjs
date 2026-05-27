import test from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Biên dịch và Định dạng Markdown chuỗi giá trị có cập nhật 2025', async (t) => {
  let syncModule;
  try {
    syncModule = await import('../scripts/sync_vn30_extracted.mjs');
  } catch (err) {
    assert.fail(`Không thể import sync_vn30_extracted.mjs: ${err.message}`);
  }

  const { formatValueChainToMarkdown } = syncModule;
  
  if (typeof formatValueChainToMarkdown !== 'function') {
    assert.fail('Hàm formatValueChainToMarkdown chưa được định nghĩa (RED Phase)');
  }

  const mockItem = {
    symbol: 'HPG',
    year: 2025,
    inputs: "- Quặng sắt: 35%\n- Than coke: 30%",
    production: "- BF/BOF: 95%\n- EAF: 5%",
    outputs: "- Nội địa: 70%\n- Xuất khẩu: 30%"
  };

  const result = formatValueChainToMarkdown(mockItem);

  assert.ok(result.inputs, 'inputs MD phải tồn tại');
  assert.ok(result.production, 'production MD phải tồn tại');
  assert.ok(result.outputs, 'outputs MD phải tồn tại');

  // Đảm bảo có tiền tố "2025 (Cập nhật):" và định dạng thụt lề cho từng gạch đầu dòng con
  assert.ok(result.inputs.startsWith('2025 (Cập nhật):'));
  assert.ok(result.inputs.includes('   * Quặng sắt: 35%'));
  
  assert.ok(result.production.startsWith('2025 (Cập nhật):'));
  assert.ok(result.production.includes('   * BF/BOF: 95%'));

  assert.ok(result.outputs.startsWith('2025 (Cập nhật):'));
  assert.ok(result.outputs.includes('   * Nội địa: 70%'));
});

test('Thuật toán Append-Sync ghép nối tiếp và chèn đè 2025 (Cập nhật) chuỗi giá trị', async (t) => {
  let syncModule;
  try {
    syncModule = await import('../scripts/sync_vn30_extracted.mjs');
  } catch (err) {
    assert.fail(`Không thể import sync_vn30_extracted.mjs: ${err.message}`);
  }

  const { appendMarkdown } = syncModule;

  // Lịch sử cũ của D1 cho cột inputs (chứa dữ liệu năm 2024 thô)
  const oldMD = `- 2024:\n   * Than coke chiếm 40% chi phí sản xuất.\n   * Quặng sắt nhập khẩu 100%.`;
  
  // Dòng Markdown mới của năm 2025
  const newMDLine = `2025 (Cập nhật):\n   * Quặng sắt: 35%\n   * Than coke: 30%`;

  // Thử chèn lần đầu (khi chưa có 2025)
  const result = appendMarkdown(oldMD, newMDLine, '2025 (Cập nhật)');
  const lines = result.split('\n');

  assert.strictEqual(lines[0], `- 2025 (Cập nhật):`);
  assert.strictEqual(lines[1], `   * Quặng sắt: 35%`);
  assert.strictEqual(lines[2], `   * Than coke: 30%`);
  assert.strictEqual(lines[3], `- 2024:`);

  // Thử chèn lần 2 (để kiểm tra cơ chế chèn đè Idempotency)
  const updatedMDLine = `2025 (Cập nhật):\n   * Quặng sắt: 40%\n   * Than coke: 25%`;
  const doubledResult = appendMarkdown(result, updatedMDLine, '2025 (Cập nhật)');
  const doubledLines = doubledResult.split('\n');

  assert.strictEqual(doubledLines[0], `- 2025 (Cập nhật):`);
  assert.strictEqual(doubledLines[1], `   * Quặng sắt: 40%`);
  assert.strictEqual(doubledLines[2], `   * Than coke: 25%`);
  assert.strictEqual(doubledLines[3], `- 2024:`);
  
  // Tổng số dòng không đổi, chứng minh không bị lặp đè hoặc lỗi chèn trùng
  assert.strictEqual(doubledLines.length, 6, 'Không được lặp lại khối năm 2025 (Cập nhật)');
});
