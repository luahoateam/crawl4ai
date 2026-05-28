import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';

const BusinessModelSchema = z.object({
  symbol: z.string(),
  revenueStruct: z.string().nullable(),
  profitStruct: z.string().nullable(),
  inputs: z.string().nullable(),
  production: z.string().nullable(),
  outputs: z.string().nullable(),
  others: z.string().nullable(),
});

const BusinessModelUpdateSchema = z.object({
  revenueStruct: z.string().optional(),
  profitStruct: z.string().optional(),
  inputs: z.string().optional(),
  production: z.string().optional(),
  outputs: z.string().optional(),
  others: z.string().optional(),
});

function mapToCamelCase(row: any) {
  if (!row) return null;
  return {
    symbol: row.symbol,
    revenueStruct: row.revenue_struct,
    profitStruct: row.profit_struct,
    inputs: row.inputs,
    production: row.production,
    outputs: row.outputs,
    others: row.others,
  };
}

export class GetBusinessModel extends OpenAPIRoute {
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
            result: BusinessModelSchema
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
    const res = await sql`SELECT * FROM business_models WHERE symbol = ${symbol}`.all();

    if (res.length === 0) {
      return c.json({ success: false, error: 'Not Found' }, 404);
    }

    return {
      success: true,
      result: mapToCamelCase(res[0]),
    };
  }
}

export class UpdateBusinessModel extends OpenAPIRoute {
  schema = {
    request: {
      params: z.object({
        symbol: z.string().transform((s) => s.toUpperCase()),
      }),
      body: contentJson(BusinessModelUpdateSchema),
    },
    responses: {
      '200': {
        description: 'Updated',
        ...contentJson(z.object({
            success: z.boolean(),
            result: BusinessModelSchema
        })),
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;
    const body = data.body;

    const sql = waddler({ client: c.env.DB });
    
    // Check if company exists
    const company = await sql`SELECT symbol FROM companies WHERE symbol = ${symbol}`.all();
    if (company.length === 0) {
        return c.json({ success: false, error: 'Company not found' }, 404);
    }

    // Check if business model exists
    const existing = await sql`SELECT symbol FROM business_models WHERE symbol = ${symbol}`.all();
    
    if (existing.length === 0) {
      // Create new
      await sql`INSERT INTO business_models (symbol, revenue_struct, profit_struct, inputs, production, outputs, others) 
                VALUES (${symbol}, ${body.revenueStruct ?? null}, ${body.profitStruct ?? null}, ${body.inputs ?? null}, ${body.production ?? null}, ${body.outputs ?? null}, ${body.others ?? null})`.execute();
    } else {
      // Update existing
      if (body.revenueStruct !== undefined) await sql`UPDATE business_models SET revenue_struct = ${body.revenueStruct} WHERE symbol = ${symbol}`.execute();
      if (body.profitStruct !== undefined) await sql`UPDATE business_models SET profit_struct = ${body.profitStruct} WHERE symbol = ${symbol}`.execute();
      if (body.inputs !== undefined) await sql`UPDATE business_models SET inputs = ${body.inputs} WHERE symbol = ${symbol}`.execute();
      if (body.production !== undefined) await sql`UPDATE business_models SET production = ${body.production} WHERE symbol = ${symbol}`.execute();
      if (body.outputs !== undefined) await sql`UPDATE business_models SET outputs = ${body.outputs} WHERE symbol = ${symbol}`.execute();
      if (body.others !== undefined) await sql`UPDATE business_models SET others = ${body.others} WHERE symbol = ${symbol}`.execute();
    }

    const updated = await sql`SELECT * FROM business_models WHERE symbol = ${symbol}`.all();
    return {
      success: true,
      result: mapToCamelCase(updated[0]),
    };
  }
}

export class DeleteBusinessModel extends OpenAPIRoute {
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
    await sql`DELETE FROM business_models WHERE symbol = ${symbol}`.execute();

    return {
      success: true,
    };
  }
}
