import { CacheManager } from '../cache/cache-manager';

/**
 * Route handler cho API /api/v1/stock.
 * Xử lý truy vấn dữ liệu báo cáo tài chính của ticker trong năm cụ thể và lưu cache ở Edge.
 */
export async function handleStockRequest(
  request: Request,
  env: { DB: any },
  ctx: { waitUntil: (promise: Promise<any>) => void }
): Promise<Response> {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker');
  const year = url.searchParams.get('year');
  const reportType = url.searchParams.get('report_type') ?? 'consolidated';

  if (!ticker || !year) {
    return Response.json(
      { error: 'Missing required params: ticker, year' },
      { status: 400 }
    );
  }

  // 1. Kiểm tra cache tại Edge
  const cachedResponse = await CacheManager.get(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // 2. Cache Miss: Thực hiện truy vấn song song dữ liệu từ D1 qua các Composite Indexes
  const tickerUpper = ticker.toUpperCase();
  const yearInt = parseInt(year, 10);

  if (isNaN(yearInt)) {
    return Response.json(
      { error: 'Invalid year parameter' },
      { status: 400 }
    );
  }

  try {
    const data = await queryFullStockReport(env.DB, tickerUpper, yearInt, reportType);

    const response = Response.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=31536000, immutable', // Lưu cache 1 năm vì dữ liệu tĩnh
        'X-Cache-Status': 'MISS',
      },
    });

    // 3. Ghi cache bất đồng bộ để tránh block phản hồi chính (Best Practice)
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(CacheManager.put(request, response.clone(), 31536000));
    } else {
      await CacheManager.put(request, response.clone(), 31536000);
    }

    return response;
  } catch (error: any) {
    console.error('Error querying stock data:', error);
    return Response.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Thực hiện truy vấn song song tất cả các bảng thông tin tài chính để tối ưu hóa Latency.
 */
async function queryFullStockReport(db: any, ticker: string, year: number, reportType: string) {
  const [
    auditReport,
    relatedParties,
    debts,
    inventories,
    banking,
    securities,
    realEstate,
    general,
    insights,
    processed
  ] = await Promise.all([
    db.prepare('SELECT * FROM audit_reports WHERE ticker = ? AND year = ? AND report_type = ?').bind(ticker, year, reportType).first(),
    db.prepare('SELECT * FROM related_party_transactions WHERE ticker = ? AND year = ?').bind(ticker, year).all(),
    db.prepare('SELECT * FROM debts_breakdown WHERE ticker = ? AND year = ?').bind(ticker, year).all(),
    db.prepare('SELECT * FROM inventories_and_projects WHERE ticker = ? AND year = ?').bind(ticker, year).all(),
    db.prepare('SELECT * FROM banking_metrics WHERE ticker = ? AND year = ? AND report_type = ?').bind(ticker, year, reportType).first(),
    db.prepare('SELECT * FROM securities_metrics WHERE ticker = ? AND year = ? AND report_type = ?').bind(ticker, year, reportType).first(),
    db.prepare('SELECT * FROM real_estate_metrics WHERE ticker = ? AND year = ? AND report_type = ?').bind(ticker, year, reportType).first(),
    db.prepare('SELECT * FROM general_metrics WHERE ticker = ? AND year = ? AND report_type = ?').bind(ticker, year, reportType).first(),
    db.prepare('SELECT * FROM financial_insights WHERE ticker = ? AND year = ? AND report_type = ?').bind(ticker, year, reportType).first(),
    db.prepare('SELECT * FROM processed_reports WHERE ticker = ? AND year = ? AND report_type = ?').bind(ticker, year, reportType).first(),
  ]);

  return {
    ticker,
    year,
    reportType,
    auditReport: auditReport || null,
    relatedPartyTransactions: relatedParties?.results || [],
    debtsBreakdown: debts?.results || [],
    inventoriesAndProjects: inventories?.results || [],
    bankingMetrics: banking || null,
    securitiesMetrics: securities || null,
    realEstateMetrics: realEstate || null,
    generalMetrics: general || null,
    financialInsights: insights || null,
    processedReport: processed || null,
  };
}
