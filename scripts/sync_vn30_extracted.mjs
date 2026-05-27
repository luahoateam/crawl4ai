#!/usr/bin/env node
/**
 * sync_vn30_extracted.mjs
 *
 * Đồng bộ dữ liệu Business Model VN30 năm 2025 lên Cloudflare D1 Production.
 * - Đọc Unified JSON đã trích xuất từ stock_data/extracted_structure/{SYMBOL}/2025.json
 * - Biên dịch sang Markdown theo phân ngành (Banks, Real Estate, Generic)
 * - GET dữ liệu cũ của D1, chạy thuật toán Append ghép nối tiếp năm 2025 lên đầu
 * - PUT cập nhật ngược lại D1 Production
 * - Hỗ trợ resume-capable qua tmp/sync_state.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// ENV LOADER
// ─────────────────────────────────────────────────────────────────────────────

function loadEnv() {
  if (process.env.API_KEY) return;
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valParts] = trimmed.split('=');
      const val = valParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

loadEnv();

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTER: JSON -> MARKDOWN (Sector Specialized)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Biên dịch Unified JSON đã trích xuất sang chuỗi Markdown theo phân ngành.
 * Trả về { revenueStruct, profitStruct, others }
 */
export function formatToMarkdown(data) {
  const { symbol, year, sector, revenue_struct, profit_struct, others } = data;
  const yr = year || 2025;

  let revenueLine = `2025: ${revenue_struct || 'Đang cập nhật'}`;
  let profitLine = `2025: ${profit_struct || 'Đang cập nhật'}`;
  let othersLine = `2025: ${others || 'Đang cập nhật'}`;

  if (data.key_monitor_points_2026) {
    othersLine += `\n   * 📌 Điểm đáng chú ý theo dõi năm 2026: ${data.key_monitor_points_2026}`;
  }

  if (sector === 'banking') {
    // Nhóm Ngân hàng: NIM, CASA, NPL, LLR, Credit Growth
    const nimStr = data.nim ? `NIM: ${data.nim}` : null;
    const casaStr = data.casa ? `CASA: ${data.casa}` : null;
    const nplStr = data.npl ? `NPL: ${data.npl}` : null;
    const llrStr = data.llr ? `LLR: ${data.llr}` : null;
    const creditStr = data.credit_growth ? `Tăng trưởng tín dụng: ${data.credit_growth}` : null;

    const metrics = [nimStr, casaStr, nplStr, llrStr, creditStr].filter(Boolean).join(' | ');
    if (metrics) {
      revenueLine += `\n   * KPIs: ${metrics}`;
    }
  } else if (sector === 'real_estate') {
    // Nhóm BĐS: inventory_status, projects_progress
    if (data.projects_progress) {
      revenueLine += `\n   * Dự án & Tiến độ: ${data.projects_progress}`;
    }
    if (data.inventory_status) {
      revenueLine += `\n   * Hàng tồn kho: ${data.inventory_status}`;
    }
  } else {
    // Nhóm Generic: physical_volume, market_share
    if (data.physical_volume) {
      revenueLine += `\n   * Sản lượng vật lý: ${data.physical_volume}`;
    }
    if (data.market_share) {
      revenueLine += `\n   * Thị phần: ${data.market_share}`;
    }
  }

  return {
    revenueStruct: revenueLine,
    profitStruct: profitLine,
    others: othersLine
  };
}

/**
 * Định dạng các trường chuỗi giá trị (inputs, production, outputs) sang Markdown gạch đầu dòng có cấu trúc
 * @param {object} data - Unified JSON đã bóc tách
 * @returns {object} inputs, production, outputs ở dạng chuỗi Markdown thụt lề con
 */
