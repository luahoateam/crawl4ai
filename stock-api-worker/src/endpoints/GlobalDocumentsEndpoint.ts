import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';

const DocumentItemSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  year: z.number(),
  fileName: z.string(),
  fileUrl: z.string(),
  r2Key: z.string(),
  label: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  createdAt: z.string(),
});

const PaginationSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
});

export class GlobalDocumentsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Documents'],
    summary: 'List all financial documents with filters and pagination',
    request: {
      query: z.object({
        symbol: z.string().optional().describe('Filter by stock symbol'),
        year: z.coerce.number().int().optional().describe('Filter by financial year'),
        q: z.string().optional().describe('Search in file name'),
        page: z.coerce.number().int().min(1).default(1).describe('Page number'),
        per_page: z.coerce.number().int().min(1).max(100).default(30).describe('Items per page'),
      }),
    },
    responses: {
      '200': {
        description: 'Successful list',
        ...contentJson(z.object({
          success: z.boolean(),
          result: z.array(DocumentItemSchema),
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
      const { symbol, year, q, page, per_page } = data.query;

      let query = 'SELECT * FROM financial_documents';
      let countQuery = 'SELECT COUNT(*) as total FROM financial_documents';
      const conditions: string[] = [];
      const params: any[] = [];

      if (symbol) {
        conditions.push('symbol = ?');
        params.push(symbol.toUpperCase());
      }

      if (year !== undefined) {
        conditions.push('year = ?');
        params.push(year);
      }

      if (q) {
        conditions.push('file_name LIKE ?');
        params.push(`%${q}%`);
      }

      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      query += ' ORDER BY year DESC, created_at DESC';

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
          year: Number(item.year),
          fileName: item.file_name,
          fileUrl: item.file_url || `${new URL(c.req.url).origin}/api/documents/${item.id}/view`,
          r2Key: item.r2_key,
          label: item.label,
          status: item.status,
          createdAt: new Date(item.created_at).toISOString(),
        })),
        pagination: {
          page,
          perPage: per_page,
          total,
        },
      }, 200, {
        'Cache-Control': 'public, max-age=1800, s-maxage=1800', // 30 minutes cache
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
