#!/usr/bin/env node
/**
 * sync_financial_structure.mjs
 *
 * Conductor CLI - Nhạc trưởng điều khiển toàn bộ pipeline.
 * Tích hợp cả 2 luồng:
 * 1. Luồng truyền thống: Quét OCR BCTC thô ở local -> Gọi Python bridge -> Đồng bộ D1.
 * 2. Luồng VN30 2025 mới: Thu thập thô vnstock -> Dual-Run AI Extractor -> Đồng bộ ghép nối tiếp D1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Import các module của luồng cũ
import { formatExtraction } from './formatter.mjs';
import { syncBusinessModel } from './d1_sync.mjs';

// Import các module của luồng VN30 mới
import { runAIExtraction, getSectorOfSymbol } from './extract_vn30_structure.mjs';
import { runSyncVN30 } from './sync_vn30_extracted.mjs';

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

// Đường dẫn Python chính của user (đảm bảo tương thích nhị phân numpy 100%)
const PYTHON_EXEC = process.env.PYTHON_EXEC || 'C:\\Users\\luaho\\.venv\\Scripts\\python.exe';

const VN30_SYMBOLS = [
  'ACB', 'BCM', 'BID', 'BVH', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG',
  'MBB', 'LPB', 'MSN', 'MWG', 'PLX', 'POW', 'SAB', 'SHB', 'SSB', 'SSI',
  'STB', 'TCB', 'TPB', 'VCB', 'VJC', 'VHM', 'VIC', 'VNM', 'VPB', 'VRE'
];

// ─────────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT (LUỒNG CŨ)
// ─────────────────────────────────────────────────────────────────────────────

export function loadState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return { success_list: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (error) {
    console.warn(`[WARN] Could not parse state file: ${error.message}. Starting fresh.`);
    return { success_list: [] };
  }
}

export function saveState(stateFile, state) {
  const dir = path.dirname(stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

export function scanOcrFiles(ocrDir) {
  const tasks = [];
  if (!fs.existsSync(ocrDir)) return tasks;

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
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          walk(fullPath);
        } else if (file.endsWith('.txt')) {
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

// ─────────────────────────────────────────────────────────────────────────────
// LUỒNG CŨ: RUN SYNC (TRUYỀN THỐNG)
// ─────────────────────────────────────────────────────────────────────────────

export async function runSync(options = {}) {
  const ocrDataDir = options.ocrDataDir || process.env.OCR_DATA_DIR || path.resolve(__dirname, '..', 'stock_data', 'ocr_data');
  const stateFile = options.stateFile || path.resolve(__dirname, '..', 'tmp', 'sync_state.json');
  const tempDir = options.tempDir || path.resolve(__dirname, '..', 'tmp', 'temp_sync');
  const pythonExec = options.pythonExec || PYTHON_EXEC;
  const limit = options.limit || Infinity;

  console.log(`[START-LEGACY] Initializing sync. OCR Dir: ${ocrDataDir}, State File: ${stateFile}`);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const state = loadState(stateFile);
  const successSet = new Set(state.success_list);

  const allTasks = scanOcrFiles(ocrDataDir);
  console.log(`[SCAN-LEGACY] Found ${allTasks.length} total OCR reports.`);

  const pendingTasks = allTasks.filter(task => !successSet.has(`${task.symbol}:${task.year}`));
  console.log(`[SCAN-LEGACY] ${pendingTasks.length} reports are pending synchronization.`);

  let successCount = 0;
  let failCount = 0;
  const targetTasks = pendingTasks.slice(0, limit);

  for (const task of targetTasks) {
    const taskKey = `${task.symbol}:${task.year}`;
    console.log(`\n----------------------------------------`);
    console.log(`[SYNC-LEGACY] Processing ${taskKey} - File: ${task.fileName}`);

    const tempInPath = path.join(tempDir, `${task.symbol}_${task.year}_in.txt`);
    const tempOutPath = path.join(tempDir, `${task.symbol}_${task.year}_out.json`);

    try {
      const content = fs.readFileSync(task.filePath, 'utf8');
      fs.writeFileSync(tempInPath, content, 'utf8');

      if (options.mockCommand) {
        await options.mockCommand(tempInPath, tempOutPath);
      } else {
        const bridgeScript = path.resolve(__dirname, 'langextract_bridge.py');
        execSync(`"${pythonExec}" "${bridgeScript}" --file "${tempInPath}" --out "${tempOutPath}"`);
      }

      if (!fs.existsSync(tempOutPath)) {
        throw new Error('Python bridge did not generate output file.');
      }
      const rawResult = JSON.parse(fs.readFileSync(tempOutPath, 'utf8'));
      const cleanData = formatExtraction(rawResult);

      await syncBusinessModel(task.symbol, cleanData, options);

      state.success_list.push(taskKey);
      saveState(stateFile, state);
      successSet.add(taskKey);
      successCount++;
      console.log(`[SUCCESS-LEGACY] Synced ${taskKey} successfully.`);

    } catch (error) {
      failCount++;
      console.error(`[ERROR-LEGACY] Failed to process ${taskKey}: ${error.message}`);
    } finally {
      try {
        if (fs.existsSync(tempInPath)) fs.unlinkSync(tempInPath);
        if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
      } catch (err) { /* bỏ qua */ }
    }
  }

  return {
    processed: targetTasks.length,
    success: successCount,
    failed: failCount
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LUỒNG VN30 MỚI (GATHER -> EXTRACT -> SYNC)
// ─────────────────────────────────────────────────────────────────────────────

export async function runVN30Pipeline(options = {}) {
  const {
    gatherOnly = false,
    extractOnly = false,
    syncOnly = false,
    symbols = null,
    limit = Infinity,
    year = 2025
  } = options;

  // Quyết định danh sách symbol
  let targetSymbols = VN30_SYMBOLS;
  if (symbols) {
    targetSymbols = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }

  // Cắt bớt theo giới hạn limit
  targetSymbols = targetSymbols.slice(0, limit);

  const pythonExec = options.pythonExec || PYTHON_EXEC;

  console.log(`[CONDUCTOR-VN30] Khởi động pipeline VN30 năm ${year} cho ${targetSymbols.length} mã.`);

  const runAll = !gatherOnly && !extractOnly && !syncOnly;

  // 1. BƯỚC GATHER (Tải dữ liệu thô)
  if (gatherOnly || runAll) {
    console.log(`\n========================================`);
    console.log(`[CONDUCTOR-VN30] Phase 1/3: Gather (Tải thô)`);
    console.log(`========================================`);
    
    const symbolsArg = targetSymbols.join(',');
    const gatherScript = path.resolve(__dirname, 'gather_vnstock_raw.py');
    const cmd = `"${pythonExec}" "${gatherScript}" --symbols "${symbolsArg}" --year ${year} --output-dir "stock_data/vnstock_raw"`;
    
    console.log(`[GATHER-RUN] Chạy command: ${cmd}`);
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(`[GATHER-RUN] ✓ Hoàn thành tải dữ liệu thô.`);
    } catch (err) {
      console.error(`[GATHER-RUN] ✗ Lỗi khi chạy script tải dữ liệu thô: ${err.message}`);
      if (gatherOnly) throw err;
    }
  }

  // 2. BƯỚC EXTRACT (Bóc tách AI Dual-Run)
  if (extractOnly || runAll) {
    console.log(`\n========================================`);
    console.log(`[CONDUCTOR-VN30] Phase 2/3: Extract (AI Dual-Run)`);
    console.log(`========================================`);

    const rawDir = path.resolve(__dirname, '..', 'stock_data', 'vnstock_raw');
    const outputDir = path.resolve(__dirname, '..', 'stock_data', 'extracted_structure');

    let successCount = 0;
    for (const sym of targetSymbols) {
      try {
        await runAIExtraction({
          symbol: sym,
          year,
          rawDir,
          outputDir
        });
        successCount++;
      } catch (err) {
        console.error(`[EXTRACT-RUN] ✗ Lỗi trích xuất AI cho ${sym}: ${err.message}`);
      }
    }
    console.log(`[EXTRACT-RUN] ✓ Đã bóc tách AI thành công cho ${successCount}/${targetSymbols.length} mã.`);
  }

  // 3. BƯỚC SYNC (Đồng bộ ghép nối D1)
  if (syncOnly || runAll) {
    console.log(`\n========================================`);
    console.log(`[CONDUCTOR-VN30] Phase 3/3: Sync (D1 Append-Sync)`);
    console.log(`========================================`);

    try {
      const syncResult = await runSyncVN30({
        limit,
        apiKey: options.apiKey,
        apiBaseUrl: options.apiBaseUrl
      });
      console.log(`[SYNC-RUN] ✓ Hoàn tất đồng bộ: Thành công ${syncResult.success}, Thất bại ${syncResult.failed}.`);
    } catch (err) {
      console.error(`[SYNC-RUN] ✗ Lỗi đồng bộ D1: ${err.message}`);
      if (syncOnly) throw err;
    }
  }

  console.log(`\n[CONDUCTOR-VN30] Pipeline VN30 hoàn tất trọn vẹn.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('sync_financial_structure.mjs')) {
  const args = process.argv.slice(2);
  const isVN30 = args.includes('--vn30');
  const gatherOnly = args.includes('--gather-only');
  const extractOnly = args.includes('--extract-only');
  const syncOnly = args.includes('--sync-only');

  // Parse --limit=N
  let limit = Infinity;
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1], 10) || Infinity;
  }

  // Parse --symbols=HPG,TCB...
  let symbols = null;
  const symbolsArg = args.find(arg => arg.startsWith('--symbols='));
  if (symbolsArg) {
    symbols = symbolsArg.split('=')[1];
  }

  async function main() {
    if (isVN30) {
      // Chạy luồng VN30 mới
      await runVN30Pipeline({
        gatherOnly,
        extractOnly,
        syncOnly,
        symbols,
        limit
      });
    } else {
      // Chạy luồng OCR truyền thống cũ
      console.log('[CONDUCTOR] Chạy luồng OCR truyền thống...');
      await runSync({ limit });
    }
  }

  main().catch(error => {
    console.error(`[FATAL] Conductor script failed: ${error.message}`);
    process.exit(1);
  });
}
