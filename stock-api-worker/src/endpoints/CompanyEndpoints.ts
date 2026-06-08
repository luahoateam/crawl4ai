import { OpenAPIRoute, contentJson, NotFoundException, UnauthorizedException } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';

const CompanySchema = z.object({
  symbol: z.string().describe('Stock symbol'),
  exchange: z.string().describe('Exchange (HOSE, HNX, UPCOM)'),
  industry: z.string().optional().nullable().describe('Industry name'),
  updatedAt: z.union([z.string(), z.number()]).optional().nullable(),
  hasBusinessModel: z.boolean().describe('Whether the company has a business model profile'),
  hasResearch: z.boolean().describe('Whether the company has daily research reports'),
  newsCount: z.number().int().describe('Total number of news articles'),
  docCount: z.number().int().describe('Total number of financial documents'),
});

export class ListCompanies extends OpenAPIRoute {
  schema = {
    tags: ['Companies'],
    summary: 'List all companies',
    responses: {
      '200': {
        description: 'Successful list',
        ...contentJson(z.object({
          success: z.boolean(),
          result: z.array(CompanySchema),
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
      // @ts-ignore
      const sql = waddler({ client: c.env.DB });
      const results = await sql`
        SELECT c.symbol, c.exchange, c.industry, c.updated_at,
          CASE WHEN bm.symbol IS NOT NULL THEN 1 ELSE 0 END as has_bm,
          CASE WHEN dr.symbol IS NOT NULL THEN 1 ELSE 0 END as has_research,
          COALESCE(ni.cnt, 0) as news_count,
          COALESCE(fd.cnt, 0) as doc_count
        FROM companies c
        LEFT JOIN business_models bm ON bm.symbol = c.symbol
        LEFT JOIN daily_research dr ON dr.symbol = c.symbol
        LEFT JOIN (SELECT symbol, COUNT(*) cnt FROM news_index GROUP BY symbol) ni ON ni.symbol = c.symbol
        LEFT JOIN (SELECT symbol, COUNT(*) cnt FROM financial_documents GROUP BY symbol) fd ON fd.symbol = c.symbol
        ORDER BY c.symbol ASC
      `.all();
      
      return c.json({
        success: true,
        result: results.map((r: any) => ({
          symbol: r.symbol,
          exchange: r.exchange,
          industry: r.industry,
          updatedAt: r.updated_at,
          hasBusinessModel: Boolean(r.has_bm),
          hasResearch: Boolean(r.has_research),
          newsCount: Number(r.news_count),
          docCount: Number(r.doc_count),
        })),
      }, 200, {
        'Cache-Control': 'public, max-age=21600, s-maxage=21600',
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

export class CreateCompany extends OpenAPIRoute {
  schema = {
    tags: ['Companies'],
    summary: 'Create or Update a company profile',
    request: {
      body: contentJson(CompanySchema),
    },
    responses: {
      '200': {
        description: 'Successful operation',
        ...contentJson(z.object({ success: z.boolean(), result: CompanySchema })),
      },
      ...UnauthorizedException.schema(),
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;
    const symbol = body.symbol.toUpperCase();
    const now = Date.now();

    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    
    await sql`
      INSERT OR REPLACE INTO companies (symbol, exchange, industry, updated_at)
      VALUES (${symbol}, ${body.exchange}, ${body.industry ?? null}, ${now})
    `.execute();

    return {
      success: true,
      result: { ...body, symbol, updatedAt: now },
    };
  }
}

export class DeleteCompany extends OpenAPIRoute {
  schema = {
    tags: ['Companies'],
    summary: 'Delete a company and its related data',
    request: {
      params: z.object({
        symbol: z.string().transform(s => s.toUpperCase()),
      }),
    },
    responses: {
      '200': {
        description: 'Deleted',
        ...contentJson(z.object({ success: z.boolean() })),
      },
      ...NotFoundException.schema(),
      ...UnauthorizedException.schema(),
    },
  };

  async handle(c: any) {
    const { symbol } = await this.getValidatedData<typeof this.schema>();
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });

    // Cascading delete would be better in SQL, but let's be explicit
    await sql`DELETE FROM business_models WHERE symbol = ${symbol}`.execute();
    await sql`DELETE FROM daily_research WHERE symbol = ${symbol}`.execute();
    await sql`DELETE FROM companies WHERE symbol = ${symbol}`.execute();

    return { success: true };
  }
}

export class GetCompanyProfile extends OpenAPIRoute {
  schema = {
    tags: ['Companies'],
    summary: 'Get a company profile by symbol',
    request: {
      params: z.object({
        symbol: z.string().transform(s => s.toUpperCase()).describe('Stock symbol'),
      }),
    },
    responses: {
      '200': {
        description: 'Successful retrieval',
        ...contentJson(z.object({
          success: z.boolean(),
          result: CompanySchema,
        })),
      },
      ...NotFoundException.schema(),
    },
  };

  async handle(c: any) {
    if (!c.env.DB) {
      return c.json({
        success: false,
        error: 'Database connection binding (DB) is missing',
      }, 500);
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;

    try {
      // @ts-ignore
      const sql = waddler({ client: c.env.DB });
      const results = await sql`
        SELECT c.symbol, c.exchange, c.industry, c.updated_at,
          CASE WHEN bm.symbol IS NOT NULL THEN 1 ELSE 0 END as has_bm,
          CASE WHEN dr.symbol IS NOT NULL THEN 1 ELSE 0 END as has_research,
          COALESCE(ni.cnt, 0) as news_count,
          COALESCE(fd.cnt, 0) as doc_count
        FROM companies c
        LEFT JOIN business_models bm ON bm.symbol = c.symbol
        LEFT JOIN daily_research dr ON dr.symbol = c.symbol
        LEFT JOIN (SELECT symbol, COUNT(*) cnt FROM news_index GROUP BY symbol) ni ON ni.symbol = c.symbol
        LEFT JOIN (SELECT symbol, COUNT(*) cnt FROM financial_documents GROUP BY symbol) fd ON fd.symbol = c.symbol
        WHERE c.symbol = ${symbol}
      `.all();

      if (results.length === 0) {
        return c.json({
          success: false,
          error: 'Company not found',
        }, 404);
      }

      const r = results[0];
      return c.json({
        success: true,
        result: {
          symbol: r.symbol,
          exchange: r.exchange,
          industry: r.industry,
          updatedAt: r.updated_at,
          hasBusinessModel: Boolean(r.has_bm),
          hasResearch: Boolean(r.has_research),
          newsCount: Number(r.news_count),
          docCount: Number(r.doc_count),
        },
      });
    } catch (err: any) {
      return c.json({
        success: false,
        error: `Query failed: ${err.message}`,
      }, 500);
    }
  }
}

