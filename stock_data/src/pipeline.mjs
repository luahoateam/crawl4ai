import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import { scanOcrDirectory } from './orchestrator/scanner.mjs';
import { classify } from './orchestrator/classifier.mjs';
import { runExtractor } from './orchestrator/runner.mjs';
import { D1Loader } from './loader/d1-loader.mjs';
import { runPipelineWithConcurrency, processSingleReport } from './orchestrator/pipeline.mjs';

const execAsync = util.promisify(exec);

async function loadProcessedReports(database, local) {
  const wranglerBin = 'node_modules/wrangler/bin/wrangler.js';
  const targetFlag = local ? '--local' : '--remote';
  const cmd = `"node" "${wranglerBin}" d1 execute ${database} --command="SELECT id FROM processed_reports" ${targetFlag} --json`;
  
  try {
    const { stdout } = await execAsync(cmd);
    const parsed = JSON.parse(stdout.trim());
    const results = Array.isArray(parsed) ? parsed[0].results : parsed.results;
    const set = new Set();
    if (results && results.length > 0) {
      results.forEach(r => set.add(r.id));
    }
    return set;
  } catch (error) {
    console.error(`⚠️ Lỗi khi tải danh sách báo cáo đã xử lý: ${error.message}`);
    return new Set();
  }
}

function loadApiKeys() {
  const tokensFile = 'xiaomi_tokens.txt';
  if (!fs.existsSync(tokensFile)) {
    return [];
  }
  try {
    const content = fs.readFileSync(tokensFile, 'utf-8');
    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error) {
    console.error(`⚠️ Lỗi khi đọc file xiaomi_tokens.txt: ${error.message}`);
    return [];
  }
}

function logError(message) {
  const errorLogPath = path.resolve('pipeline_errors.log');
  const timestamp = new Date().toISOString();
  fs.appendFileSync(errorLogPath, `[${timestamp}] ${message}\n`, 'utf-8');
}

export async function runPipelineMain(argv = process.argv) {
  const args = argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 ? args[idx + 1] : null;
  };
  
  const tickerFilter = getArg('--ticker');
  const yearFilter = getArg('--year') ? parseInt(getArg('--year'), 10) : null;
  const concurrency = getArg('--concurrency') ? parseInt(getArg('--concurrency'), 10) : 3;
  const baseDir = getArg('--base-dir') || './ocr_data';
  const dryRun = args.includes('--dry-run');
  const isRemote = args.includes('--remote');
  
  console.log(`🚀 Bắt đầu Pipeline Làm Giàu Dữ Liệu BCTC Việt Nam`);
  console.log(`📁 Thư mục gốc: ${baseDir}`);
  console.log(`⚙️ Concurrency: ${concurrency} | Chế độ: ${isRemote ? 'Remote' : 'Local'}`);
  if (tickerFilter) console.log(`🔍 Lọc Ticker: ${tickerFilter}`);
  if (yearFilter) console.log(`🔍 Lọc Năm: ${yearFilter}`);
  
  try {
    const apiKeys = loadApiKeys();
    if (apiKeys.length > 0) {
      console.log(`🔑 Đã nạp ${apiKeys.length} API Keys từ 'xiaomi_tokens.txt' để chạy đa luồng luân phiên.`);
    }
    
    let reports = await scanOcrDirectory(baseDir);
    
    if (tickerFilter) {
      reports = reports.filter(r => r.ticker.toUpperCase() === tickerFilter.toUpperCase());
    }
    if (yearFilter) {
      reports = reports.filter(r => r.year === yearFilter);
    }
    
    // Nhóm và sắp xếp báo cáo theo ngành (businessModel) trước khi chạy để tối ưu hóa Prompt Caching (Cache Hit) cho DeepSeek!
    reports.sort((a, b) => {
      const modelA = classify(a.ticker);
      const modelB = classify(b.ticker);
      return modelA.localeCompare(modelB);
    });
    
    console.log(`📂 Tìm thấy ${reports.length} báo cáo cần xử lý.`);

    
    if (dryRun) {
      console.log(`📋 [DRY-RUN] Danh sách các báo cáo sẽ xử lý:`);
      reports.forEach(r => {
        console.log(`  - ${r.ticker} (${r.year}) - ${r.reportType} | Path: ${r.filePath}`);
      });
      return reports;
    }
    
    const loader = new D1Loader({ database: 'stock_db', local: !isRemote });
    
    let processedCount = 0;
    let skippedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let apiKeyIndex = 0;
    
    const startTime = Date.now();
    
    const processedSet = await loadProcessedReports('stock_db', !isRemote);
    console.log(`📊 Đã tải ${processedSet.size} báo cáo đã xử lý trước đó từ D1.`);
 
    await runPipelineWithConcurrency(reports, async (report) => {
      processedCount++;
      const currentProgress = `[${processedCount}/${reports.length}]`;
      const reportName = `${report.ticker} (${report.year}) [${report.reportType}]`;
      
      try {
        const existsChecker = async (r) => {
          const reportId = `${r.ticker}_${r.year}_${r.reportType}`;
          return processedSet.has(reportId);
        };
        
        const pipelineRunner = async (r) => {
          const businessModel = classify(r.ticker);
          console.log(`${currentProgress} 🧠 Phân tích ${reportName} | Ngành: ${businessModel}`);
          
          const apiKey = apiKeys.length > 0 ? apiKeys[apiKeyIndex++ % apiKeys.length] : null;
          const enrichedData = await runExtractor({
            filePath: r.filePath,
            ticker: r.ticker,
            businessModel,
            apiKey
          });
          
          console.log(`${currentProgress} 💾 Lưu trữ dữ liệu ${reportName} vào D1...`);
          await loader.save(r.ticker, r.year, r.reportType, enrichedData, { businessModel });
          
          // Cập nhật bộ nhớ đệm
          processedSet.add(`${r.ticker}_${r.year}_${r.reportType}`);
          
          return enrichedData;
        };
        
        const result = await processSingleReport(report, {
          runner: pipelineRunner,
          existsChecker
        });
        
        if (result.skipped) {
          skippedCount++;
          console.log(`${currentProgress} ⏭️ Bỏ qua ${reportName} (Đã có dữ liệu trong D1).`);
        } else {
          successCount++;
          console.log(`${currentProgress} ✅ Hoàn thành làm giàu ${reportName}.`);
        }
      } catch (err) {
        failCount++;
        const errMsg = `Thất bại khi xử lý ${reportName}. Lỗi: ${err.message}`;
        console.error(`${currentProgress} ❌ ${errMsg}`);
        logError(errMsg);
      }
    }, { concurrency });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Pipeline đã hoàn tất trong ${elapsed} giây!`);
    console.log(`📊 Tổng kết: Thành công ${successCount} | Bỏ qua ${skippedCount} | Thất bại ${failCount} / Tổng số ${reports.length}`);
    if (failCount > 0) {
      console.log(`⚠️ Có ${failCount} lỗi xảy ra. Chi tiết xem tại file 'pipeline_errors.log'`);
    }
  } catch (err) {
    console.error(`💥 Lỗi sập hệ thống pipeline: ${err.message}`);
    logError(`System crash: ${err.message}`);
  }
}

const isMain = process.argv[1] && (process.argv[1].endsWith('pipeline.mjs') || process.argv[1].endsWith('pipeline.js'));
if (isMain) {
  runPipelineMain();
}


