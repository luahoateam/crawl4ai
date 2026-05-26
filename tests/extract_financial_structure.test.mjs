/**
 * TDD RED Phase — Tests cho extract_financial_structure.mjs
 * Module này chưa tồn tại → tất cả tests sẽ FAIL khi chạy lần đầu.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sẽ FAIL ở import vì module chưa tồn tại — đây là RED phase
import * as extractor from '../scripts/extract_financial_structure.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 1: scanOcr2025Files()
// ─────────────────────────────────────────────────────────────────────────────

test('scanOcr2025Files() - chỉ trả về files trong thư mục năm 2025', () => {
  const ocrDir = path.resolve(__dirname, '..', 'tmp', 'test_scan_2025');

  // Setup: tạo cấu trúc thư mục có cả 2024 và 2025
  fs.mkdirSync(path.join(ocrDir, 'AAA', '2024', 'report'), { recursive: true });
  fs.mkdirSync(path.join(ocrDir, 'AAA', '2025', 'report'), { recursive: true });
  fs.mkdirSync(path.join(ocrDir, 'BBB', '2023'), { recursive: true });
  fs.mkdirSync(path.join(ocrDir, 'BBB', '2025'), { recursive: true });

  fs.writeFileSync(path.join(ocrDir, 'AAA', '2024', 'report', 'old.txt'), 'Báo cáo 2024');
  fs.writeFileSync(path.join(ocrDir, 'AAA', '2025', 'report', 'bctc2025.txt'), 'Báo cáo 2025');
  fs.writeFileSync(path.join(ocrDir, 'BBB', '2023', 'old.txt'), 'Báo cáo 2023');
  fs.writeFileSync(path.join(ocrDir, 'BBB', '2025', 'bctc2025.txt'), 'Báo cáo BBB 2025');

  try {
    const result = extractor.scanOcr2025Files(ocrDir);

    // Chỉ 2 file thuộc năm 2025 (AAA và BBB)
    assert.strictEqual(result.length, 2);

    const symbols = result.map(t => t.symbol).sort();
    assert.deepStrictEqual(symbols, ['AAA', 'BBB']);

    // Đảm bảo year luôn là 2025
    result.forEach(task => {
      assert.strictEqual(task.year, 2025);
      assert.ok(task.filePath.includes('2025'));
      assert.ok(task.symbol);
      assert.ok(task.fileName);
    });
  } finally {
    fs.rmSync(ocrDir, { recursive: true, force: true });
  }
});

test('scanOcr2025Files() - trả về mảng rỗng nếu không có file 2025', () => {
  const ocrDir = path.resolve(__dirname, '..', 'tmp', 'test_scan_no_2025');

  fs.mkdirSync(path.join(ocrDir, 'CCC', '2024'), { recursive: true });
  fs.writeFileSync(path.join(ocrDir, 'CCC', '2024', 'old.txt'), 'Báo cáo 2024');

  try {
    const result = extractor.scanOcr2025Files(ocrDir);
    assert.strictEqual(result.length, 0);
  } finally {
    fs.rmSync(ocrDir, { recursive: true, force: true });
  }
});

test('scanOcr2025Files() - trả về mảng rỗng nếu thư mục không tồn tại', () => {
  const ocrDir = path.resolve(__dirname, '..', 'tmp', 'nonexistent_dir_xyz');
  const result = extractor.scanOcr2025Files(ocrDir);
  assert.deepStrictEqual(result, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 2: runExtract()
// ─────────────────────────────────────────────────────────────────────────────

test('runExtract() - tạo file cache JSON đúng vị trí cho mỗi symbol', async () => {
  const ocrDir = path.resolve(__dirname, '..', 'tmp', 'test_extract_run');
  const extractedDir = path.resolve(__dirname, '..', 'tmp', 'test_extracted_structure');
  const stateFile = path.resolve(__dirname, '..', 'tmp', 'test_extract_state.json');
  const tempDir = path.resolve(__dirname, '..', 'tmp', 'test_extract_temp');

  // Setup OCR files
  fs.mkdirSync(path.join(ocrDir, 'AAA', '2025'), { recursive: true });
  fs.mkdirSync(path.join(ocrDir, 'BBB', '2025'), { recursive: true });
  fs.writeFileSync(path.join(ocrDir, 'AAA', '2025', 'bctc.txt'), 'Doanh thu AAA 2025: 500 tỷ');
  fs.writeFileSync(path.join(ocrDir, 'BBB', '2025', 'bctc.txt'), 'Doanh thu BBB 2025: 200 tỷ');

  if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);

  // Mock Python bridge: tạo file JSON output giả
  const mockCommand = async (inPath, outPath) => {
    const content = fs.readFileSync(inPath, 'utf8');
    const sym = content.includes('AAA') ? 'AAA' : 'BBB';
    fs.writeFileSync(outPath, JSON.stringify({
      revenue_struct: `Doanh thu ${sym} chủ yếu từ mảng A chiếm 70%`,
      profit_struct: `Lợi nhuận ${sym} đạt 20% biên lợi nhuận gộp`
    }), 'utf8');
  };

  try {
    const result = await extractor.runExtract({
      ocrDataDir: ocrDir,
      extractedDir,
      stateFile,
      tempDir,
      mockCommand
    });

    // Kết quả tổng hợp
    assert.strictEqual(result.processed, 2);
    assert.strictEqual(result.success, 2);
    assert.strictEqual(result.failed, 0);

    // File cache phải được tạo đúng vị trí
    const aaaCache = path.join(extractedDir, 'AAA', '2025.json');
    const bbbCache = path.join(extractedDir, 'BBB', '2025.json');

    assert.ok(fs.existsSync(aaaCache), `Cache file AAA phải tồn tại: ${aaaCache}`);
    assert.ok(fs.existsSync(bbbCache), `Cache file BBB phải tồn tại: ${bbbCache}`);

    // Nội dung JSON phải đúng
    const aaaData = JSON.parse(fs.readFileSync(aaaCache, 'utf8'));
    assert.ok(aaaData.revenue_struct, 'Phải có revenue_struct');
    assert.ok(aaaData.profit_struct, 'Phải có profit_struct');
    assert.ok(aaaData.symbol === 'AAA', 'Phải ghi đúng symbol');
    assert.ok(aaaData.year === 2025, 'Phải ghi đúng year');

    // State file phải được cập nhật
    const state = extractor.loadExtractState(stateFile);
    assert.ok(state.extracted_list.includes('AAA:2025'));
    assert.ok(state.extracted_list.includes('BBB:2025'));

  } finally {
    fs.rmSync(ocrDir, { recursive: true, force: true });
    fs.rmSync(extractedDir, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  }
});

test('runExtract() - skip symbol đã extract (resume mechanism)', async () => {
  const ocrDir = path.resolve(__dirname, '..', 'tmp', 'test_extract_resume');
  const extractedDir = path.resolve(__dirname, '..', 'tmp', 'test_extracted_resume');
  const stateFile = path.resolve(__dirname, '..', 'tmp', 'test_extract_resume_state.json');
  const tempDir = path.resolve(__dirname, '..', 'tmp', 'test_extract_resume_temp');

  fs.mkdirSync(path.join(ocrDir, 'AAA', '2025'), { recursive: true });
  fs.writeFileSync(path.join(ocrDir, 'AAA', '2025', 'bctc.txt'), 'Doanh thu AAA 2025');

  // Giả lập: AAA:2025 đã được extract trước đó
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ extracted_list: ['AAA:2025'] }), 'utf8');

  let mockCallCount = 0;
  const mockCommand = async (inPath, outPath) => {
    mockCallCount++;
    fs.writeFileSync(outPath, JSON.stringify({
      revenue_struct: 'test revenue',
      profit_struct: 'test profit'
    }), 'utf8');
  };

  try {
    const result = await extractor.runExtract({
      ocrDataDir: ocrDir,
      extractedDir,
      stateFile,
      tempDir,
      mockCommand
    });

    // Không gọi AI vì AAA:2025 đã trong state
    assert.strictEqual(mockCallCount, 0, 'Không được gọi AI bridge khi đã extract rồi');
    assert.strictEqual(result.processed, 0, 'Không có gì cần xử lý');
    assert.strictEqual(result.skipped, 1, 'Phải báo 1 skip');

  } finally {
    fs.rmSync(ocrDir, { recursive: true, force: true });
    fs.rmSync(extractedDir, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  }
});
