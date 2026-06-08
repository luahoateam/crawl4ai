import { OpenAPIRoute, contentJson, NotFoundException } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';

// Schema input cho ingest báo cáo thường niên
export const DocumentIngestSchema = z.object({
  ticker: z.string().transform(s => s.toUpperCase()),
  year: z.number().int().default(2024),
  fileName: z.string(),
  fileUrl: z.string().url(),
  r2Key: z.string(),
  label: z.string(),
  pageCount: z.number().int()
});

/**
 * POST /api/pipeline/annual-reports/ingest
 * Endpoint nội bộ ghi nhận báo cáo thường niên đã xử lý thành công.
 */
export class IngestAnnualReport extends OpenAPIRoute {
  schema = {
    tags: ["Pipeline Internal"],
    summary: "Ingest processed annual report markdown into documents database",
    request: {
      body: contentJson(DocumentIngestSchema)
    },
    responses: {
      "200": {
        description: "Successfully ingested document metadata",
        ...contentJson(z.object({
          success: z.boolean(),
          documentId: z.number()
        }))
      }
    }
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;
    const now = Date.now();
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    
    // 1. Kiểm tra xem đã tồn tại tài liệu BCTN cho symbol + year chưa để cập nhật hoặc chèn mới
    const existingDocs = await sql`
      SELECT id FROM financial_documents 
      WHERE symbol = ${body.ticker} AND year = ${body.year} AND document_type = 'bctn' 
      LIMIT 1
    `.all();
    
    let docId: number;
    
    if (existingDocs.length > 0) {
      docId = existingDocs[0].id;
      const fileUrl = `${new URL(c.req.url).origin}/api/documents/${docId}/view`;
      
      // Cập nhật tài liệu
      await sql`
        UPDATE financial_documents 
        SET file_name = ${body.fileName}, file_url = ${fileUrl}, r2_key = ${body.r2Key}, label = ${body.label}, created_at = ${now}
        WHERE id = ${docId}
      `.execute();
      
      console.log(`Updated existing document ID ${docId} for ticker ${body.ticker} (${body.year})`);
    } else {
      // Chèn tài liệu mới (file_url ban đầu trống, sẽ cập nhật sau)
      await sql`
        INSERT INTO financial_documents (symbol, year, file_name, file_url, r2_key, label, document_type, created_at) 
        VALUES (${body.ticker}, ${body.year}, ${body.fileName}, '', ${body.r2Key}, ${body.label}, 'bctn', ${now})
      `.execute();
      
      const inserted = await sql`
        SELECT id FROM financial_documents 
        WHERE r2_key = ${body.r2Key} 
        LIMIT 1
      `.all();
      docId = inserted[0].id;
      
      const fileUrl = `${new URL(c.req.url).origin}/api/documents/${docId}/view`;
      await sql`
        UPDATE financial_documents 
        SET file_url = ${fileUrl} 
        WHERE id = ${docId}
      `.execute();
      
      console.log(`Inserted new document ID ${docId} for ticker ${body.ticker} (${body.year})`);
    }
    
    // 2. Cập nhật trạng thái hàng đợi sang 'done'
    const queueId = `${body.ticker}_${body.year}`;
    await sql`
      UPDATE annual_report_queue 
      SET status = 'done', r2_key = ${body.r2Key}, page_count = ${body.pageCount}, updated_at = ${Math.floor(now / 1000)}
      WHERE id = ${queueId}
    `.execute();
    
    // 3. Cập nhật quota trang đã sử dụng
    const todayStr = new Date().toISOString().split('T')[0];
    await sql`
      INSERT OR IGNORE INTO daily_quota_log (date, pages_used) VALUES (${todayStr}, 0)
    `.execute();
    await sql`
      UPDATE daily_quota_log 
      SET pages_used = pages_used + ${body.pageCount}
      WHERE date = ${todayStr}
    `.execute();
    
    return { success: true, documentId: docId };
  }
}

/**
 * GET /api/companies/:symbol/annual-reports
 * Lấy trạng thái xử lý hàng đợi báo cáo thường niên của một doanh nghiệp.
 */
export class GetAnnualReportStatus extends OpenAPIRoute {
  schema = {
    tags: ["Companies"],
    summary: "Get annual report queue processing status for a company",
    request: {
      params: z.object({
        symbol: z.string().transform(s => s.toUpperCase()),
      }),
    },
    responses: {
      "200": {
        description: "Status information",
        ...contentJson(z.object({
          success: z.boolean(),
          result: z.object({
            id: z.string(),
            ticker: z.string(),
            year: z.number(),
            status: z.string(),
            pdfUrl: z.string().optional().nullable(),
            pageCount: z.number().optional().nullable(),
            r2Key: z.string().optional().nullable(),
            errorMsg: z.string().optional().nullable(),
            updatedAt: z.string().optional(),
          }).optional().nullable()
        }))
      },
      ...NotFoundException.schema()
    }
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { symbol } = data.params;
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    
    const results = await sql`
      SELECT * FROM annual_report_queue 
      WHERE ticker = ${symbol} 
      LIMIT 1
    `.all();
    
    if (results.length === 0) {
      return { success: true, result: null };
    }
    
    const item = results[0];
    return {
      success: true,
      result: {
        id: item.id,
        ticker: item.ticker,
        year: item.year,
        status: item.status,
        pdfUrl: item.pdf_url,
        pageCount: item.page_count,
        r2Key: item.r2_key,
        errorMsg: item.error_msg,
        updatedAt: item.updated_at ? new Date(item.updated_at * 1000).toISOString() : undefined,
      }
    };
  }
}

