import { describe, it, expect } from 'vitest';
import { testDb } from '../helpers/db';

describe('BCTN Extraction Schema Migrations', () => {
  it('shareholder_structures table should exist with correct columns', async () => {
    const result = await testDb.run(
      "SELECT name FROM pragma_table_info('shareholder_structures') ORDER BY name"
    );
    const cols = result.results.map((r: any) => r.name);
    
    expect(cols).toContain('id');
    expect(cols).toContain('ticker');
    expect(cols).toContain('year');
    expect(cols).toContain('shareholder_name');
    expect(cols).toContain('shareholder_type');
    expect(cols).toContain('share_count');
    expect(cols).toContain('share_percentage');
    expect(cols).toContain('is_major_shareholder');
    expect(cols).toContain('is_board_member');
    expect(cols).toContain('updated_at');
  });

  it('financial_insights table should contain business_risks column', async () => {
    const result = await testDb.run(
      "SELECT name FROM pragma_table_info('financial_insights') ORDER BY name"
    );
    const cols = result.results.map((r: any) => r.name);
    expect(cols).toContain('business_risks');
  });

  it('should have index sh_struct_ticker_year_idx on shareholder_structures', async () => {
    const result = await testDb.run(
      "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name='sh_struct_ticker_year_idx'"
    );
    expect(result.results.length).toBe(1);
    expect(result.results[0].tbl_name).toBe('shareholder_structures');
  });
});
