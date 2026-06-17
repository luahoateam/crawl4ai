import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BctnRunner } from '../../src/orchestrator/bctn-runner.mjs';
import { testDb } from '../helpers/db.js';

// Mock child_process.exec to dynamically bypass wrangler CLI calls and mock only python pipeline calls
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  
  const mockExec = vi.fn((cmd, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'object' ? options : {};

    if (cmd.includes('pipeline.py')) {
      const mockOutput = {
        shareholder_structures: [
          {
            shareholder_name: 'Cổ đông lớn C',
            shareholder_type: 'domestic_institutional',
            share_count: 500000,
            share_percentage: 12.0,
            is_major_shareholder: true,
            is_board_member: false
          }
        ],
        business_risks: [
          { category: 'Rủi ro hoạt động', description: 'Rủi ro hỏng thiết bị' }
        ]
      };
      // exec callback: (error, stdout, stderr)
      return cb(null, JSON.stringify(mockOutput), '');
    }

    // Delegate all other commands (like wrangler D1 calls) to the actual exec
    return actual.exec(cmd, opts, cb);
  });

  // Assign custom promisify behavior to match Node.js child_process.exec promisified output { stdout, stderr }
  const customPromisifySymbol = Symbol.for('nodejs.util.promisify.custom');
  mockExec[customPromisifySymbol] = (cmd, options) => {
    return new Promise((resolve, reject) => {
      mockExec(cmd, options, (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  };

  return {
    ...actual,
    exec: mockExec
  };
});

describe('BCTN Runner (Orchestrator)', () => {
  it('should fetch pending tickers with status done', async () => {
    // Insert mock queue item
    await testDb.run(
      "INSERT OR REPLACE INTO annual_report_queue (id, ticker, year, status, r2_key) VALUES ('TEST_2024', 'TEST', 2024, 'done', 'annual-reports/2024/TEST/report.md')"
    );

    const runner = new BctnRunner({ local: true });
    const pending = await runner.fetchPendingQueue();
    
    expect(pending.length).toBeGreaterThanOrEqual(1);
    const testItem = pending.find(p => p.ticker === 'TEST');
    expect(testItem).toBeDefined();
    expect(testItem.r2_key).toBe('annual-reports/2024/TEST/report.md');
  }, 30000);

  it('should execute Python pipeline and save data to D1', async () => {
    const runner = new BctnRunner({ local: true });
    
    // Đảm bảo có company TEST
    await testDb.run(
      "INSERT OR REPLACE INTO companies (ticker, company_name, business_model) VALUES ('TEST', 'Test Company', 'general')"
    );
    // Queue item
    await testDb.run(
      "INSERT OR REPLACE INTO annual_report_queue (id, ticker, year, status, r2_key) VALUES ('TEST_2024', 'TEST', 2024, 'done', 'annual-reports/2024/TEST/report.md')"
    );

    const success = await runner.processTicker('TEST', 2024, 'annual-reports/2024/TEST/report.md');
    expect(success).toBe(true);

    // Kiểm tra dữ liệu được lưu
    const shResult = await testDb.run(
      "SELECT shareholder_name FROM shareholder_structures WHERE ticker = 'TEST' AND year = 2024"
    );
    expect(shResult.results.length).toBe(1);
    expect(shResult.results[0].shareholder_name).toBe('Cổ đông lớn C');

    const riskResult = await testDb.run(
      "SELECT business_risks FROM financial_insights WHERE id = 'TEST_2024_annual_report'"
    );
    expect(riskResult.results.length).toBe(1);
    const risks = JSON.parse(riskResult.results[0].business_risks);
    expect(risks[0].category).toBe('Rủi ro hoạt động');

    // Kiểm tra queue status được update thành 'extracted'
    const queueResult = await testDb.run(
      "SELECT status FROM annual_report_queue WHERE id = 'TEST_2024'"
    );
    expect(queueResult.results[0].status).toBe('extracted');
  }, 40000);
});
