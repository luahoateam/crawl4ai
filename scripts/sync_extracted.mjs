#!/usr/bin/env node
/**
 * sync_extracted.mjs
 *
 * Bước 2 của pipeline 2-bước: Sync-only
 * - Đọc tất cả file JSON cache từ stock_data/extracted_structure/{SYMBOL}/2025.json
 * - Gọi API Worker để cập nhật business_model trên Cloudflare D1 Production
 * - Quản lý state qua tmp/sync_state.json (resume-capable)
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
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đọc trạng thái sync từ file JSON
 * @param {string} stateFile
 * @returns {{ synced_list: string[] }}
 */
export function loadSyncState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return { synced_list: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!data.synced_list) {
      data.synced_list = [];
    }
    return data;
  } catch {
    console.warn(`[WARN] Không parse được sync state file, bắt đầu từ đầu.`);
    return { synced_list: [] };
  }
}

/**
 * Ghi trạng thái sync xuống file JSON
 * @param {string} stateFile
 * @param {{ synced_list: string[] }} state
 */
export function saveSyncState(stateFile, state) {
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE READER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đọc tất cả file JSON cache từ thư mục extracted_structure.
 * Bỏ qua file bị hỏng (không parse được JSON).
 *
 * @param {string} extractedDir - Đường dẫn đến thư mục extracted_structure
 * @returns {{ symbol: string, year: number, revenue_struct: string, profit_struct: string, [key: string]: any }[]}
 */
export function readExtractedFiles(extractedDir) {
  const results = [];

  if (!fs.existsSync(extractedDir)) {
    return results;
  }

  let symbols;
  try {
    symbols = fs.readdirSync(extractedDir).filter(f => {
      try {
        return fs.statSync(path.join(extractedDir, f)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return results;
  }

  for (const symbol of symbols) {
    const cacheFile = path.join(extractedDir, symbol, '2025.json');
    if (!fs.existsSync(cacheFile)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      // Đảm bảo có đủ field cơ bản
      if (data && (data.revenue_struct || data.profit_struct)) {
        results.push(data);
      }
    } catch (e) {
      console.warn(`[WARN] Bỏ qua file JSON bị hỏng: ${cacheFile} — ${e.message}`);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// API SYNC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gửi yêu cầu cập nhật business model lên API Worker với retry.
 *
 * @param {string} symbol
 * @param {object} data - { revenue_struct, profit_struct }
 * @param {object} opts - { apiKey, apiBaseUrl, maxRetries, retryDelayMs }
 */
async function callSyncApi(symbol, data, opts) {
  const apiKey = opts.apiKey || process.env.API_KEY || '';
  const apiBaseUrl = opts.apiBaseUrl || process.env.API_BASE_URL || '';
  const maxRetries = opts.maxRetries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 1000;

  const url = `${apiBaseUrl}/companies/${symbol}/business-model`;

  // Chuẩn hóa payload: hỗ trợ cả snake_case và camelCase, tự động serialize nếu là object
  const payload = {
    revenueStruct: typeof data.revenue_struct === 'object' ? JSON.stringify(data.revenue_struct, null, 2) : (data.revenue_struct || data.revenueStruct || ''),
    profitStruct: typeof data.profit_struct === 'object' ? JSON.stringify(data.profit_struct, null, 2) : (data.profit_struct || data.profitStruct || '')
  };

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 200) {
        return true;
      }

      // Lỗi Client (4xx) → không retry, ném lỗi ngay
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text();
        throw new Error(`Client error ${response.status}: ${errorText}`);
      }

      // Lỗi Server (5xx) → ghi lại và retry
      const errorText = await response.text();
      lastError = new Error(`Server error ${response.status}: ${errorText}`);

    } catch (error) {
      // Bắt lỗi client (ném lại ngay) hoặc network (retry)
      if (error.message && error.message.startsWith('Client error')) {
        throw error;
      }
      lastError = error;
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`Sync thất bại cho ${symbol} sau ${maxRetries} lần thử. Lỗi cuối: ${lastError?.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SYNC RUNNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chạy quá trình sync: đọc cache JSON → gọi API → cập nhật state
 *
 * @param {object} options
 * @param {string} [options.extractedDir]    - Thư mục cache JSON (mặc định: stock_data/extracted_structure)
 * @param {string} [options.stateFile]       - File state (mặc định: tmp/sync_state.json)
 * @param {string} [options.apiKey]          - API Key cho Worker
 * @param {string} [options.apiBaseUrl]      - Base URL của API Worker
 * @param {number} [options.maxRetries]      - Số lần retry tối đa (mặc định: 3)
 * @param {number} [options.retryDelayMs]    - Thời gian đợi giữa các retry (ms)
 * @param {number} [options.limit]           - Giới hạn số symbol xử lý
 * @returns {Promise<{ processed: number, success: number, failed: number, skipped: number }>}
 */
export async function runSyncExtracted(options = {}) {
  const extractedDir = options.extractedDir
    || path.resolve(__dirname, '..', 'stock_data', 'extracted_structure');

  const stateFile = options.stateFile
    || path.resolve(__dirname, '..', 'tmp', 'sync_state.json');

  const limit = options.limit ?? Infinity;

  console.log(`[SYNC] Khởi động. Extracted Dir: ${extractedDir}`);

  // 1. Load state
  const state = loadSyncState(stateFile);
  const syncedSet = new Set(state.synced_list);

  // 2. Đọc tất cả file JSON cache
  const allItems = readExtractedFiles(extractedDir);
  console.log(`[SYNC] Tìm thấy ${allItems.length} file JSON cache.`);

  // 3. Lọc chưa sync
  const pendingItems = allItems.filter(item => !syncedSet.has(`${item.symbol}:${item.year}`));
  const skippedCount = allItems.length - pendingItems.length;

  if (skippedCount > 0) {
    console.log(`[SYNC] Bỏ qua ${skippedCount} symbol đã sync trước đó.`);
  }
  console.log(`[SYNC] ${pendingItems.length} symbol cần đồng bộ.`);

  const targetItems = pendingItems.slice(0, limit);
  let successCount = 0;
  let failCount = 0;

  // 4. Vòng lặp sync
  for (const item of targetItems) {
    const taskKey = `${item.symbol}:${item.year}`;
    console.log(`\n[SYNC] Đang đồng bộ ${taskKey}...`);

    try {
      await callSyncApi(item.symbol, item, {
        apiKey: options.apiKey,
        apiBaseUrl: options.apiBaseUrl,
        maxRetries: options.maxRetries,
        retryDelayMs: options.retryDelayMs
      });

      // Cập nhật state thành công
      state.synced_list.push(taskKey);
      saveSyncState(stateFile, state);
      syncedSet.add(taskKey);
      successCount++;

      console.log(`[SYNC] ✓ ${taskKey} đồng bộ thành công.`);

    } catch (error) {
      failCount++;
      console.error(`[SYNC] ✗ Lỗi đồng bộ ${taskKey}: ${error.message}`);
    }
  }

  console.log(`\n[SYNC] ═══════════════════════════════════`);
  console.log(`[SYNC] Tổng kết:`);
  console.log(`  - Đã xử lý : ${targetItems.length}`);
  console.log(`  - Thành công: ${successCount}`);
  console.log(`  - Thất bại  : ${failCount}`);
  console.log(`  - Bỏ qua    : ${skippedCount}`);
  console.log(`[SYNC] ═══════════════════════════════════`);

  return {
    processed: targetItems.length,
    success: successCount,
    failed: failCount,
    skipped: skippedCount
  };
}
