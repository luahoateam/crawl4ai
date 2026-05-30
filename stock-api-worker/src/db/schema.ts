import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
