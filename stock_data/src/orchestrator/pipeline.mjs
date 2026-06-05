import pLimit from 'p-limit';

export async function runPipelineWithConcurrency(items, runner, { concurrency }) {
  const limit = pLimit(concurrency);
  
  const tasks = items.map(item => {
    return limit(() => runner(item));
  });
  
  return Promise.all(tasks);
}

export async function processSingleReport(report, { runner, existsChecker }) {
  const exists = await existsChecker(report);
  if (exists) {
    // Skip extraction to preserve API credits and ensure idempotency
    return { skipped: true, ticker: report.ticker, year: report.year, reportType: report.reportType };
  }
  
  const result = await runner(report);
  return { skipped: false, ticker: report.ticker, year: report.year, reportType: report.reportType, data: result };
}
