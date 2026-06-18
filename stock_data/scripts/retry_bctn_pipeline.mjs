import { exec, execFile } from 'child_process';
import util from 'util';
import fs from 'fs';

const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

const DATABASE = 'stock_db';
const PYTHON_EXEC = 'C:\\Users\\luaho\\.venv\\Scripts\\python.exe';
const API_BASE_URL = 'https://stock-api-worker.luahoateam.workers.dev/api';
const API_KEY = 'Luahoachungkhoan@ssi';

async function checkQuota() {
  const url = `${API_BASE_URL}/pipeline/annual-reports/quota`;
  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': API_KEY }
    });
    if (response.ok) {
      const data = await response.json();
      return {
        pagesUsed: data.pagesUsed || 0,
        pagesLimit: data.pagesLimit || 19500
      };
    }
  } catch (error) {
    console.error(`⚠️ Error fetching quota: ${error.message}`);
  }
  return { pagesUsed: 0, pagesLimit: 19500 };
}

async function fetchQueue(limit = 20) {
  // Ưu tiên chạy các mã có số trang nhỏ trước để tối ưu hóa quota OCR.
  // Đồng thời cho phép chạy các mã pending hoặc failed (attempts < 3).
  const query = `
    SELECT ticker, year, page_count, status, attempts 
    FROM annual_report_queue 
    WHERE status = 'pending' OR (status = 'failed' AND attempts < 3) 
    ORDER BY COALESCE(page_count, 0) ASC 
    LIMIT ${limit}
  `;
  
  const wranglerBin = 'node_modules/wrangler/bin/wrangler.js';
  const cmdArgs = [
    wranglerBin,
    'd1',
    'execute',
    DATABASE,
    '--command',
    query,
    '--remote',
    '--json'
  ];

  try {
    const { stdout } = await execFileAsync('node', cmdArgs);
    const parsed = JSON.parse(stdout.trim());
    const results = Array.isArray(parsed) ? parsed[0].results : parsed.results;
    return results || [];
  } catch (error) {
    console.error(`❌ Failed to fetch queue from D1: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log("==================================================");
  console.log("STARTING ANNUAL REPORT OCR RETRY PIPELINE");
  console.log("==================================================");

  // 1. Check Quota trước khi chạy
  const quota = await checkQuota();
  console.log(`📊 Today's Quota: ${quota.pagesUsed} / ${quota.pagesLimit} pages used.`);
  if (quota.pagesUsed >= quota.pagesLimit) {
    console.log("🛑 Daily quota reached. Skipping execution.");
    return;
  }

  // 2. Lấy danh sách cần xử lý
  const batchSize = 15;
  console.log(`⏳ Fetching up to ${batchSize} tickers from queue...`);
  const items = await fetchQueue(batchSize);
  console.log(`📂 Found ${items.length} tickers to process in this batch.`);

  if (items.length === 0) {
    console.log("✅ No pending or retryable failed items in queue.");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    // Check lại quota trước mỗi ticker để an toàn
    const currentQuota = await checkQuota();
    if (currentQuota.pagesUsed >= currentQuota.pagesLimit) {
      console.log("🛑 Quota limit reached mid-batch! Stopping pipeline execution.");
      break;
    }

    const start = Date.now();
    console.log(`\n--------------------------------------------------`);
    console.log(`🚀 [${successCount + failCount + 1}/${items.length}] Processing Ticker: ${item.ticker} (${item.year})`);
    console.log(`   Status: ${item.status} | Previous Attempts: ${item.attempts} | Pages: ${item.page_count || 'Unknown'}`);
    console.log(`--------------------------------------------------`);

    try {
      const cmd = `"${PYTHON_EXEC}" python/annual_report/ocr_pipeline.py --ticker "${item.ticker}" --year ${item.year}`;
      const processEnv = {
        ...process.env,
        PYTHONPATH: 'python;.',
        PYTHONIOENCODING: 'utf-8'
      };

      const { stdout } = await execAsync(cmd, { env: processEnv });
      console.log(stdout.trim());
      successCount++;
    } catch (error) {
      console.error(`❌ Error processing ${item.ticker}:`);
      console.error(error.stdout ? error.stdout.trim() : error.message);
      failCount++;
    }

    // Nghỉ 3 giây để tránh làm nghẽn hệ thống mạng
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`\n==================================================`);
  console.log(`🏁 BATCH COMPLETE`);
  console.log(`   Success: ${successCount} | Failed: ${failCount}`);
  console.log(`==================================================`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
