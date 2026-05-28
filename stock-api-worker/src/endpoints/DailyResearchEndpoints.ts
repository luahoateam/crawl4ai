import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';

const DailyResearchSchema = z.object({
  symbol: z.string(),
  summary: z.string().nullable(),
  ssiReview: z.string().nullable(),
  lastUpdated: z.union([z.string(), z.number(), z.date()]).nullable(),
});

const DailyResearchUpdateSchema = z.object({
  summary: z.string().optional(),
  ssiReview: z.string().optional(),
});

export class GetDailyResearch extends OpenAPIRoute {
  schema = {
    request: {
      params: z.object({
        symbol: z.string().transform((s) => s.toUpperCase()),
      }),
    },
    responses: {
      '200': {
        description: 'Success',
        ...contentJson(z.object({
            success: z.boolean(),
            result: DailyResearchSchema
        })),
      },
      '404': {
        description: 'Not Found',
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;

    const sql = waddler({ client: c.env.DB });
    const res = await sql`SELECT * FROM daily_research WHERE symbol = ${symbol}`.all();

    if (res.length === 0) {
      return c.json({ success: false, error: 'Not Found' }, 404);
    }

    const item = res[0];
    return {
      success: true,
      result: {
        symbol: item.symbol,
        summary: item.summary,
        ssiReview: item.ssi_review,
        lastUpdated: item.last_updated
      },
    };
  }
}

export class UpdateDailyResearch extends OpenAPIRoute {
  schema = {
    request: {
      params: z.object({
        symbol: z.string().transform((s) => s.toUpperCase()),
      }),
      body: contentJson(DailyResearchUpdateSchema),
    },
    responses: {
      '200': {
        description: 'Updated',
        ...contentJson(z.object({
            success: z.boolean(),
            result: DailyResearchSchema
        })),
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;
    const body = data.body;
    const now = Date.now();

    const sql = waddler({ client: c.env.DB });
    
    // Check if company exists
    const company = await sql`SELECT symbol FROM companies WHERE symbol = ${symbol}`.all();
    if (company.length === 0) {
        return c.json({ success: false, error: 'Company not found' }, 404);
    }

    // Check if research exists
    const existing = await sql`SELECT symbol FROM daily_research WHERE symbol = ${symbol}`.all();
    
    if (existing.length === 0) {
      // Create new
      await sql`INSERT INTO daily_research (symbol, summary, ssi_review, last_updated) 
                VALUES (${symbol}, ${body.summary ?? null}, ${body.ssiReview ?? null}, ${now})`.execute();
    } else {
      // Update existing - Build dynamic update to avoid CASE WHEN issues
      console.log('DEBUG: Updating existing research for', symbol, 'with body', body);
      if (body.summary !== undefined && body.ssiReview !== undefined) {
        await sql`UPDATE daily_research SET summary = ${body.summary}, ssi_review = ${body.ssiReview}, last_updated = ${now} WHERE symbol = ${symbol}`.execute();
      } else if (body.summary !== undefined) {
        const query = sql`UPDATE daily_research SET summary = ${body.summary}, last_updated = ${now} WHERE symbol = ${symbol}`;
        console.log('DEBUG: Executing query', query);
        await query.execute();
      } else if (body.ssiReview !== undefined) {
        await sql`UPDATE daily_research SET ssi_review = ${body.ssiReview}, last_updated = ${now} WHERE symbol = ${symbol}`.execute();
      }
    }

    const updated = await sql`SELECT * FROM daily_research WHERE symbol = ${symbol}`.all();
    const item = updated[0];
    return {
      success: true,
      result: {
        symbol: item.symbol,
        summary: item.summary,
        ssiReview: item.ssi_review,
        lastUpdated: item.last_updated
      },
    };
  }
}

export class DeleteDailyResearch extends OpenAPIRoute {
  schema = {
    request: {
      params: z.object({
        symbol: z.string().transform((s) => s.toUpperCase()),
      }),
    },
    responses: {
      '200': {
        description: 'Deleted',
        ...contentJson(z.object({ success: z.boolean() })),
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;

    const sql = waddler({ client: c.env.DB });
    await sql`DELETE FROM daily_research WHERE symbol = ${symbol}`.execute();

    return {
      success: true,
    };
  }
}