export function formatValueChainToMarkdown(data) {
  const formatField = (text) => {
    if (!text) return '2025 (Cập nhật):\n   * Đang cập nhật';
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Loại bỏ dấu gạch đầu dòng cũ (-, *, +, 1., 2.) ở đầu dòng
        const cleaned = line.replace(/^[-*+\d.]+\s*/, '');
        return `   * ${cleaned}`;
      });
    return `2025 (Cập nhật):\n${lines.join('\n')}`;
  };

  return {
    inputs: formatField(data.inputs),
    production: formatField(data.production),
    outputs: formatField(data.outputs)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THUẬT TOÁN APPEND-SYNC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ghép nối tiếp dữ liệu Markdown của năm mới lên đầu dữ liệu cũ, không tạo trùng lặp
 * @param {string} oldText - Chuỗi Markdown cũ từ D1
 * @param {string} newTextLine - Dòng Markdown mới của năm
 * @param {string|number} year - Năm cần đồng bộ (ví dụ: 2025 hoặc '2025 (Cập nhật)')
 * @returns {string} Chuỗi Markdown sau khi đã ghép nối
 */
export function appendMarkdown(oldText, newTextLine, year = 2025) {
  const cleanOld = (oldText || '').trim();
  const cleanNew = newTextLine.trim();

  if (!cleanOld) {
    const newBlock = cleanNew.split('\n').map((l, idx) => {
      if (idx === 0) return l.startsWith('-') ? l : `- ${l}`;
      return l;
    }).join('\n');
    return newBlock;
  }

  // Tránh lỗi Regex đối với các ký tự đặc biệt có trong year (như dấu ngoặc đơn của '2025 (Cập nhật)')
  const escapedYear = year.toString().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const yearPattern = new RegExp(`^-\\s*\\*?\\*?${escapedYear}\\*?\\*?:`);

  // Tách văn bản cũ thành các dòng
  const lines = cleanOld.split('\n');

  // Tìm xem năm đã có trong chuỗi cũ chưa
  let existIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (yearPattern.test(lines[i])) {
      existIndex = i;
      break;
    }
  }

  if (existIndex !== -1) {
    // Đã tồn tại năm, ta cập nhật lại khối của năm đó
    // Tìm điểm bắt đầu của khối năm tiếp theo để thay thế chính xác khối
    let nextYearIndex = lines.length;
    for (let i = existIndex + 1; i < lines.length; i++) {
      if (/^-\s*(?:\d{4}|\d{4}\s*\(Cập nhật\)):/.test(lines[i])) {
        nextYearIndex = i;
        break;
      }
    }
    
    // Tạo mảng dòng mới cho năm
    const newBlockLines = cleanNew.split('\n').map((l, idx) => {
      if (idx === 0) {
        return l.startsWith('-') ? l : `- ${l}`;
      }
      return l;
    });
    lines.splice(existIndex, nextYearIndex - existIndex, ...newBlockLines);
    return lines.join('\n');
  } else {
    // Chưa tồn tại năm, chèn dòng mới lên đầu
    const newBlock = cleanNew.split('\n').map((l, idx) => {
      if (idx === 0) {
        return l.startsWith('-') ? l : `- ${l}`;
      }
      return l;
    }).join('\n');
    return `${newBlock}\n${cleanOld}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATE & FILE ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export function loadSyncState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return { synced_list: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!data.synced_list) data.synced_list = [];
    return data;
  } catch {
    return { synced_list: [] };
  }
}

export function saveSyncState(stateFile, state) {
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Đọc tất cả file JSON bóc tách được của năm 2025
 */
export function readExtractedFiles(extractedDir) {
  const results = [];
  if (!fs.existsSync(extractedDir)) return results;

  const symbols = fs.readdirSync(extractedDir).filter(f => {
    try {
      return fs.statSync(path.join(extractedDir, f)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const symbol of symbols) {
    const cacheFile = path.join(extractedDir, symbol, '2025.json');
    if (!fs.existsSync(cacheFile)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (data && data.symbol) {
        results.push(data);
      }
    } catch (e) {
      console.warn(`[WARN] Bỏ qua file JSON bị hỏng: ${cacheFile} — ${e.message}`);
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// D1 API INTEGRATION (GET & PUT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy dữ liệu business model hiện tại của doanh nghiệp trên D1
 */
async function getD1BusinessModel(symbol, opts) {
  const apiBaseUrl = opts.apiBaseUrl || process.env.API_BASE_URL || 'https://stock-api-worker.luahoachungkhoan.workers.dev/api';
  const apiKey = opts.apiKey || process.env.API_KEY || '';
  const url = `${apiBaseUrl}/companies/${symbol}/business-model`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`D1 GET HTTP ${response.status}`);
    }

    const resJson = await response.json();
    // Dữ liệu thực tế nằm trong trường 'result' theo chuẩn D1 Worker API
    return resJson.result || resJson || null;
  } catch (err) {
    console.warn(`[WARN] Không lấy được dữ liệu D1 cũ của ${symbol}: ${err.message}. Xem như mới.`);
    return null;
  }
}

/**
 * Tự động đăng ký công ty mới lên D1 nếu chưa tồn tại
 */
async function createD1Company(symbol, opts) {
  const apiBaseUrl = opts.apiBaseUrl || process.env.API_BASE_URL || 'https://stock-api-worker.luahoachungkhoan.workers.dev/api';
  const apiKey = opts.apiKey || process.env.API_KEY || '';
  const url = `${apiBaseUrl}/companies`;

  let exchange = 'UPCOM';
  let industry = 'Generic';
  const rawDir = path.resolve(__dirname, '..', 'stock_data', 'vnstock_raw');
  const overviewPath = path.join(rawDir, symbol, '2025', 'overview.json');
  
  if (fs.existsSync(overviewPath)) {
    try {
      const content = fs.readFileSync(overviewPath, 'utf8');
      const data = JSON.parse(content);
      const profile = Array.isArray(data) ? data[0] : data;
      if (profile) {
        let ex = (profile.exchange || profile.trade_exchange || 'UPCOM').toUpperCase();
        if (ex.includes('HOSE') || ex.includes('HSX')) exchange = 'HOSE';
        else if (ex.includes('HNX')) exchange = 'HNX';
        else exchange = 'UPCOM';
        
        industry = profile.icb_name3 || profile.icb_name2 || 'Generic';
      }
    } catch (e) {
      // bỏ qua lỗi đọc file
    }
  }

  const payload = {
    symbol: symbol,
    exchange: exchange,
    industry: industry
  };

  console.log(`[D1-AUTO-CREATE] Đang tự động đăng ký công ty mới ${symbol} (Sàn: ${exchange}, Ngành: ${industry})...`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Đăng ký công ty thất bại HTTP ${response.status}: ${text}`);
  }
  console.log(`✓ [D1-AUTO-CREATE] Đăng ký công ty ${symbol} thành công.`);
  return true;
}

