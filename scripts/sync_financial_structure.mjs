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
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    // Ánh xạ tương thích ngược giữa extracted_list và success_list
    if (data.extracted_list && !data.success_list) {
      data.success_list = data.extracted_list;
    }
    if (!data.success_list) {
      data.success_list = [];
    }
    return data;
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
    year = 2025,
    all = false
  } = options;

  const pythonExec = options.pythonExec || PYTHON_EXEC;
  const rawDir = path.resolve(__dirname, '..', 'stock_data', 'vnstock_raw');

  // Quyết định danh sách symbol
  let targetSymbols = VN30_SYMBOLS;
  if (symbols) {
    targetSymbols = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  } else if (all) {
    // Nếu chọn --all, bước bóc tách/đồng bộ sẽ lấy toàn bộ các mã đã có thư mục dữ liệu thô ở local
    if (fs.existsSync(rawDir)) {
      targetSymbols = fs.readdirSync(rawDir).filter(f => {
        try {
          return fs.statSync(path.join(rawDir, f)).isDirectory() && f.length === 3;
        } catch {
          return false;
        }
      }).map(s => s.toUpperCase());
      console.log(`[CONDUCTOR] Quét thấy ${targetSymbols.length} mã đã được tải thô ở local.`);
    } else {
      console.log(`[CONDUCTOR] Chưa có thư mục dữ liệu thô local.`);
      targetSymbols = [];
    }
  }

  // Cắt bớt theo giới hạn limit
  targetSymbols = targetSymbols.slice(0, limit);

  console.log(`[CONDUCTOR-VN30] Khởi động pipeline năm ${year} cho ${targetSymbols.length} mã.`);

  const runAll = !gatherOnly && !extractOnly && !syncOnly;

  // 1. BƯỚC GATHER (Tải dữ liệu thô)
  if (gatherOnly || runAll) {
    console.log(`\n========================================`);
    console.log(`[CONDUCTOR-VN30] Phase 1/3: Gather (Tải thô)`);
    console.log(`========================================`);
    
    const gatherScript = path.resolve(__dirname, 'gather_vnstock_raw.py');
    let cmd = `"${pythonExec}" "${gatherScript}" --year ${year} --output-dir "stock_data/vnstock_raw"`;
    
    if (all) {
      cmd += ' --all';
    } else if (symbols) {
      cmd += ` --symbols "${targetSymbols.join(',')}"`;
    } else {
      cmd += ' --vn30';
    }
    
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

    const outputDir = path.resolve(__dirname, '..', 'stock_data', 'extracted_structure');
    const stateFile = path.resolve(__dirname, '..', 'tmp', 'extract_state.json');

    // Nạp trạng thái Resume-Capable
    const state = loadState(stateFile);
    const successSet = new Set(state.success_list);

    const pendingSymbols = targetSymbols.filter(sym => !successSet.has(`${sym}:${year}`));
    console.log(`[EXTRACT-RUN] Tổng số: ${targetSymbols.length} mã. Đã hoàn thành trước: ${targetSymbols.length - pendingSymbols.length} mã. Cần chạy tiếp: ${pendingSymbols.length} mã.`);

    // Chia lô (Batching) dựa trên độ song song (concurrency)
    const concurrency = options.concurrency || 5;
    const batches = createBatches(pendingSymbols, concurrency);
    console.log(`[EXTRACT-RUN] Đã chia thành ${batches.length} lô để điều tiết AI (Độ song song: ${concurrency}).`);

    let successCount = targetSymbols.length - pendingSymbols.length;

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      console.log(`\n[BATCH][${b + 1}/${batches.length}] Đang chạy song song lô ${b + 1} chứa ${batch.length} mã: ${batch.join(', ')}...`);

      // Sử dụng Promise.all để bóc tách song song các mã trong lô
      await Promise.all(batch.map(async (sym, index) => {
        // Trì hoãn phân bổ (stagger) để tránh gửi nhiều request cùng lúc ở một phần nghìn giây
        await new Promise(r => setTimeout(r, index * 250));
        
        try {
          const taskKey = `${sym}:${year}`;
          
          await executeWithRateLimit(
            async () => {
              return await runAIExtraction({
                symbol: sym,
                year,
                rawDir,
                outputDir
              });
            },
            sym,
            {
              maxRetries: 3,
              initialDelayMs: 2000,
              delayBetweenCallsMs: 200 // độ trễ nhỏ sau stagger
            }
          );

          // Cập nhật trạng thái
          state.success_list.push(taskKey);
          state.extracted_list = state.success_list; // Tương thích ngược
          saveState(stateFile, state);
          successSet.add(taskKey);
          successCount++;
        } catch (err) {
          console.error(`[EXTRACT-RUN] ✗ Lỗi trích xuất AI cho ${sym}: ${err.message}`);
        }
      }));

      // Tránh nghẽn giữa các đợt lô lớn
      if (b < batches.length - 1) {
        console.log(`[BATCH] Nghỉ 1.5 giây trước lô tiếp theo...`);
        await new Promise(r => setTimeout(r, 1500));
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

  console.log(`\n[CONDUCTOR-VN30] Pipeline hoàn tất trọn vẹn.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHÂN NGÀNH TỰ ĐỘNG, CHIA LÔ & ĐIỀU TIẾT NHỊP ĐỘ (TDD LOGIC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tự động phân loại ngành của mã chứng khoán dựa trên thông tin tổng quan doanh nghiệp.
 * Cực kỳ bền bỉ với fallback thông minh.
 */
export async function autoClassifySector(symbol) {
  const sym = symbol.toUpperCase();
  const rawDir = path.resolve(__dirname, '..', 'stock_data', 'vnstock_raw');
  const overviewPath = path.join(rawDir, sym, '2025', 'overview.json');

  // Rổ fallback cứng bền bỉ cho các ngân hàng và bất động sản lớn
  const BANKING_FALLBACK = [
    'ACB', 'BID', 'CTG', 'HDB', 'LPB', 'MBB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VPB', 'VIB', 'MSB', 'BAB', 'ABB', 'NAB', 'OCB', 'BVB', 'KLB', 'SGB', 'PGB'
  ];
  const REAL_ESTATE_FALLBACK = [
    'VHM', 'VIC', 'VRE', 'KDH', 'NLG', 'DXG', 'PDR', 'DIG', 'CEO', 'DXS', 'CRE', 'KHG', 'TCH', 'HDC', 'HDG', 'SJS', 'SZC', 'IJC', 'BCM', 'KBC', 'LHG', 'D2D', 'NDN'
  ];

  // Fallback dựa trên danh sách cứng trước để tối ưu tốc độ và độ chính xác cho VN30
  if (BANKING_FALLBACK.includes(sym)) {
    return 'banking';
  }
  if (REAL_ESTATE_FALLBACK.includes(sym)) {
    return 'real_estate';
  }

  if (fs.existsSync(overviewPath)) {
    try {
      const content = fs.readFileSync(overviewPath, 'utf8');
      const data = JSON.parse(content);
      const profile = Array.isArray(data) ? data[0] : data;

      if (profile) {
        // 1. Phân loại BANKING: Chỉ quét trên company_type và các trường phân ngành chính thống (nếu có),
        // TUYỆT ĐỐI KHÔNG quét trên business_model hay company_profile để tránh nhận diện sai các công ty dịch vụ công nghệ (như FPT).
        const bankingFields = [
          profile.company_type,
          profile.icb_name1,
          profile.icb_name2,
          profile.icb_name3,
          profile.icb_name4
        ].filter(Boolean).map(s => s.toString().toLowerCase());

        const bankingText = bankingFields.join(' | ');
        if (
          bankingText.includes('ngân hàng') || 
          bankingText.includes('tín dụng') || 
          bankingText.includes('banking') || 
          bankingText.includes('banks')
        ) {
          return 'banking';
        }

        // 2. Phân loại REAL ESTATE: Có thể quét rộng hơn trên business_model và company_profile
        const reFields = [
          profile.company_type,
          profile.icb_name1,
          profile.icb_name2,
          profile.icb_name3,
          profile.icb_name4,
          profile.business_model,
          profile.company_profile
        ].filter(Boolean).map(s => s.toString().toLowerCase());

        const reText = reFields.join(' | ');
        if (
          reText.includes('bất động sản') || 
          reText.includes('địa ốc') || 
          reText.includes('nhà ở') || 
          reText.includes('real estate') ||
          reText.includes('phát triển đô thị')
        ) {
          return 'real_estate';
        }
      }
    } catch (e) {
      console.warn(`[WARN] Lỗi khi parse overview.json cho ${sym}: ${e.message}. Sử dụng danh sách cứng.`);
    }
  }

  return 'generic';
}

/**
 * Chia danh sách mã chứng khoán thành các lô nhỏ (batches) có kích thước batchSize.
 */
export function createBatches(symbols, batchSize) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];
  const size = parseInt(batchSize, 10) || 50;
  const batches = [];
  for (let i = 0; i < symbols.length; i += size) {
    batches.push(symbols.slice(i, i + size));
  }
  return batches;
}

/**
 * Thực hiện một tác vụ bất đồng bộ (ví dụ gọi AI) với Rate Limiter và Exponential Backoff Retry.
 */
export async function executeWithRateLimit(taskFn, symbol, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const delayBetweenCallsMs = options.delayBetweenCallsMs ?? 500;

  // 1. Trì hoãn cơ bản giữa mỗi cuộc gọi để bảo vệ nhịp độ
  if (delayBetweenCallsMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayBetweenCallsMs));
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await taskFn(symbol);
    } catch (error) {
      attempt++;
      const isRateLimitError = 
        error.status === 429 || 
        error.message?.includes('429') || 
        error.message?.toLowerCase().includes('too many requests') || 
        error.message?.toLowerCase().includes('rate limit');

      if (isRateLimitError && attempt < maxRetries) {
        // Tính toán độ trễ tăng dần (Exponential Backoff): delay * 2^attempt
        const backoffDelay = initialDelayMs * Math.pow(2, attempt);
        console.warn(`[RATE-LIMIT] Gặp lỗi 429 cho ${symbol}. Đang chờ ${backoffDelay}ms để thử lại lần ${attempt}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        // Nếu không phải lỗi Rate Limit hoặc đã hết lượt thử lại, ném lỗi ra ngoài
        throw error;
      }
    }
  }
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
  const all = args.includes('--all');

  // Parse --limit=N
  let limit = Infinity;
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1], 10) || Infinity;
  }

  // Parse --concurrency=N
  let concurrency = 5;
  const concurrencyArg = args.find(arg => arg.startsWith('--concurrency='));
  if (concurrencyArg) {
    concurrency = parseInt(concurrencyArg.split('=')[1], 10) || 5;
  }

  // Parse --symbols=HPG,TCB...
  let symbols = null;
  const symbolsArg = args.find(arg => arg.startsWith('--symbols='));
  if (symbolsArg) {
    symbols = symbolsArg.split('=')[1];
  }

  async function main() {
    if (isVN30 || all) {
      // Chạy luồng VN30 hoặc diện rộng toàn sàn
      await runVN30Pipeline({
        gatherOnly,
        extractOnly,
        syncOnly,
        symbols,
        limit,
        all,
        concurrency
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
