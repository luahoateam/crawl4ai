#!/usr/bin/env zx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'zx';
import { formatExtraction } from './formatter.mjs';
import { syncBusinessModel } from './d1_sync.mjs';

// Đảm bảo zx sử dụng cmd trên Windows để tránh lỗi WSL dịch ổ ảo và lỗi prefix bash
if (process.platform === 'win32') {
  $.shell = 'cmd.exe';
  $.prefix = '';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tải cấu hình từ file .env ở thư mục gốc
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
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
}

loadEnv();

/**
 * Đọc trạng thái đồng bộ từ tệp JSON
 */
export function loadState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return { success_list: [] };
  }
  try {
    const content = fs.readFileSync(stateFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[WARN] Could not parse state file: ${error.message}. Starting fresh.`);
    return { success_list: [] };
  }
}

/**
 * Ghi trạng thái đồng bộ xuống tệp JSON
 */
export function saveState(stateFile, state) {
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Quét đệ quy thư mục ocr_data để lấy danh sách các file OCR BCTC
 * Hỗ trợ cả các cấu trúc sâu như: ocr_data/{symbol}/{year}/{subfolder}/{filename}.txt
 */
export function scanOcrFiles(ocrDir) {
  const tasks = [];
  if (!fs.existsSync(ocrDir)) {
    return tasks;
  }

  const symbols = fs.readdirSync(ocrDir).filter(f => fs.statSync(path.join(ocrDir, f)).isDirectory());
  for (const symbol of symbols) {
    const symbolPath = path.join(ocrDir, symbol);
    
    function walk(dir) {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          walk(fullPath);
        } else if (file.endsWith('.txt')) {
          // Phân tích năm từ đường dẫn tương đối từ symbolPath
          const relative = path.relative(symbolPath, dir);
          const parts = relative.split(path.sep);
          let year = 0;
          for (const part of parts) {
            if (/^\d{4}$/.test(part)) {
              year = parseInt(part, 10);
              break;
            }
          }
          
          if (year > 0) {
            tasks.push({
              symbol: symbol.toUpperCase(),
              year,
              fileName: file,
              filePath: fullPath
            });
          }
        }
      }
    }
    
    try {
      walk(symbolPath);
    } catch (e) {
      // bỏ qua lỗi đọc thư mục con
    }
  }
  return tasks;
}

/**
 * Chạy quy trình đồng bộ hóa chính
 */
export async function runSync(options = {}) {
  const ocrDataDir = options.ocrDataDir || process.env.OCR_DATA_DIR || path.resolve(__dirname, '..', 'stock_data', 'ocr_data');
  const stateFile = options.stateFile || path.resolve(__dirname, '..', 'tmp', 'sync_state.json');
  const tempDir = options.tempDir || path.resolve(__dirname, '..', 'tmp', 'temp_sync');
  const pythonExec = options.pythonExec || (process.platform === 'win32' 
    ? path.resolve(__dirname, '..', '.venv-langextract', 'Scripts', 'python')
    : path.resolve(__dirname, '..', '.venv-langextract', 'bin', 'python'));
  const limit = options.limit || Infinity;

  console.log(`[START] Initializing sync. OCR Dir: ${ocrDataDir}, State File: ${stateFile}`);

  // 1. Lập thư mục tạm
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 2. Load trạng thái cũ
  const state = loadState(stateFile);
  const successSet = new Set(state.success_list);

  // 3. Quét các file OCR ở local
  const allTasks = scanOcrFiles(ocrDataDir);
  console.log(`[SCAN] Found ${allTasks.length} total OCR reports.`);

  // 4. Lọc ra các task chưa làm
  const pendingTasks = allTasks.filter(task => !successSet.has(`${task.symbol}:${task.year}`));
  console.log(`[SCAN] ${pendingTasks.length} reports are pending synchronization.`);

  let successCount = 0;
  let failCount = 0;
  const targetTasks = pendingTasks.slice(0, limit);

  // 5. Vòng lặp xử lý từng báo cáo
  for (const task of targetTasks) {
    const taskKey = `${task.symbol}:${task.year}`;
    console.log(`\n----------------------------------------`);
    console.log(`[SYNC] Processing ${taskKey} - File: ${task.fileName}`);

    const tempInPath = path.join(tempDir, `${task.symbol}_${task.year}_in.txt`);
    const tempOutPath = path.join(tempDir, `${task.symbol}_${task.year}_out.json`);

    try {
      // a. Copy nội dung file OCR ra file tạm
      const content = fs.readFileSync(task.filePath, 'utf8');
      fs.writeFileSync(tempInPath, content, 'utf8');

      // b. Gọi Python Bridge CLI trích xuất dữ liệu
      if (options.mockCommand) {
        await options.mockCommand(tempInPath, tempOutPath);
      } else {
        // Sử dụng execSync thô để tránh lỗi quoting nháy đơn của zx trên Windows
        const { execSync } = await import('node:child_process');
        execSync(`"${pythonExec}" scripts/langextract_bridge.py --file "${tempInPath}" --out "${tempOutPath}"`);
      }

      // c. Đọc kết quả JSON từ file tạm
      if (!fs.existsSync(tempOutPath)) {
        throw new Error('Python bridge did not generate output file.');
      }
      const rawResult = JSON.parse(fs.readFileSync(tempOutPath, 'utf8'));

      // d. Chạy Formatter làm sạch dữ liệu
      const cleanData = formatExtraction(rawResult);

      // e. Đồng bộ lên D1
      await syncBusinessModel(task.symbol, cleanData, options);

      // f. Lưu trạng thái thành công
      state.success_list.push(taskKey);
      saveState(stateFile, state);
      successSet.add(taskKey);
      successCount++;
      console.log(`[SUCCESS] Synced ${taskKey} successfully.`);

    } catch (error) {
      failCount++;
      console.error(`[ERROR] Failed to process ${taskKey}: ${error.message}`);
    } finally {
      // dọn dẹp các tệp tạm thời
      try {
        if (fs.existsSync(tempInPath)) fs.unlinkSync(tempInPath);
        if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
      } catch (err) {
        // bỏ qua lỗi dọn dẹp file tạm
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`[SUMMARY] Sync Complete.`);
  console.log(`  - Total processed: ${targetTasks.length}`);
  console.log(`  - Success: ${successCount}`);
  console.log(`  - Failed: ${failCount}`);
  console.log(`  - Skipped (already synced): ${allTasks.length - pendingTasks.length}`);
  console.log(`========================================`);

  return {
    processed: targetTasks.length,
    success: successCount,
    failed: failCount
  };
}

// Nếu script được thực thi trực tiếp bằng zx/node
if (process.argv[1] && process.argv[1].endsWith('sync_financial_structure.mjs')) {
  // Lấy tham số CLI limit nếu có (ví dụ: --limit=10)
  let limit = Infinity;
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1], 10) || Infinity;
  }
  
  runSync({ limit }).catch(error => {
    console.error(`[FATAL] Conductor script failed: ${error.message}`);
    process.exit(1);
  });
}
