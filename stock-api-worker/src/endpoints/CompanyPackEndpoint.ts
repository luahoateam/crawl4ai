import { OpenAPIRoute, contentJson, NotFoundException } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';
import { CompanyPackSchema } from '../types';
import type { Context } from 'hono';

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

export class CompanyPackEndpoint extends OpenAPIRoute {
  schema = {
    tags: ['Companies'],
    summary: 'Get full data pack for a company (Waddler Wrapped)',
    request: {
      params: z.object({
        symbol: z.string().min(3).max(10).transform((v) => v.toUpperCase()).describe('Stock symbol (e.g. AAA, FPT)'),
      }),
    },
    responses: {
      '200': {
        description: 'Successful response',
        ...contentJson(CompanyPackSchema),
      },
      ...NotFoundException.schema(),
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { symbol } = data.params;
    // @ts-ignore
    const sql = waddler({ client: c.env.DB });

    // 1. Fetch Company Profile (Wrapped by Waddler)
    const profileResults = await sql`SELECT * FROM companies WHERE symbol = ${symbol} LIMIT 1`.all();
    const company = profileResults[0];

    if (!company) {
      throw new NotFoundException(`Company with symbol ${symbol} not found`);
    }

    // 2. Fetch Detailed Sections in Parallel using Waddler
    const [bizResults, resResults, newsIndices, docResults] = await Promise.all([
      sql`SELECT * FROM business_models WHERE symbol = ${symbol} LIMIT 1`.all(),
      sql`SELECT * FROM daily_research WHERE symbol = ${symbol} LIMIT 1`.all(),
      sql`SELECT * FROM news_index WHERE symbol = ${symbol} ORDER BY created_at DESC LIMIT 5`.all(),
      sql`SELECT id, year, file_name, file_url, label, document_type FROM financial_documents WHERE symbol = ${symbol} ORDER BY year DESC`.all(),
    ]);

    const businessModel = bizResults[0];
    const research = resResults[0];

    // 3. Fetch Large Content from Cloudflare R2
    const newsWithContent = await Promise.all(
      newsIndices.map(async (item: any) => {
        try {
          const object = await c.env.BUCKET.get(item.r2_key);
          const content = object ? await object.text() : 'Content not found in R2';
          return {
            id: item.id,
            title: item.title,
            content: content,
            sourceUrl: item.source_url || null,
            createdAt: new Date(item.created_at).toISOString(),
          };
        } catch (e) {
          return {
            id: item.id,
            title: item.title,
            content: 'Error fetching content from R2',
            sourceUrl: item.source_url || null,
            createdAt: new Date(item.created_at).toISOString(),
          };
        }
      })
    );

    return {
      profile: {
        ...company,
        updatedAt: company.updated_at ? new Date(company.updated_at).toISOString() : undefined,
      },
      businessModel: businessModel || undefined,
      research: research ? {
        ...research,
        lastUpdated: research.last_updated ? new Date(research.last_updated).toISOString() : undefined,
      } : undefined,
      news: newsWithContent,
      documents: docResults.map((doc: any) => ({
        id: doc.id,
        year: doc.year,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        label: doc.label,
        documentType: doc.document_type || null,
      })),
    };
  }
}
