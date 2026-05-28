import { describe, it, expect } from 'vitest';
import { businessModels } from '../src/db/schema';
import { getTableColumns } from 'drizzle-orm';

describe('businessModels schema — Phương án C: thêm profit_struct', () => {
  it('should have profit_struct column', () => {
    const columns = getTableColumns(businessModels);
    expect(columns).toHaveProperty('profitStruct');
  });

  it('profit_struct should be nullable TEXT (không bắt buộc)', () => {
    const columns = getTableColumns(businessModels);
    expect(columns.profitStruct.notNull).toBe(false);
  });

  it('should retain all existing columns unchanged', () => {
    const columns = getTableColumns(businessModels);
    expect(columns).toHaveProperty('symbol');
    expect(columns).toHaveProperty('revenueStruct');
    expect(columns).toHaveProperty('inputs');
    expect(columns).toHaveProperty('production');
    expect(columns).toHaveProperty('outputs');
    expect(columns).toHaveProperty('others');
  });
});
