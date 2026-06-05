import { describe, it, expect } from 'vitest';
import { buildInsertSql } from '../../src/loader/sql-builder.mjs';

describe('SQL Builder', () => {
  it('should generate valid INSERT SQL', () => {
    const sql = buildInsertSql('audit_reports', {
      id: 'AAA_2024_consolidated',
      ticker: 'AAA',
      year: 2024,
      report_type: 'consolidated',
      auditor_name: "Ernst & Young",
      audit_opinion: 'unqualified',
      going_concern_issue: 0,
    });
    
    expect(sql).toContain('INSERT OR REPLACE INTO audit_reports');
    expect(sql).toContain("'AAA_2024_consolidated'");
    expect(sql).toContain("'Ernst & Young'");
    expect(sql).toContain("'unqualified'");
  });

  it('should escape single quotes in string values (Tracer Bullet 4.2)', () => {
    const sql = buildInsertSql('related_party_transactions', {
      id: 'test_001',
      related_party_name: "Công ty TNHH O'Brien Việt Nam",
      transaction_type: 'sale',
      value: 1000000
    });
    
    expect(sql).toContain("''Brien");
  });
});
