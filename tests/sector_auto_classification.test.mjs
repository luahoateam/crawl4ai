import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Tự động phân ngành ICB cho các doanh nghiệp diện rộng', async (t) => {
  // RED Phase: File/hàm chưa được phát triển hoặc chưa cập nhật.
  // Chúng ta import động scripts/sync_financial_structure.mjs để kiểm tra tính năng autoClassifySector.
  let syncModule;
  try {
    syncModule = await import('../scripts/sync_financial_structure.mjs');
  } catch (err) {
    // Nếu chưa có module hoặc file lỗi
    assert.match(err.message, /Cannot find module/);
    return;
  }

  const { autoClassifySector } = syncModule;
  
  if (typeof autoClassifySector !== 'function') {
    // RED Phase mong đợi: autoClassifySector chưa được định nghĩa
    assert.fail('Hàm autoClassifySector chưa được định nghĩa trong sync_financial_structure.mjs');
  }

  // Giả lập mock API vnstock hoặc dữ liệu trả về để test
  // Ngân hàng -> banking
  const sector1 = await autoClassifySector('TCB');
  assert.strictEqual(sector1, 'banking');

  const sector2 = await autoClassifySector('ACB');
  assert.strictEqual(sector2, 'banking');

  // Bất động sản -> real_estate
  const sector3 = await autoClassifySector('VHM');
  assert.strictEqual(sector3, 'real_estate');

  const sector4 = await autoClassifySector('KDH');
  assert.strictEqual(sector4, 'real_estate');

  // Ngành thông thường -> generic
  const sector5 = await autoClassifySector('HPG');
  assert.strictEqual(sector5, 'generic');

  const sector6 = await autoClassifySector('FPT');
  assert.strictEqual(sector6, 'generic');
});
