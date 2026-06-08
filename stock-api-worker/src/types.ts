import { z } from 'zod';

export const CompanySchema = z.object({
  symbol: z.string(),
  exchange: z.string(),
  industry: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const BusinessModelSchema = z.object({
  revenueStruct: z.string().optional(),
  profitStruct: z.string().optional(),
  inputs: z.string().optional(),
  production: z.string().optional(),
  outputs: z.string().optional(),
  others: z.string().optional(),
});

export const DailyResearchSchema = z.object({
  summary: z.string().optional(),
  ssiReview: z.string().optional(),
  lastUpdated: z.string().optional(),
});

export const NewsItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  sourceUrl: z.string().optional().nullable(),
  createdAt: z.string().optional(),
});

export const DocumentItemSchema = z.object({
  id: z.number(),
  year: z.number(),
  fileName: z.string(),
  fileUrl: z.string(),
  label: z.string().optional().nullable(),
  documentType: z.string().optional().nullable(),
});

export const BankingMetricSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  casaRatio: z.number().optional().nullable(),
  nim: z.number().optional().nullable(),
  nonPerformingLoans: z.string().optional().nullable(),
  provisionCoverageRatio: z.number().optional().nullable(),
});

export const SecuritiesMetricSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  marginOutstanding: z.number().optional().nullable(),
  fvtplValue: z.number().optional().nullable(),
  afsValue: z.number().optional().nullable(),
  htmValue: z.number().optional().nullable(),
});

export const RealEstateMetricSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  customerAdvances: z.number().optional().nullable(),
  unearnedRevenue: z.number().optional().nullable(),
});

export const GeneralMetricSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  grossMargin: z.number().optional().nullable(),
  depreciationExpense: z.number().optional().nullable(),
  divestmentProfit: z.number().optional().nullable(),
});

export const DebtBreakdownItemSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  creditorName: z.string(),
  debtType: z.string(),
  amount: z.number(),
  interestRate: z.string().optional().nullable(),
  collateral: z.string().optional().nullable(),
  maturityDate: z.string().optional().nullable(),
});

export const InventoryProjectItemSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  itemName: z.string(),
  itemType: z.string(),
  value: z.number(),
  provision: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const RelatedPartyTransactionSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  relatedPartyName: z.string(),
  relationship: z.string().optional().nullable(),
  transactionType: z.string().optional().nullable(),
  value: z.number(),
  interestRate: z.string().optional().nullable(),
  collateral: z.string().optional().nullable(),
});

export const FinancialInsightSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  relatedPartyRisk: z.string().optional().nullable(),
  debtRisk: z.string().optional().nullable(),
  inventoryRisk: z.string().optional().nullable(),
  governanceRiskScore: z.number().optional().nullable(),
  overallAnalysis: z.string().optional().nullable(),
});

export const AuditReportSchema = z.object({
  year: z.number(),
  reportType: z.string(),
  auditorName: z.string(),
  auditOpinion: z.string(),
  goingConcernIssue: z.number(),
  goingConcernDetail: z.string().optional().nullable(),
});

export const CompanyPackSchema = z.object({
  profile: CompanySchema,
  businessModel: BusinessModelSchema.optional(),
  research: DailyResearchSchema.optional(),
  news: z.array(NewsItemSchema),
  documents: z.array(DocumentItemSchema).optional(),
  // Granular financial data (Backward-compatible, all optional)
  financialMetrics: z.object({
    banking: z.array(BankingMetricSchema).optional(),
    securities: z.array(SecuritiesMetricSchema).optional(),
    realEstate: z.array(RealEstateMetricSchema).optional(),
    general: z.array(GeneralMetricSchema).optional(),
  }).optional(),
  debtsBreakdown: z.array(DebtBreakdownItemSchema).optional(),
  inventoriesAndProjects: z.array(InventoryProjectItemSchema).optional(),
  relatedPartyTransactions: z.array(RelatedPartyTransactionSchema).optional(),
  financialInsights: z.array(FinancialInsightSchema).optional(),
  auditReports: z.array(AuditReportSchema).optional(),
});

