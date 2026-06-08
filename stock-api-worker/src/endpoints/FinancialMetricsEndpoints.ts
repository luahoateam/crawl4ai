import { OpenAPIRoute, contentJson } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';
import { toCamelCase } from '../utils/mapper';
import {
  FinancialInsightSchema,
  DebtBreakdownItemSchema,
  InventoryProjectItemSchema,
  RelatedPartyTransactionSchema,
  BankingMetricSchema,
} from '../types';

export class GetFinancialInsights extends OpenAPIRoute {
  schema = {
    tags: ['Financial Metrics'],
    summary: 'Get financial insights for a company',
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
          result: z.array(FinancialInsightSchema),
        })),
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;

    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    const res = await sql`SELECT * FROM financial_insights WHERE ticker = ${symbol} ORDER BY year DESC`.all();

    return {
      success: true,
      result: toCamelCase(res),
    };
  }
}

export class GetDebtsBreakdown extends OpenAPIRoute {
  schema = {
    tags: ['Financial Metrics'],
    summary: 'Get debts breakdown for a company',
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
          result: z.array(DebtBreakdownItemSchema),
        })),
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;

    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    const res = await sql`SELECT * FROM debts_breakdown WHERE ticker = ${symbol} ORDER BY year DESC`.all();

    return {
      success: true,
      result: toCamelCase(res),
    };
  }
}

export class GetInventories extends OpenAPIRoute {
  schema = {
    tags: ['Financial Metrics'],
    summary: 'Get inventories and projects for a company',
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
          result: z.array(InventoryProjectItemSchema),
        })),
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;

    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    const res = await sql`SELECT * FROM inventories_and_projects WHERE ticker = ${symbol} ORDER BY year DESC`.all();

    return {
      success: true,
      result: toCamelCase(res),
    };
  }
}

export class GetRelatedPartyTransactions extends OpenAPIRoute {
  schema = {
    tags: ['Financial Metrics'],
    summary: 'Get related party transactions for a company',
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
          result: z.array(RelatedPartyTransactionSchema),
        })),
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;

    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    const res = await sql`SELECT * FROM related_party_transactions WHERE ticker = ${symbol} ORDER BY year DESC`.all();

    return {
      success: true,
      result: toCamelCase(res),
    };
  }
}

export class GetBankingMetrics extends OpenAPIRoute {
  schema = {
    tags: ['Financial Metrics'],
    summary: 'Get banking metrics for a company',
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
          result: z.array(BankingMetricSchema),
        })),
      },
    },
  };

  async handle(c) {
    const data = await this.getValidatedData<typeof this.schema>();
    const symbol = data.params.symbol;

    // @ts-ignore
    const sql = waddler({ client: c.env.DB });
    const res = await sql`SELECT * FROM banking_metrics WHERE ticker = ${symbol} ORDER BY year DESC`.all();

    return {
      success: true,
      result: toCamelCase(res),
    };
  }
}
