import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';

const StatsSchema = z.object({
  companies: z.number().int().describe('Total number of companies'),
  businessModels: z.number().int().describe('Total number of business models'),
  dailyResearch: z.number().int().describe('Total number of daily research papers'),
  news: z.number().int().describe('Total number of news articles'),
  documents: z.number().int().describe('Total number of financial documents'),
});

export class StatsEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Stats'],
    summary: 'System-wide record count statistics',
    responses: {
      '200': {
        description: 'Successful statistics response',
        ...contentJson(z.object({
          success: z.boolean(),
          result: StatsSchema,
        })),
      },
    },
  };

  async handle(c: any) {
    if (!c.env.DB) {
      return c.json({
        success: false,
        error: 'Database connection binding (DB) is missing or unavailable',
      }, 500);
    }

    try {
      // @ts-ignore
      const sql = waddler({ client: c.env.DB });
      const stats = await sql`
        SELECT 
          (SELECT COUNT(*) FROM companies) AS companies,
          (SELECT COUNT(*) FROM business_models) AS businessModels,
          (SELECT COUNT(*) FROM daily_research) AS dailyResearch,
          (SELECT COUNT(*) FROM news_index) AS news,
          (SELECT COUNT(*) FROM financial_documents) AS documents
      `.all();

      const row = stats[0] || {
        companies: 0,
        businessModels: 0,
        dailyResearch: 0,
        news: 0,
        documents: 0,
      };

      return c.json({
        success: true,
        result: {
          companies: Number(row.companies),
          businessModels: Number(row.businessModels),
          dailyResearch: Number(row.dailyResearch),
          news: Number(row.news),
          documents: Number(row.documents),
        },
      }, 200, {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      });
    } catch (err: any) {
      return c.json({
        success: false,
        error: `Database query failed: ${err.message}`,
      }, 500);
    }
  }
}
