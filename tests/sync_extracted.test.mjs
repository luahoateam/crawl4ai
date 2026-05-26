/**
 * TDD RED Phase — Tests cho sync_extracted.mjs
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
import * as syncer from '../scripts/sync_extracted.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 1: readExtractedFiles()
// ─────────────────────────────────────────────────────────────────────────────

test('readExtractedFiles() - đọc đúng tất cả file JSON cache trong thư mục extracted', () => {
  const extractedDir = path.resolve(__dirname, '..', 'tmp', 'test_read_extracted');

  // Setup: tạo file JSON cache giả
  fs.mkdirSync(path.join(extractedDir, 'AAA'), { recursive: true });
  fs.mkdirSync(path.join(extractedDir, 'BBB'), { recursive: true });
  fs.mkdirSync(path.join(extractedDir, 'CCC'), { recursive: true });

  const aaaData = { symbol: 'AAA', year: 2025, revenue_struct: 'DT AAA 70% mảng A', profit_struct: 'LN AAA 20%' };
  const bbbData = { symbol: 'BBB', year: 2025, revenue_struct: 'DT BBB 60% mảng X', profit_struct: 'LN BBB 15%' };

  fs.writeFileSync(path.join(extractedDir, 'AAA', '2025.json'), JSON.stringify(aaaData), 'utf8');
  fs.writeFileSync(path.join(extractedDir, 'BBB', '2025.json'), JSON.stringify(bbbData), 'utf8');
  // CCC không có file 2025.json → bỏ qua

  try {
    const result = syncer.readExtractedFiles(extractedDir);

    assert.strictEqual(result.length, 2, 'Phải đọc đúng 2 file JSON');

    const symbols = result.map(r => r.symbol).sort();
    assert.deepStrictEqual(symbols, ['AAA', 'BBB']);

    const aaa = result.find(r => r.symbol === 'AAA');
    assert.ok(aaa.revenue_struct, 'Phải có revenue_struct');
    assert.ok(aaa.profit_struct, 'Phải có profit_struct');
    assert.strictEqual(aaa.year, 2025);

  } finally {
    fs.rmSync(extractedDir, { recursive: true, force: true });
  }
});

test('readExtractedFiles() - trả về mảng rỗng nếu thư mục không tồn tại', () => {
  const extractedDir = path.resolve(__dirname, '..', 'tmp', 'nonexistent_extracted_xyz');
  const result = syncer.readExtractedFiles(extractedDir);
  assert.deepStrictEqual(result, []);
});

test('readExtractedFiles() - bỏ qua file JSON bị hỏng (không parse được)', () => {
  const extractedDir = path.resolve(__dirname, '..', 'tmp', 'test_read_broken');

  fs.mkdirSync(path.join(extractedDir, 'AAA'), { recursive: true });
  fs.mkdirSync(path.join(extractedDir, 'BAD'), { recursive: true });

  fs.writeFileSync(
    path.join(extractedDir, 'AAA', '2025.json'),
    JSON.stringify({ symbol: 'AAA', year: 2025, revenue_struct: 'ok', profit_struct: 'ok' }),
    'utf8'
  );
  // File bị hỏng
  fs.writeFileSync(path.join(extractedDir, 'BAD', '2025.json'), 'INVALID JSON {{{', 'utf8');

  try {
    const result = syncer.readExtractedFiles(extractedDir);
    // Chỉ đọc được file hợp lệ, bỏ qua file hỏng
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].symbol, 'AAA');
  } finally {
    fs.rmSync(extractedDir, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 2: runSyncExtracted()
// ─────────────────────────────────────────────────────────────────────────────

test('runSyncExtracted() - gọi API đúng cho mỗi symbol chưa sync', async () => {
  const extractedDir = path.resolve(__dirname, '..', 'tmp', 'test_sync_extracted_run');
  const stateFile = path.resolve(__dirname, '..', 'tmp', 'test_sync_extracted_state.json');

  // Setup: 2 file JSON cache
  fs.mkdirSync(path.join(extractedDir, 'AAA'), { recursive: true });
  fs.mkdirSync(path.join(extractedDir, 'BBB'), { recursive: true });

  fs.writeFileSync(
    path.join(extractedDir, 'AAA', '2025.json'),
    JSON.stringify({ symbol: 'AAA', year: 2025, revenue_struct: 'DT AAA', profit_struct: 'LN AAA' }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(extractedDir, 'BBB', '2025.json'),
    JSON.stringify({ symbol: 'BBB', year: 2025, revenue_struct: 'DT BBB', profit_struct: 'LN BBB' }),
    'utf8'
  );

  if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);

  // Mock fetch
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  const syncedPayloads = [];

  globalThis.fetch = async (url, options) => {
    fetchCallCount++;
    const body = JSON.parse(options.body);
    syncedPayloads.push({ url, body });
    return {
      status: 200,
      ok: true,
      text: async () => 'OK',
      json: async () => ({ success: true })
    };
  };

  try {
    const result = await syncer.runSyncExtracted({
      extractedDir,
      stateFile,
      apiKey: 'test-key',
      apiBaseUrl: 'http://test-api/api'
    });

    assert.strictEqual(result.processed, 2);
    assert.strictEqual(result.success, 2);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(fetchCallCount, 2, 'Phải gọi API 2 lần');

    // Kiểm tra URL và payload gửi lên đúng
    const urlsSynced = syncedPayloads.map(p => p.url).sort();
    assert.ok(urlsSynced.some(u => u.includes('/AAA/business-model')));
    assert.ok(urlsSynced.some(u => u.includes('/BBB/business-model')));

    // Kiểm tra payload có đúng fields
    const aaaPayload = syncedPayloads.find(p => p.url.includes('/AAA/'));
    assert.ok(aaaPayload.body.revenueStruct || aaaPayload.body.revenue_struct, 'Phải gửi revenue_struct');
    assert.ok(aaaPayload.body.profitStruct || aaaPayload.body.profit_struct, 'Phải gửi profit_struct');

    // State file phải được lưu
    const state = syncer.loadSyncState(stateFile);
    assert.ok(state.synced_list.includes('AAA:2025'));
    assert.ok(state.synced_list.includes('BBB:2025'));

  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(extractedDir, { recursive: true, force: true });
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  }
});

test('runSyncExtracted() - skip symbol đã sync trong state (resume mechanism)', async () => {
  const extractedDir = path.resolve(__dirname, '..', 'tmp', 'test_sync_resume');
  const stateFile = path.resolve(__dirname, '..', 'tmp', 'test_sync_resume_state.json');

  fs.mkdirSync(path.join(extractedDir, 'AAA'), { recursive: true });
  fs.writeFileSync(
    path.join(extractedDir, 'AAA', '2025.json'),
    JSON.stringify({ symbol: 'AAA', year: 2025, revenue_struct: 'DT AAA', profit_struct: 'LN AAA' }),
    'utf8'
  );

  // Giả lập: AAA:2025 đã sync trước đó
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ synced_list: ['AAA:2025'] }), 'utf8');

  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  globalThis.fetch = async () => {
    fetchCallCount++;
    return { status: 200, ok: true, text: async () => 'OK' };
  };

  try {
    const result = await syncer.runSyncExtracted({
      extractedDir,
      stateFile,
      apiKey: 'test-key',
      apiBaseUrl: 'http://test-api/api'
    });

    assert.strictEqual(fetchCallCount, 0, 'Không được gọi API khi đã sync rồi');
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.skipped, 1, 'Phải báo 1 skip');

  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(extractedDir, { recursive: true, force: true });
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  }
});

test('runSyncExtracted() - xử lý lỗi API 404 gracefully và không dừng toàn bộ batch', async () => {
  const extractedDir = path.resolve(__dirname, '..', 'tmp', 'test_sync_error_handling');
  const stateFile = path.resolve(__dirname, '..', 'tmp', 'test_sync_error_state.json');

  fs.mkdirSync(path.join(extractedDir, 'AAA'), { recursive: true });
  fs.mkdirSync(path.join(extractedDir, 'FAIL'), { recursive: true });

  fs.writeFileSync(
    path.join(extractedDir, 'AAA', '2025.json'),
    JSON.stringify({ symbol: 'AAA', year: 2025, revenue_struct: 'ok', profit_struct: 'ok' }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(extractedDir, 'FAIL', '2025.json'),
    JSON.stringify({ symbol: 'FAIL', year: 2025, revenue_struct: 'ok', profit_struct: 'ok' }),
    'utf8'
  );

  if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('/FAIL/')) {
      return { status: 404, ok: false, text: async () => 'Company not found' };
    }
    return { status: 200, ok: true, text: async () => 'OK' };
  };

  try {
    const result = await syncer.runSyncExtracted({
      extractedDir,
      stateFile,
      apiKey: 'test-key',
      apiBaseUrl: 'http://test-api/api',
      maxRetries: 1
    });

    // AAA thành công, FAIL thất bại nhưng batch không bị crash
    assert.strictEqual(result.success, 1);
    assert.strictEqual(result.failed, 1);

  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(extractedDir, { recursive: true, force: true });
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  }
});
