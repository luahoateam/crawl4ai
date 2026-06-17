import { exec } from 'child_process';
import path from 'path';
import util from 'util';
import fs from 'fs';
import { D1Loader } from '../loader/d1-loader.mjs';

const execAsync = util.promisify(exec);

export class BctnRunner {
  constructor(options = {}) {
    this.database = options.database || 'stock_db';
    this.local = options.local !== undefined ? options.local : true;
    this.tokenPath = options.tokenPath || 'xiaomi_token.txt';
  }

  /**
   * Quét các hàng đợi cần xử lý (status = 'done')
   */
  async fetchPendingQueue() {
    const targetFlag = this.local ? '--local' : '--remote';
    const query = "SELECT ticker, year, r2_key FROM annual_report_queue WHERE status = 'done' AND r2_key IS NOT NULL";
    
    // Tránh lỗi escaping dấu nháy trên Windows
    const tempFileName = `temp_query_${Date.now()}.sql`;
    fs.writeFileSync(tempFileName, query, 'utf-8');

    const wranglerBin = 'node_modules/wrangler/bin/wrangler.js';
    const cmd = `"node" "${wranglerBin}" d1 execute ${this.database} --file "${tempFileName}" ${targetFlag} --json`;

    try {
      const { stdout } = await execAsync(cmd);
      if (fs.existsSync(tempFileName)) {
        fs.unlinkSync(tempFileName);
      }
      
      const parsed = JSON.parse(stdout.trim());
      const results = Array.isArray(parsed) ? parsed[0].results : parsed.results;
      return results || [];
    } catch (error) {
      if (fs.existsSync(tempFileName)) {
        fs.unlinkSync(tempFileName);
      }
      throw new Error(`Failed to fetch pending BCTN queue: ${error.message}`);
    }
  }

  /**
   * Xử lý trích xuất cho 1 ticker duy nhất
   */
  async processTicker(ticker, year, r2Key) {
    const pythonExec = '.venv/Scripts/python.exe';
    const scriptPath = 'python/annual_report/pipeline.py';
    
    // Gọi Python pipeline với các flags tương ứng
    const cmd = `"${pythonExec}" "${scriptPath}" --ticker "${ticker}" --year ${year} --r2_key "${r2Key}" --token_path "${this.tokenPath}"`;
    
    try {
      console.log(`[BctnRunner] Processing ${ticker} (${year}) via Python subprocess...`);
      
      const processEnv = {
        ...process.env,
        PYTHONPATH: 'python;.',
        PYTHONIOENCODING: 'utf-8'
      };

      const { stdout, stderr } = await execAsync(cmd, {
        env: processEnv,
        maxBuffer: 20 * 1024 * 1024 // 20MB buffer đề phòng output lớn
      });

      const output = stdout.trim();
      if (!output) {
        throw new Error("Python pipeline returned empty output.");
      }

      // Tìm vị trí JSON thực tế (bỏ qua các dòng log phụ in ra stderr/stdout nếu có)
      let jsonStr = output;
      const jsonStart = output.indexOf('{');
      if (jsonStart !== -1) {
        jsonStr = output.substring(jsonStart);
      }

      const result = JSON.parse(jsonStr);

      // Lưu kết quả vào D1
      console.log(`[BctnRunner] Saving extracted data for ${ticker} to D1...`);
      const loader = new D1Loader({ database: this.database, local: this.local });
      
      await loader.save(ticker, year, 'annual_report', {
        shareholder_structures: result.shareholder_structures || [],
        business_risks: result.business_risks || []
      }, { businessModel: 'general' });

      // Cập nhật queue sang 'extracted'
      console.log(`[BctnRunner] Updating queue status to 'extracted' for ${ticker}...`);
      await this._updateQueueStatus(ticker, year, 'extracted');
      
      return true;
    } catch (error) {
      const errStr = error.message + (error.stderr ? `\nStderr: ${error.stderr}` : '');
      console.error(`[BctnRunner] Error processing ${ticker}: ${errStr}`);
      
      // Cập nhật queue sang 'extraction_failed'
      try {
        await this._updateQueueStatus(ticker, year, 'extraction_failed', error.message);
      } catch (innerErr) {
        console.error(`[BctnRunner] Failed to update error status for ${ticker}: ${innerErr.message}`);
      }
      return false;
    }
  }

  /**
   * Cập nhật trạng thái hàng đợi trong D1
   */
  async _updateQueueStatus(ticker, year, status, errorMsg = '') {
    const queueId = `${ticker}_${year}`;
    const targetFlag = this.local ? '--local' : '--remote';
    
    // Làm sạch ký tự dấu nháy đơn để tránh lỗi SQL injection/syntax
    const cleanErrorMsg = errorMsg.replace(/'/g, "''");
    const query = `UPDATE annual_report_queue SET status = '${status}', error_msg = '${cleanErrorMsg}', updated_at = strftime('%s', 'now') WHERE id = '${queueId}'`;
    
    const tempFileName = `temp_update_${ticker}_${Date.now()}.sql`;
    fs.writeFileSync(tempFileName, query, 'utf-8');

    const wranglerBin = 'node_modules/wrangler/bin/wrangler.js';
    const cmd = `"node" "${wranglerBin}" d1 execute ${this.database} --file "${tempFileName}" ${targetFlag} --json`;

    try {
      await execAsync(cmd);
    } finally {
      if (fs.existsSync(tempFileName)) {
        fs.unlinkSync(tempFileName);
      }
    }
  }

  /**
   * Chạy xử lý cho toàn bộ hàng đợi đang chờ
   * LƯU Ý QUAN TRỌNG: Chạy tuần tự nghiêm ngặt (concurrency = 1) để bảo vệ context window và hạn mức API.
   */
  async runBatch() {
    console.log("[BctnRunner] Fetching pending queue items...");
    const items = await this.fetchPendingQueue();
    console.log(`[BctnRunner] Found ${items.length} items to process.`);

    let successCount = 0;
    for (const item of items) {
      const success = await this.processTicker(item.ticker, item.year, item.r2_key);
      if (success) {
        successCount++;
      }
      // Nghỉ ngắn giữa các ticker để tránh làm nghẽn hệ thống mạng/API
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[BctnRunner] Batch completed. Successful: ${successCount}/${items.length}`);
    return successCount;
  }
}