/**
 * Gửi cập nhật ghép nối lên D1 qua PUT API
 */
async function putD1BusinessModel(symbol, payload, opts) {
  const apiBaseUrl = opts.apiBaseUrl || process.env.API_BASE_URL || 'https://stock-api-worker.luahoachungkhoan.workers.dev/api';
  const apiKey = opts.apiKey || process.env.API_KEY || '';
  const url = `${apiBaseUrl}/companies/${symbol}/business-model`;

  let response = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  // Nếu gặp lỗi Company not found (HTTP 404), tự động đăng ký công ty và thử lại lần 2
  if (response.status === 404) {
    console.log(`[D1-SYNC] Phát hiện mã ${symbol} chưa có trên D1. Đang tự động đăng ký...`);
    try {
      await createD1Company(symbol, opts);
      // Thử PUT lại lần 2
      response = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (createErr) {
      console.error(`[D1-SYNC] ✗ Tự động đăng ký mã ${symbol} thất bại: ${createErr.message}`);
      throw new Error(`Company not found on D1 and auto-creation failed.`);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 PUT HTTP ${response.status}: ${text}`);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────────────────────────────────────

export async function runSyncVN30(options = {}) {
  const extractedDir = options.extractedDir
    || path.resolve(__dirname, '..', 'stock_data', 'extracted_structure');

  const stateFile = options.stateFile
    || path.resolve(__dirname, '..', 'tmp', 'sync_state.json');

  const limit = options.limit ?? Infinity;

  console.log(`[SYNC-VN30] Khởi động. Thư mục bóc tách: ${extractedDir}`);

  // 1. Tải trạng thái sync
  const state = loadSyncState(stateFile);
  const syncedSet = new Set(state.synced_list);

  // 2. Đọc file JSON đã trích xuất
  const allItems = readExtractedFiles(extractedDir);
  console.log(`[SYNC-VN30] Tìm thấy ${allItems.length} hồ sơ VN30 đã trích xuất.`);

  // 3. Lọc chưa đồng bộ
  const pendingItems = allItems.filter(item => !syncedSet.has(`${item.symbol}:${item.year}`));
  const skippedCount = allItems.length - pendingItems.length;

  if (skippedCount > 0) {
    console.log(`[SYNC-VN30] Bỏ qua ${skippedCount} mã đã đồng bộ trước đó.`);
  }

  const targetItems = pendingItems.slice(0, limit);
  console.log(`[SYNC-VN30] Sẽ xử lý ${targetItems.length} mã.`);

  let successCount = 0;
  let failCount = 0;

  for (const item of targetItems) {
    const taskKey = `${item.symbol}:${item.year}`;
    console.log(`\n[SYNC-VN30] Đang đồng bộ ghép nối ${taskKey}...`);

    try {
      // a. Biên dịch JSON sang Markdown theo phân ngành
      const formattedMD = formatToMarkdown(item);

      // b. GET dữ liệu cũ từ D1 Production
      const oldBM = await getD1BusinessModel(item.symbol, options);
      
      const oldRev = oldBM ? (oldBM.revenue_struct || oldBM.revenueStruct || '') : '';
      const oldProf = oldBM ? (oldBM.profit_struct || oldBM.profitStruct || '') : '';
      const oldOthers = oldBM ? (oldBM.others || '') : '';
      const oldInputs = oldBM ? (oldBM.inputs || '') : '';
      const oldProd = oldBM ? (oldBM.production || '') : '';
      const oldOut = oldBM ? (oldBM.outputs || '') : '';

      // c. Chạy thuật toán Append chèn 2025 lên đầu
      const mergedRev = appendMarkdown(oldRev, formattedMD.revenueStruct, item.year);
      const mergedProf = appendMarkdown(oldProf, formattedMD.profitStruct, item.year);
      const mergedOthers = appendMarkdown(oldOthers, formattedMD.others, item.year);

      // Ghép nối chuỗi giá trị mới dạng 2025 (Cập nhật)
      const formattedVC = formatValueChainToMarkdown(item);
      const mergedInputs = appendMarkdown(oldInputs, formattedVC.inputs, '2025 (Cập nhật)');
      const mergedProd = appendMarkdown(oldProd, formattedVC.production, '2025 (Cập nhật)');
      const mergedOut = appendMarkdown(oldOut, formattedVC.outputs, '2025 (Cập nhật)');

      // d. PUT gửi dữ liệu đã ghép lên D1
      const payload = {
        revenueStruct: mergedRev,
        profitStruct: mergedProf,
        others: mergedOthers,
        inputs: mergedInputs,
        production: mergedProd,
        outputs: mergedOut
      };

      await putD1BusinessModel(item.symbol, payload, options);

      // e. Lưu trạng thái thành công
      state.synced_list.push(taskKey);
      saveSyncState(stateFile, state);
      syncedSet.add(taskKey);
      successCount++;
      console.log(`[SYNC-VN30] ✓ ${taskKey} đồng bộ ghép nối thành công.`);

    } catch (err) {
      failCount++;
      console.error(`[SYNC-VN30] ✗ Thất bại khi đồng bộ ${taskKey}: ${err.message}`);
    }
  }

  console.log(`\n[SYNC-VN30] ═══════════════════════════════════`);
  console.log(`[SYNC-VN30] Tổng kết:`);
  console.log(`  - Đã xử lý : ${targetItems.length}`);
  console.log(`  - Thành công: ${successCount}`);
  console.log(`  - Thất bại  : ${failCount}`);
  console.log(`  - Bỏ qua    : ${skippedCount}`);
  console.log(`[SYNC-VN30] ═══════════════════════════════════`);

  return {
    processed: targetItems.length,
    success: successCount,
    failed: failCount,
    skipped: skippedCount
  };
}
