import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tạo một thư mục tạm cô lập hoàn toàn cho test chạy trên Windows
const testTempDir = path.resolve(__dirname, '..', 'tmp', `test_sync_${Math.random().toString(36).substring(7)}`);

test.before(() => {
  fs.mkdirSync(testTempDir, { recursive: true });
});

test.after(() => {
  if (fs.existsSync(testTempDir)) {
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }
});

test('Biên dịch JSON sang Markdown theo phân ngành', async (t) => {
  let syncModule;
  try {
    syncModule = await import('../scripts/sync_vn30_extracted.mjs');
  } catch (err) {
    // RED Phase mong đợi: Ném lỗi Module not found
    assert.match(err.message, /Cannot find module/);
    return;
  }

  const { formatToMarkdown } = syncModule;

  // 1. Nhóm Banks
  const bankJSON = {
    symbol: 'TCB',
    year: 2025,
    sector: 'banking',
    revenue_struct: 'Thu nhập lãi thuần (NII): 75%, Thu nhập dịch vụ: 25%',
    profit_struct: 'Lợi nhuận lãi thuần: 80%, Hoạt động dịch vụ: 20%',
    nim: '4.2%',
    casa: '40.5%',
    npl: '1.1%',
    llr: '120%',
    credit_growth: '15%',
    others: 'Kế hoạch phát hành cổ phiếu thưởng 100%'
  };

  const bankMD = formatToMarkdown(bankJSON);
  assert.ok(bankMD.revenueStruct.includes('2025: Thu nhập lãi thuần (NII): 75%, Thu nhập dịch vụ: 25%'));
  assert.ok(bankMD.revenueStruct.includes('NIM: 4.2% | CASA: 40.5% | NPL: 1.1% | LLR: 120% | Tăng trưởng tín dụng: 15%'));
  assert.ok(bankMD.profitStruct.includes('2025: Lợi nhuận lãi thuần: 80%, Hoạt động dịch vụ: 20%'));
  assert.ok(bankMD.others.includes('2025: Kế hoạch phát hành cổ phiếu thưởng 100%'));

  // 2. Nhóm Real Estate
  const reJSON = {
    symbol: 'VHM',
    year: 2025,
    sector: 'real_estate',
    revenue_struct: 'Chuyển nhượng BĐS: 90%, Cho thuê và dịch vụ: 10%',
    profit_struct: 'Lợi nhuận chuyển nhượng BĐS: 95%',
    inventory_status: 'Tồn kho dở dang tại Vinhomes Royal Island và Vinhomes Ocean Park 3 đạt 50,000 tỷ đồng',
    projects_progress: 'Bàn giao phân khu mới tại Vũ Yên và mở bán Vinhomes Cổ Loa',
    others: 'Mục tiêu doanh số bán hàng 2026 đạt 120,000 tỷ đồng'
  };

  const reMD = formatToMarkdown(reJSON);
  assert.ok(reMD.revenueStruct.includes('2025: Chuyển nhượng BĐS: 90%'));
  assert.ok(reMD.revenueStruct.includes('Dự án & Tiến độ: Bàn giao phân khu mới tại Vũ Yên'));
  assert.ok(reMD.revenueStruct.includes('Hàng tồn kho: Tồn kho dở dang tại Vinhomes Royal Island'));
  assert.ok(reMD.others.includes('2025: Mục tiêu doanh số bán hàng 2026 đạt 120,000 tỷ đồng'));

  // 3. Nhóm Generic
  const genericJSON = {
    symbol: 'HPG',
    year: 2025,
    sector: 'generic',
    revenue_struct: 'Thép xây dựng: 60%, HRC: 30%, Khác: 10%',
    profit_struct: 'Thép đóng góp 92% lợi nhuận gộp',
    physical_volume: 'Sản lượng tiêu thụ thép các loại đạt 8.5 triệu tấn (+15% yoy)',
    market_share: 'Thị phần thép xây dựng giữ vững vị thế số 1 với 38%',
    others: 'Lò cao số 1 dự án Dung Quất 2 chạy thử Q1/2026'
  };

  const genericMD = formatToMarkdown(genericJSON);
  assert.ok(genericMD.revenueStruct.includes('2025: Thép xây dựng: 60%'));
  assert.ok(genericMD.revenueStruct.includes('Sản lượng vật lý: Sản lượng tiêu thụ thép các loại đạt 8.5 triệu tấn'));
  assert.ok(genericMD.revenueStruct.includes('Thị phần: Thị phần thép xây dựng giữ vững vị thế số 1 với 38%'));
  assert.ok(genericMD.others.includes('2025: Lò cao số 1 dự án Dung Quất 2 chạy thử Q1/2026'));
});

test('Thuật toán Append-Sync ghép nối 2025 lên đầu Markdown cũ', async (t) => {
  let syncModule;
  try {
    syncModule = await import('../scripts/sync_vn30_extracted.mjs');
  } catch (err) {
    assert.match(err.message, /Cannot find module/);
    return;
  }

  const { appendMarkdown } = syncModule;

  const oldMD = `- 2024: Thép xây dựng: 55%, HRC: 35%. Sản lượng: 7.2 triệu tấn.\n- 2022: Thép xây dựng: 60%, HRC: 28%.`;
  const newMDLine = `2025: Thép xây dựng: 60%, HRC: 30%. Sản lượng: 8.5 triệu tấn.`;

  const result = appendMarkdown(oldMD, newMDLine, 2025);
  const lines = result.split('\n');

  assert.strictEqual(lines[0], `- 2025: Thép xây dựng: 60%, HRC: 30%. Sản lượng: 8.5 triệu tấn.`);
  assert.strictEqual(lines[1], `- 2024: Thép xây dựng: 55%, HRC: 35%. Sản lượng: 7.2 triệu tấn.`);
  assert.strictEqual(lines[2], `- 2022: Thép xây dựng: 60%, HRC: 28%.`);

  // Test không trùng lặp nếu đã có 2025
  const doubledResult = appendMarkdown(result, newMDLine, 2025);
  const doubledLines = doubledResult.split('\n');
  assert.strictEqual(doubledLines.length, 3, 'Không được chèn lặp lại năm 2025 đã tồn tại');
  assert.strictEqual(doubledLines[0], `- 2025: Thép xây dựng: 60%, HRC: 30%. Sản lượng: 8.5 triệu tấn.`);
});