// Schema input cho update status
export const QueueStatusUpdateSchema = z.object({
  ticker: z.string().transform(s => s.toUpperCase()),
  year: z.number().int().default(2024),
  status: z.string(),
  pdfUrl: z.string().url().optional().nullable(),
  ocrJobId: z.string().optional().nullable(),
  errorMsg: z.string().optional().nullable(),
  pageCount: z.number().int().optional().nullable()
});

/**
 * POST /api/pipeline/annual-reports/update-status
 * Endpoint nội bộ cập nhật trạng thái hàng đợi từ pipeline.
 */
export class UpdateAnnualReportStatus extends OpenAPIRoute {
  schema = {
    tags: ["Pipeline Internal"],
    summary: "Update processing status of a ticker in the annual report queue",
    request: {
      body: contentJson(QueueStatusUpdateSchema)
    },
    responses: {
      "200": {
        description: "Successfully updated status",
        ...contentJson(z.object({
          success: z.boolean()
        }))
      }
    }
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;
    const now = Math.floor(Date.now() / 1000);
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    const queueId = `${body.ticker}_${body.year}`;
    
    if (body.status === 'failed') {
      await sql`
        UPDATE annual_report_queue 
        SET status = ${body.status}, error_msg = ${body.errorMsg || 'Unknown error'}, attempts = attempts + 1, updated_at = ${now}
        WHERE id = ${queueId}
      `.execute();
    } else if (body.status === 'crawling') {
      await sql`
        UPDATE annual_report_queue 
        SET status = ${body.status}, updated_at = ${now}
        WHERE id = ${queueId}
      `.execute();
    } else if (body.status === 'downloading') {
      await sql`
        UPDATE annual_report_queue 
        SET status = ${body.status}, pdf_url = ${body.pdfUrl}, updated_at = ${now}
        WHERE id = ${queueId}
      `.execute();
    } else if (body.status === 'ocr_submitted') {
      await sql`
        UPDATE annual_report_queue 
        SET status = ${body.status}, ocr_job_id = ${body.ocrJobId}, updated_at = ${now}
        WHERE id = ${queueId}
      `.execute();
    } else {
      await sql`
        UPDATE annual_report_queue 
        SET status = ${body.status}, pdf_url = COALESCE(${body.pdfUrl}, pdf_url), ocr_job_id = COALESCE(${body.ocrJobId}, ocr_job_id), error_msg = COALESCE(${body.errorMsg}, error_msg), page_count = COALESCE(${body.pageCount}, page_count), updated_at = ${now}
        WHERE id = ${queueId}
      `.execute();
    }
    
    return { success: true };
  }
}

/**
 * GET /api/pipeline/annual-reports/pending
 * Endpoint nội bộ lấy danh sách tickers pending từ hàng đợi.
 */
export class GetPendingAnnualReports extends OpenAPIRoute {
  schema = {
    tags: ["Pipeline Internal"],
    summary: "Get pending tickers from queue for processing",
    request: {
      query: z.object({
        limit: z.coerce.number().int().default(5)
      })
    },
    responses: {
      "200": {
        description: "List of pending tickers",
        ...contentJson(z.object({
          success: z.boolean(),
          results: z.array(z.object({
            ticker: z.string(),
            status: z.string(),
            attempts: z.number()
          }))
        }))
      }
    }
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const limit = data.query.limit;
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    
    const results = await sql`
      SELECT ticker, status, attempts FROM annual_report_queue
      WHERE status = 'pending' OR (status = 'failed' AND attempts < 3)
      LIMIT ${limit}
    `.all();
    
    return {
      success: true,
      results: results.map((r: any) => ({
        ticker: r.ticker,
        status: r.status,
        attempts: r.attempts
      }))
    };
  }
}

/**
 * GET /api/pipeline/annual-reports/quota
 * Endpoint nội bộ lấy trạng thái quota trang ngày hôm nay.
 */
export class GetDailyQuota extends OpenAPIRoute {
  schema = {
    tags: ["Pipeline Internal"],
    summary: "Get daily page quota status for today",
    responses: {
      "200": {
        description: "Quota info",
        ...contentJson(z.object({
          success: z.boolean(),
          pagesUsed: z.number(),
          pagesLimit: z.number()
        }))
      }
    }
  };

  async handle(c: any) {
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    const todayStr = new Date().toISOString().split('T')[0];
    
    await sql`
      INSERT OR IGNORE INTO daily_quota_log (date, pages_used) VALUES (${todayStr}, 0)
    `.execute();
    
    const results = await sql`
      SELECT pages_used, pages_limit FROM daily_quota_log WHERE date = ${todayStr}
      LIMIT 1
    `.all();
    
    return {
      success: true,
      pagesUsed: results[0].pages_used,
      pagesLimit: results[0].pages_limit || 19500
    };
  }
}
