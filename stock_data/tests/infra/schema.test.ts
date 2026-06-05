import { describe, it, expect } from 'vitest';
import { testDb } from '../helpers/db';

describe('D1 Database Schema', () => {
  it('companies table should exist with correct columns', async () => {
    const result = await testDb.run(
      "SELECT name FROM pragma_table_info('companies') ORDER BY name"
    );
    const cols = result.results.map((r: any) => r.name);
    expect(cols).toContain('ticker');
    expect(cols).toContain('business_model');
    expect(cols).toContain('company_name');
  });

  it('all CORE tables should exist after migration', async () => {
    const CORE_TABLES = [
      'companies', 'audit_reports', 'related_party_transactions',
      'debts_breakdown', 'inventories_and_projects',
    ];
    
    // Check all tables in a single query to minimize Wrangler CLI calls and prevent lock/timeout
    const result = await testDb.run(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${CORE_TABLES.map(t => `'${t}'`).join(', ')})`
    );
    const existingTables = result.results.map((r: any) => r.name);
    
    for (const tableName of CORE_TABLES) {
      expect(existingTables).toContain(tableName);
    }
  });

  it('all industry metric tables should exist', async () => {
    const TABLES = ['banking_metrics', 'securities_metrics', 'real_estate_metrics', 'general_metrics'];
    
    // Check all tables in a single query
    const result = await testDb.run(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${TABLES.map(t => `'${t}'`).join(', ')})`
    );
    const existingTables = result.results.map((r: any) => r.name);
    
    for (const t of TABLES) {
      expect(existingTables).toContain(t);
    }
  });

  it('processed_reports table should exist with correct columns', async () => {
    const result = await testDb.run(
      "SELECT name FROM pragma_table_info('processed_reports') ORDER BY name"
    );
    const cols = result.results.map((r: any) => r.name);
    expect(cols).toContain('id');
    expect(cols).toContain('ticker');
    expect(cols).toContain('year');
    expect(cols).toContain('report_type');
    expect(cols).toContain('processed_at');
  });

  it('financial_insights table should exist with correct columns', async () => {
    const result = await testDb.run(
      "SELECT name FROM pragma_table_info('financial_insights') ORDER BY name"
    );
    const cols = result.results.map((r: any) => r.name);
    expect(cols).toContain('id');
    expect(cols).toContain('ticker');
    expect(cols).toContain('year');
    expect(cols).toContain('report_type');
    expect(cols).toContain('related_party_risk');
    expect(cols).toContain('debt_risk');
    expect(cols).toContain('inventory_risk');
    expect(cols).toContain('governance_risk_score');
    expect(cols).toContain('overall_analysis');
  });

  it('should have all 10 composite indexes created', async () => {
    const EXPECTED_INDEXES = [
      { name: 'rp_tx_ticker_year_idx', table: 'related_party_transactions' },
      { name: 'debts_ticker_year_idx', table: 'debts_breakdown' },
      { name: 'inv_proj_ticker_year_idx', table: 'inventories_and_projects' },
      { name: 'audit_rep_ticker_year_rt_idx', table: 'audit_reports' },
      { name: 'bank_met_ticker_year_rt_idx', table: 'banking_metrics' },
      { name: 'sec_met_ticker_year_rt_idx', table: 'securities_metrics' },
      { name: 're_met_ticker_year_rt_idx', table: 'real_estate_metrics' },
      { name: 'gen_met_ticker_year_rt_idx', table: 'general_metrics' },
      { name: 'fin_ins_ticker_year_rt_idx', table: 'financial_insights' },
      { name: 'proc_rep_ticker_year_rt_idx', table: 'processed_reports' },
    ];

    const result = await testDb.run(
      `SELECT name, tbl_name FROM sqlite_master WHERE type='index'`
    );
    const indexes = result.results.map((r: any) => ({ name: r.name, table: r.tbl_name }));

    for (const expected of EXPECTED_INDEXES) {
      const found = indexes.some(idx => idx.name === expected.name && idx.table === expected.table);
      expect(found).toBe(true);
    }
  });
});
