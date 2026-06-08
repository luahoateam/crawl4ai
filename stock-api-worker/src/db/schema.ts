import { sqliteTable, text, integer, uniqueIndex, real } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  symbol: text('symbol').primaryKey(),
  exchange: text('exchange').notNull(),
  industry: text('industry'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const businessModels = sqliteTable('business_models', {
  symbol: text('symbol').primaryKey().references(() => companies.symbol),
  revenueStruct: text('revenue_struct'),
  profitStruct: text('profit_struct'),  // Cơ cấu lợi nhuận
  inputs: text('inputs'),
  production: text('production'),
  outputs: text('outputs'),
  others: text('others'),
});

export const dailyResearch = sqliteTable('daily_research', {
  symbol: text('symbol').primaryKey().references(() => companies.symbol),
  summary: text('summary'),
  ssiReview: text('ssi_review'),
  lastUpdated: integer('last_updated', { mode: 'timestamp' }),
});

export const newsIndex = sqliteTable('news_index', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  symbol: text('symbol').notNull().references(() => companies.symbol),
  title: text('title').notNull(),
  sourceUrl: text('source_url'),
  publishedDate: integer('published_date', { mode: 'timestamp' }),
  r2Key: text('r2_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const financialDocuments = sqliteTable('financial_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  symbol: text('symbol').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  label: text('label'),
  status: text('status').default('Chưa kiểm tra'),
  documentType: text('document_type').default('bctc'),
  r2Key: text('r2_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  r2KeyUnique: uniqueIndex('r2_key_unique_idx').on(table.r2Key),
}));

export const auditReports = sqliteTable('audit_reports', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  auditorName: text('auditor_name').notNull(),
  auditOpinion: text('audit_opinion').notNull(),
  goingConcernIssue: integer('going_concern_issue').notNull().default(0),
  goingConcernDetail: text('going_concern_detail'),
});

export const bankingMetrics = sqliteTable('banking_metrics', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  casaRatio: real('casa_ratio'),
  nim: real('nim'),
  nonPerformingLoans: text('non_performing_loans'),
  provisionCoverageRatio: real('provision_coverage_ratio'),
});

export const debtsBreakdown = sqliteTable('debts_breakdown', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  creditorName: text('creditor_name').notNull(),
  debtType: text('debt_type').notNull(),
  amount: real('amount'),
  interestRate: text('interest_rate'),
  collateral: text('collateral'),
  maturityDate: text('maturity_date'),
});

export const generalMetrics = sqliteTable('general_metrics', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  grossMargin: real('gross_margin'),
  depreciationExpense: real('depreciation_expense'),
  divestmentProfit: real('divestment_profit'),
});

export const inventoriesAndProjects = sqliteTable('inventories_and_projects', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  itemName: text('item_name').notNull(),
  itemType: text('item_type').notNull(),
  value: real('value'),
  provision: real('provision'),
  description: text('description'),
});

export const realEstateMetrics = sqliteTable('real_estate_metrics', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  customerAdvances: real('customer_advances'),
  unearnedRevenue: real('unearned_revenue'),
});

export const relatedPartyTransactions = sqliteTable('related_party_transactions', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  relatedPartyName: text('related_party_name').notNull(),
  relationship: text('relationship'),
  transactionType: text('transaction_type'),
  value: real('value'),
  interestRate: text('interest_rate'),
  collateral: text('collateral'),
});

export const securitiesMetrics = sqliteTable('securities_metrics', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  marginOutstanding: real('margin_outstanding'),
  fvtplValue: real('fvtpl_value'),
  afsValue: real('afs_value'),
  htmValue: real('htm_value'),
});

export const financialInsights = sqliteTable('financial_insights', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  relatedPartyRisk: text('related_party_risk'),
  debtRisk: text('debt_risk'),
  inventoryRisk: text('inventory_risk'),
  governanceRiskScore: integer('governance_risk_score'),
  overallAnalysis: text('overall_analysis'),
});

export const processedReports = sqliteTable('processed_reports', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.symbol),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  processedAt: integer('processed_at'),
});
