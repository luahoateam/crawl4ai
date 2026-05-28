import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';

const ResearchItemSchema = z.object({
  symbol: z.string(),
  summary: z.string().nullable(),
  lastUpdated: z.string().nullable(),
  exchange: z.string(),
  industry: z.string().optional().nullable(),
});

const PaginationSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
});

export class GlobalResearchEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Research'],
    summary: 'List all daily research reports with pagination',
    request: {
      query: z.object({
        symbol: z.string().optional().describe('Filter by stock symbol'),
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        per_page: z.coerce.number().int().min(1).max(100).default(30).describe('Items per page'),
      }),
    },
    responses: {
      '200': {
        description: 'Successful list',
        ...contentJson(z.object({
          success: z.boolean(),
          result: z.array(ResearchItemSchema),
          pagination: PaginationSchema,
        })),
      },
    },
  };

  async handle(c: any) {
    if (!c.env.DB) {
      c.status(500);
      return {
        success: false,
        error: 'Database connection binding (DB) is missing',
      };
    }

    try {
      const data = await this.getValidatedData<typeof this.schema>();
      const { symbol, page, per_page } = data.query;

      let query = `
        SELECT dr.symbol, SUBSTR(dr.summary, 1, 200) as summary, dr.last_updated, c.exchange, c.industry
        FROM daily_research dr
        JOIN companies c ON c.symbol = dr.symbol
      `;
      let countQuery = `
        SELECT COUNT(*) as total
        FROM daily_research dr
        JOIN companies c ON c.symbol = dr.symbol
      `;
      const conditions: string[] = [];
      const params: any[] = [];

      if (symbol) {
        conditions.push('dr.symbol = ?');
        params.push(symbol.toUpperCase());
      }

      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      query += ' ORDER BY dr.last_updated DESC';

      const limit = per_page;
      const offset = (page - 1) * per_page;
      query += ' LIMIT ? OFFSET ?';

      // Execute count
      const countStmt = c.env.DB.prepare(countQuery);
      const countResult = await (params.length > 0 ? countStmt.bind(...params) : countStmt).first();
      const total = Number(countResult?.total || 0);

      // Execute main query
      const queryStmt = c.env.DB.prepare(query);
      const queryParams = [...params, limit, offset];
      const dbResult = await queryStmt.bind(...queryParams).all();
      const rows = dbResult.results || [];

      return c.json({
        success: true,
        result: rows.map((item: any) => ({
          symbol: item.symbol,
          summary: item.summary,
          lastUpdated: item.last_updated ? new Date(item.last_updated).toISOString() : null,
          exchange: item.exchange,
          industry: item.industry,
        })),
        pagination: {
          page,
          perPage: per_page,
          total,
        },
      }, 200, {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1 hour cache
      });
    } catch (err: any) {
      c.status(500);
      return {
        success: false,
        error: `Query failed: ${err.message}`,
      };
    }
  }
}
