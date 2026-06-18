import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);
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
    console.error(`⚠️ [Continuous] Error fetching quota: ${error.message}`);
  }
  return { pagesUsed: 0, pagesLimit: 19500 };
}

async function run() {
  console.log("==================================================");
  console.log("STARTING CONTINUOUS BCTN OCR RUNNER");
  console.log("==================================================");

  let runCount = 1;

  while (true) {
    console.log(`\n=== [Continuous Loop #${runCount}] Checking status before batch ===`);
    
    // 1. Kiểm tra quota trước mỗi batch
    const quota = await checkQuota();
    console.log(`[Continuous] Today's Quota: ${quota.pagesUsed} / ${quota.pagesLimit} pages.`);
    if (quota.pagesUsed >= quota.pagesLimit) {
      console.log("🛑 [Continuous] Daily quota reached or exceeded. Stopping continuous runner.");
      break;
    }

    // 2. Chạy batch retry
    console.log(`[Continuous] Running node scripts/retry_bctn_pipeline.mjs...`);
    try {
      const { stdout } = await execAsync('node scripts/retry_bctn_pipeline.mjs');
      const output = stdout.trim();
      console.log(output);

      // 3. Kiểm tra xem có còn mã nào trong hàng đợi không
      if (output.includes("No pending or retryable failed items in queue")) {
        console.log("\n✅ [Continuous] Queue is completely empty. Stopping continuous runner successfully.");
        break;
      }
      
      if (output.includes("Quota limit reached")) {
        console.log("\n🛑 [Continuous] Detected quota limit reached from sub-script. Stopping runner.");
        break;
      }

    } catch (error) {
      console.error(`❌ [Continuous] Batch run failed with error:`);
      console.error(error.stdout ? error.stdout.trim() : error.message);
      
      // Nếu có lỗi hệ thống nghiêm trọng, nghỉ lâu hơn trước khi thử lại
      console.log("⏳ [Continuous] Waiting 60 seconds due to batch execution error...");
      await new Promise(resolve => setTimeout(resolve, 60000));
      runCount++;
      continue;
    }

    runCount++;
    // Nghỉ 10 giây giữa các batch để bảo vệ tài nguyên
    console.log("⏳ [Continuous] Batch completed. Waiting 10 seconds before next batch...");
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log("\n==================================================");
  console.log("CONTINUOUS OCR RUNNER FINISHED");
  console.log("==================================================");
}

run().catch(err => {
  console.error("Fatal continuous error:", err);
  process.exit(1);
});
