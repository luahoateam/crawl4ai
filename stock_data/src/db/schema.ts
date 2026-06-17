import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 1. Companies Table
export const companies = sqliteTable('companies', {
  ticker: text('ticker').primaryKey(),
  companyName: text('company_name').notNull(),
  businessModel: text('business_model').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// 2. Audit Reports Table
export const auditReports = sqliteTable('audit_reports', {
  id: text('id').primaryKey(), // "ticker_year_reportType"
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(), // 'consolidated' | 'parent'
  auditorName: text('auditor_name').notNull(),
  auditOpinion: text('audit_opinion').notNull(), // 'unqualified' | 'qualified' | 'adverse' | 'disclaimer'
  goingConcernIssue: integer('going_concern_issue', { mode: 'boolean' }).notNull().default(false),
  goingConcernDetail: text('going_concern_detail'),
}, (table) => ({
  auditRepTickerYearRtIdx: index('audit_rep_ticker_year_rt_idx').on(table.ticker, table.year, table.reportType),
}));

// 3. Related Party Transactions Table
export const relatedPartyTransactions = sqliteTable('related_party_transactions', {
  id: text('id').primaryKey(), // unique uuid or hash
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  relatedPartyName: text('related_party_name').notNull(),
  relationship: text('relationship'),
  transactionType: text('transaction_type'),
  value: real('value'), // in absolute VND
  interestRate: text('interest_rate'),
  collateral: text('collateral'),
}, (table) => ({
  rpTxTickerYearIdx: index('rp_tx_ticker_year_idx').on(table.ticker, table.year),
}));

// 4. Debts Breakdown Table
export const debtsBreakdown = sqliteTable('debts_breakdown', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  creditorName: text('creditor_name').notNull(),
  debtType: text('debt_type').notNull(), // 'short_term' | 'long_term'
  amount: real('amount'), // in absolute VND
  interestRate: text('interest_rate'),
  collateral: text('collateral'),
  maturityDate: text('maturity_date'),
}, (table) => ({
  debtsTickerYearIdx: index('debts_ticker_year_idx').on(table.ticker, table.year),
}));

// 5. Inventories and Projects Table
export const inventoriesAndProjects = sqliteTable('inventories_and_projects', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  itemName: text('item_name').notNull(),
  itemType: text('item_type').notNull(), // 'raw_material' | 'finished_goods' | 'construction_in_progress' | 'real_estate_project'
  value: real('value'), // in absolute VND
  provision: real('provision'), // in absolute VND
  description: text('description'),
}, (table) => ({
  invProjTickerYearIdx: index('inv_proj_ticker_year_idx').on(table.ticker, table.year),
}));

// 6. Banking Metrics Table
export const bankingMetrics = sqliteTable('banking_metrics', {
  id: text('id').primaryKey(), // "ticker_year_reportType"
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  casaRatio: real('casa_ratio'),
  nim: real('nim'),
  nonPerformingLoans: text('non_performing_loans'), // JSON array text E.g. [{"group": 3, "value": 100}]
  provisionCoverageRatio: real('provision_coverage_ratio'),
}, (table) => ({
  bankMetTickerYearRtIdx: index('bank_met_ticker_year_rt_idx').on(table.ticker, table.year, table.reportType),
}));

// 7. Securities Metrics Table
export const securitiesMetrics = sqliteTable('securities_metrics', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  marginOutstanding: real('margin_outstanding'),
  fvtplValue: real('fvtpl_value'),
  afsValue: real('afs_value'),
  htmValue: real('htm_value'),
}, (table) => ({
  secMetTickerYearRtIdx: index('sec_met_ticker_year_rt_idx').on(table.ticker, table.year, table.reportType),
}));

// 8. Real Estate Metrics Table
export const realEstateMetrics = sqliteTable('real_estate_metrics', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  customerAdvances: real('customer_advances'),
  unearnedRevenue: real('unearned_revenue'),
}, (table) => ({
  reMetTickerYearRtIdx: index('re_met_ticker_year_rt_idx').on(table.ticker, table.year, table.reportType),
}));

// 9. General Metrics Table (for other models like Manufacturing, Retail, etc.)
export const generalMetrics = sqliteTable('general_metrics', {
  id: text('id').primaryKey(),
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  grossMargin: real('gross_margin'),
  depreciationExpense: real('depreciation_expense'),
  divestmentProfit: real('divestment_profit'),
}, (table) => ({
  genMetTickerYearRtIdx: index('gen_met_ticker_year_rt_idx').on(table.ticker, table.year, table.reportType),
}));

// 10. Processed Reports Table (Idempotency Journal)
export const processedReports = sqliteTable('processed_reports', {
  id: text('id').primaryKey(), // "ticker_year_reportType"
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  procRepTickerYearRtIdx: index('proc_rep_ticker_year_rt_idx').on(table.ticker, table.year, table.reportType),
}));

// 11. Financial Insights Table (Deep qualitative analysis)
export const financialInsights = sqliteTable('financial_insights', {
  id: text('id').primaryKey(), // "ticker_year_reportType"
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  reportType: text('report_type').notNull(),
  relatedPartyRisk: text('related_party_risk'),
  debtRisk: text('debt_risk'),
  inventoryRisk: text('inventory_risk'),
  governanceRiskScore: integer('governance_risk_score'),
  overallAnalysis: text('overall_analysis'),
  businessRisks: text('business_risks'),
}, (table) => ({
  finInsTickerYearRtIdx: index('fin_ins_ticker_year_rt_idx').on(table.ticker, table.year, table.reportType),
}));

// 12. Annual Report Queue Table
export const annualReportQueue = sqliteTable('annual_report_queue', {
  id: text('id').primaryKey(), // "ticker_2024"
  ticker: text('ticker').notNull(),
  year: integer('year').notNull().default(2024),
  status: text('status').notNull().default('pending'),
  pdfUrl: text('pdf_url'),
  ocrJobId: text('ocr_job_id'),
  pageCount: integer('page_count'),
  r2Key: text('r2_key'),
  errorMsg: text('error_msg'),
  attempts: integer('attempts').default(0),
  createdAt: integer('created_at').default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at').default(sql`(strftime('%s', 'now'))`),
});

// 13. Daily Quota Log Table
export const dailyQuotaLog = sqliteTable('daily_quota_log', {
  date: text('date').primaryKey(), // "YYYY-MM-DD"
  pagesUsed: integer('pages_used').default(0),
  pagesLimit: integer('pages_limit').default(19500),
});

// 14. Shareholder Structures Table
export const shareholderStructures = sqliteTable('shareholder_structures', {
  id: text('id').primaryKey(), // Format: 'TCB_2024_0', 'TCB_2024_1', ...
  ticker: text('ticker').notNull().references(() => companies.ticker, { onDelete: 'cascade' }),
  year: integer('year').notNull().default(2024),
  shareholderName: text('shareholder_name').notNull(),
  shareholderType: text('shareholder_type').notNull(), // 'state' | 'foreign' | 'domestic_institutional' | 'domestic_individual' | 'management' | 'others'
  shareCount: integer('share_count'),
  sharePercentage: real('share_percentage').notNull(),
  isMajorShareholder: integer('is_major_shareholder', { mode: 'boolean' }).notNull().default(false),
  isBoardMember: integer('is_board_member', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  shStructTickerYearIdx: index('sh_struct_ticker_year_idx').on(table.ticker, table.year),
}));
