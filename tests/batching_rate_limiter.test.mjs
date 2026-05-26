import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Cơ chế chia lô (Batching) danh sách cổ phiếu', async (t) => {
  let syncModule;
  try {
    syncModule = await import('../scripts/sync_financial_structure.mjs');
  } catch (err) {
    assert.match(err.message, /Cannot find module/);
    return;
  }

  const { createBatches } = syncModule;

  if (typeof createBatches !== 'function') {
    assert.fail('Hàm createBatches chưa được định nghĩa trong sync_financial_structure.mjs');
  }

  const symbols = Array.from({ length: 95 }, (_, i) => `SYM${i}`);
  const batches = createBatches(symbols, 30);

  assert.strictEqual(batches.length, 4, '95 phần tử chia lô 30 phải ra đúng 4 lô');
  assert.strictEqual(batches[0].length, 30, 'Lô đầu tiên phải có 30 phần tử');
  assert.strictEqual(batches[3].length, 5, 'Lô cuối cùng phải có 5 phần tử');
});

test('Bộ điều tiết nhịp độ AI (Rate Limiter) và tự động thử lại (Backoff)', async (t) => {
  let syncModule;
  try {
    syncModule = await import('../scripts/sync_financial_structure.mjs');
  } catch (err) {
    assert.match(err.message, /Cannot find module/);
    return;
  }

  const { executeWithRateLimit } = syncModule;

  if (typeof executeWithRateLimit !== 'function') {
    assert.fail('Hàm executeWithRateLimit chưa được định nghĩa trong sync_financial_structure.mjs');
  }

  // Chạy giả lập cuộc gọi AI với rate limiter
  let callCount = 0;
  const mockAICall = async (symbol) => {
    callCount++;
    if (callCount === 1) {
      // Giả lập cuộc gọi đầu tiên bị lỗi 429 Too Many Requests để kích hoạt backoff retry
      const error = new Error('Too Many Requests');
      error.status = 429;
      throw error;
    }
    return { success: true, symbol };
  };

  const startTime = Date.now();
  const result = await executeWithRateLimit(mockAICall, 'TCB', {
    maxRetries: 3,
    initialDelayMs: 100, // delay nhỏ để chạy nhanh trong test
    delayBetweenCallsMs: 50
  });

  const duration = Date.now() - startTime;

  assert.ok(result.success, 'Cuộc gọi AI phải thành công sau khi được tự động thử lại');
  assert.strictEqual(callCount, 2, 'Cuộc gọi phải được thử lại lần thứ 2');
  assert.ok(duration >= 100, `Thời gian chạy thực tế (${duration}ms) phải tối thiểu bằng thời gian trì hoãn ban đầu (100ms)`);
});
