#!/usr/bin/env node
/**
 * extract_financial_structure.mjs
 *
 * Bước 1 của pipeline 2-bước: Extract-only
 * - Quét stock_data/ocr_data, LỌC CHỈ năm 2025
 * - Gọi langextract_bridge.py (MiMo AI) để trích xuất revenue_struct + profit_struct
 * - Cache kết quả JSON vào stock_data/extracted_structure/{SYMBOL}/2025.json
 * - Quản lý state qua tmp/extract_state.json (resume-capable)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_YEAR = 2025;

// ─────────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đọc trạng thái extract từ file JSON
 * @param {string} stateFile
 * @returns {{ extracted_list: string[] }}
 */
export function loadExtractState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return { extracted_list: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    console.warn(`[WARN] Không parse được state file, bắt đầu từ đầu.`);
    return { extracted_list: [] };
  }
}

/**
 * Ghi trạng thái extract xuống file JSON
 * @param {string} stateFile
 * @param {{ extracted_list: string[] }} state
 */
export function saveExtractState(stateFile, state) {
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE SCANNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quét đệ quy thư mục ocr_data, chỉ lấy file .txt trong thư mục năm 2025.
 * Hỗ trợ cấu trúc sâu: {symbol}/2025/subdir/file.txt
 *
 * @param {string} ocrDir - Đường dẫn tuyệt đối đến thư mục ocr_data
 * @returns {{ symbol: string, year: number, fileName: string, filePath: string }[]}
 */
export function scanOcr2025Files(ocrDir) {
  const tasks = [];

  if (!fs.existsSync(ocrDir)) {
    return tasks;
  }

  const symbols = fs.readdirSync(ocrDir).filter(f => {
    try {
      return fs.statSync(path.join(ocrDir, f)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const symbol of symbols) {
    const symbolPath = path.join(ocrDir, symbol);

    function walk(dir) {
      let entries;
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.txt')) {
          // Xác định năm từ đường dẫn tương đối (tính từ symbolPath)
          const relative = path.relative(symbolPath, dir);
          const parts = relative.split(path.sep);
          let year = 0;
          for (const part of parts) {
            if (/^\d{4}$/.test(part)) {
              year = parseInt(part, 10);
              break;
            }
          }

          // CHỈ lấy năm 2025
          if (year === TARGET_YEAR) {
            tasks.push({
              symbol: symbol.toUpperCase(),
              year,
              fileName: entry,
              filePath: fullPath
            });
          }
        }
      }
    }

    walk(symbolPath);
  }

  return tasks;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXTRACT RUNNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chạy quá trình extract toàn bộ: quét → gọi AI → cache JSON
 *
 * @param {object} options
 * @param {string} [options.ocrDataDir]       - Thư mục nguồn OCR (mặc định: stock_data/ocr_data)
 * @param {string} [options.extractedDir]     - Thư mục lưu cache (mặc định: stock_data/extracted_structure)
 * @param {string} [options.stateFile]        - File state (mặc định: tmp/extract_state.json)
 * @param {string} [options.tempDir]          - Thư mục tạm (mặc định: tmp/extract_temp)
 * @param {string} [options.pythonExec]       - Đường dẫn Python executable
 * @param {number} [options.limit]            - Giới hạn số file xử lý (mặc định: Infinity)
 * @param {Function} [options.mockCommand]    - Mock function thay thế Python bridge (dùng cho testing)
 * @returns {Promise<{ processed: number, success: number, failed: number, skipped: number }>}
 */
export async function runExtract(options = {}) {
  const ocrDataDir = options.ocrDataDir
    || process.env.OCR_DATA_DIR
    || path.resolve(__dirname, '..', 'stock_data', 'ocr_data');

  const extractedDir = options.extractedDir
    || path.resolve(__dirname, '..', 'stock_data', 'extracted_structure');

  const stateFile = options.stateFile
    || path.resolve(__dirname, '..', 'tmp', 'extract_state.json');

  const tempDir = options.tempDir
    || path.resolve(__dirname, '..', 'tmp', 'extract_temp');

  const pythonExec = options.pythonExec
    || (process.platform === 'win32'
      ? path.resolve(__dirname, '..', '.venv-langextract', 'Scripts', 'python')
      : path.resolve(__dirname, '..', '.venv-langextract', 'bin', 'python'));

  const limit = options.limit ?? Infinity;

  console.log(`[EXTRACT] Khởi động. OCR Dir: ${ocrDataDir}`);
  console.log(`[EXTRACT] Cache Dir: ${extractedDir}`);

  // 1. Tạo thư mục tạm
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 2. Load state
  const state = loadExtractState(stateFile);
  const extractedSet = new Set(state.extracted_list);

  // 3. Quét file OCR chỉ năm 2025
  const allTasks = scanOcr2025Files(ocrDataDir);
  console.log(`[EXTRACT] Tìm thấy ${allTasks.length} file OCR năm 2025.`);

  // 4. Lọc task chưa làm
  const pendingTasks = allTasks.filter(task => !extractedSet.has(`${task.symbol}:${task.year}`));
  const skippedCount = allTasks.length - pendingTasks.length;

  if (skippedCount > 0) {
    console.log(`[EXTRACT] Bỏ qua ${skippedCount} file đã extract trước đó.`);
  }
  console.log(`[EXTRACT] ${pendingTasks.length} file cần xử lý.`);

  const targetTasks = pendingTasks.slice(0, limit);
  let successCount = 0;
  let failCount = 0;

  // 5. Vòng lặp xử lý
  for (const task of targetTasks) {
    const taskKey = `${task.symbol}:${task.year}`;
    console.log(`\n[EXTRACT] Đang xử lý ${taskKey} — ${task.fileName}`);

    const tempInPath = path.join(tempDir, `${task.symbol}_${task.year}_in.txt`);
    const tempOutPath = path.join(tempDir, `${task.symbol}_${task.year}_out.json`);
    const cacheDir = path.join(extractedDir, task.symbol);
    const cachePath = path.join(cacheDir, `${task.year}.json`);

    try {
      // a. Sao chép file OCR vào tạm
      const content = fs.readFileSync(task.filePath, 'utf8');
      fs.writeFileSync(tempInPath, content, 'utf8');

      // b. Gọi Python AI Bridge
      if (options.mockCommand) {
        await options.mockCommand(tempInPath, tempOutPath);
      } else {
        const bridgeScript = path.resolve(__dirname, 'langextract_bridge.py');
        execSync(`"${pythonExec}" "${bridgeScript}" --file "${tempInPath}" --out "${tempOutPath}"`);
      }

      // c. Đọc kết quả
      if (!fs.existsSync(tempOutPath)) {
        throw new Error('Python bridge không tạo ra file output.');
      }
      const rawResult = JSON.parse(fs.readFileSync(tempOutPath, 'utf8'));

      // d. Thêm metadata vào JSON cache
      const cacheData = {
        symbol: task.symbol,
        year: task.year,
        fileName: task.fileName,
        extractedAt: new Date().toISOString(),
        revenue_struct: rawResult.revenue_struct || '',
        profit_struct: rawResult.profit_struct || ''
      };

      // e. Ghi cache JSON
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');

      // f. Cập nhật state
      state.extracted_list.push(taskKey);
      saveExtractState(stateFile, state);
      extractedSet.add(taskKey);
      successCount++;

      console.log(`[EXTRACT] ✓ ${taskKey} → ${cachePath}`);

    } catch (error) {
      failCount++;
      console.error(`[EXTRACT] ✗ Lỗi xử lý ${taskKey}: ${error.message}`);
    } finally {
      // Dọn file tạm
      try {
        if (fs.existsSync(tempInPath)) fs.unlinkSync(tempInPath);
        if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
      } catch { /* bỏ qua */ }
    }
  }

  console.log(`\n[EXTRACT] ═══════════════════════════════════`);
  console.log(`[EXTRACT] Tổng kết:`);
  console.log(`  - Đã xử lý : ${targetTasks.length}`);
  console.log(`  - Thành công: ${successCount}`);
  console.log(`  - Thất bại  : ${failCount}`);
  console.log(`  - Bỏ qua    : ${skippedCount}`);
  console.log(`[EXTRACT] ═══════════════════════════════════`);

  return {
    processed: targetTasks.length,
    success: successCount,
    failed: failCount,
    skipped: skippedCount
  };
}
