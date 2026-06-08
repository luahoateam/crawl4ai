import { OpenAPIRoute, contentJson, NotFoundException } from 'chanfana';
import { z } from 'zod';
import { waddler } from 'waddler/d1';
import { CompanyPackSchema } from '../types';
import type { Context } from 'hono';
import { toCamelCase } from '../utils/mapper';

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

    // 2. Fetch Detailed Sections & Financial Metrics in Parallel using Waddler
    const [
      bizResults, 
      resResults, 
      newsIndices, 
      docResults,
      bankingResults,
      securitiesResults,
      realEstateResults,
      generalResults,
      debtsResults,
      inventoriesResults,
      relatedResults,
      insightsResults,
      auditResults
    ] = await Promise.all([
      sql`SELECT * FROM business_models WHERE symbol = ${symbol} LIMIT 1`.all(),
      sql`SELECT * FROM daily_research WHERE symbol = ${symbol} LIMIT 1`.all(),
      sql`SELECT * FROM news_index WHERE symbol = ${symbol} ORDER BY created_at DESC LIMIT 5`.all(),
      sql`SELECT id, year, file_name, file_url, label, document_type FROM financial_documents WHERE symbol = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM banking_metrics WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM securities_metrics WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM real_estate_metrics WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM general_metrics WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM debts_breakdown WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM inventories_and_projects WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM related_party_transactions WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM financial_insights WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
      sql`SELECT * FROM audit_reports WHERE ticker = ${symbol} ORDER BY year DESC`.all(),
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

    // 4. Map DB Snake_Case columns to API CamelCase fields
    const bankingMapped = bankingResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      casaRatio: item.casa_ratio,
      nim: item.nim,
      nonPerformingLoans: item.non_performing_loans,
      provisionCoverageRatio: item.provision_coverage_ratio,
    }));

    const securitiesMapped = securitiesResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      marginOutstanding: item.margin_outstanding,
      fvtplValue: item.fvtpl_value,
      afsValue: item.afs_value,
      htmValue: item.htm_value,
    }));

    const realEstateMapped = realEstateResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      customerAdvances: item.customer_advances,
      unearnedRevenue: item.unearned_revenue,
    }));

    const generalMapped = generalResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      grossMargin: item.gross_margin,
      depreciationExpense: item.depreciation_expense,
      divestmentProfit: item.divestment_profit,
    }));

    const debtsMapped = debtsResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      creditorName: item.creditor_name,
      debtType: item.debt_type,
      amount: item.amount,
      interestRate: item.interest_rate,
      collateral: item.collateral,
      maturityDate: item.maturity_date,
    }));

    const inventoriesMapped = inventoriesResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      itemName: item.item_name,
      itemType: item.item_type,
      value: item.value,
      provision: item.provision,
      description: item.description,
    }));

    const relatedMapped = relatedResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      relatedPartyName: item.related_party_name,
      relationship: item.relationship,
      transactionType: item.transaction_type,
      value: item.value,
      interestRate: item.interest_rate,
      collateral: item.collateral,
    }));

    const insightsMapped = insightsResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      relatedPartyRisk: item.related_party_risk,
      debtRisk: item.debt_risk,
      inventoryRisk: item.inventory_risk,
      governanceRiskScore: item.governance_risk_score,
      overallAnalysis: item.overall_analysis,
    }));

    const auditMapped = auditResults.map((item: any) => ({
      year: item.year,
      reportType: item.report_type,
      auditorName: item.auditor_name,
      auditOpinion: item.audit_opinion,
      goingConcernIssue: item.going_concern_issue,
      goingConcernDetail: item.going_concern_detail,
    }));

    // Formulate financialMetrics object (only include present tables or empty arrays for predictability)
    const financialMetrics = {
      banking: bankingMapped,
      securities: securitiesMapped,
      realEstate: realEstateMapped,
      general: generalMapped,
    };

    return c.json(toCamelCase({
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
      financialMetrics,
      debtsBreakdown: debtsMapped,
      inventoriesAndProjects: inventoriesMapped,
      relatedPartyTransactions: relatedMapped,
      financialInsights: insightsMapped,
      auditReports: auditMapped,
    }));

  }
}
