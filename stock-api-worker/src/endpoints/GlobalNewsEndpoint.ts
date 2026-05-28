import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';

const NewsItemSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  title: z.string(),
  sourceUrl: z.string().nullable().optional(),
  publishedDate: z.string().nullable().optional(),
  r2Key: z.string(),
  createdAt: z.string(),
});

const PaginationSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
});

export class GlobalNewsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['News'],
    summary: 'List all news articles with filters and pagination',
    request: {
      query: z.object({
        symbol: z.string().optional().describe('Filter by stock symbol'),
        q: z.string().optional().describe('Search in article title'),
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        per_page: z.coerce.number().int().min(1).max(100).default(30).describe('Items per page'),
      }),
    },
    responses: {
      '200': {
        description: 'Successful list',
        ...contentJson(z.object({
          success: z.boolean(),
          result: z.array(NewsItemSchema),
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
      const { symbol, q, page, per_page } = data.query;

      let query = 'SELECT * FROM news_index';
      let countQuery = 'SELECT COUNT(*) as total FROM news_index';
      const conditions: string[] = [];
      const params: any[] = [];

      if (symbol) {
        conditions.push('symbol = ?');
        params.push(symbol.toUpperCase());
      }

      if (q) {
        conditions.push('title LIKE ?');
        params.push(`%${q}%`);
      }

      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      query += ' ORDER BY published_date DESC, created_at DESC';

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
          id: item.id,
          symbol: item.symbol,
          title: item.title,
          sourceUrl: item.source_url,
          publishedDate: item.published_date ? new Date(item.published_date).toISOString() : null,
          r2Key: item.r2_key,
          createdAt: new Date(item.created_at).toISOString(),
        })),
        pagination: {
          page,
          perPage: per_page,
          total,
        },
      }, 200, {
        'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minutes cache
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
