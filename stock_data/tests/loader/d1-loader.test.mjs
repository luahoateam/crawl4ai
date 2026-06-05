import { describe, it, expect } from 'vitest';
import { D1Loader } from '../../src/loader/d1-loader.mjs';
import { testDb } from '../helpers/db.js';

describe('D1 Loader', () => {
  it('should insert and verify 1 record in D1 local', async () => {
    await testDb.run(
      "INSERT OR REPLACE INTO companies (ticker, company_name, business_model) VALUES ('AAA', 'An Phat Xanh', 'manufacturing')"
    );
    
    const loader = new D1Loader();
    await loader.save('AAA', 2024, 'consolidated', {
      audit_report: {
        auditor_name: 'EY Vietnam',
        audit_opinion: 'unqualified',
        going_concern_issue: false,
        going_concern_detail: null
      },
      related_party_transactions: [],
      debts_breakdown: [],
      inventories_and_projects: []
    }, { businessModel: 'manufacturing' });
    
    const result = await testDb.run(
      "SELECT auditor_name FROM audit_reports WHERE id = 'AAA_2024_consolidated'"
    );
    expect(result.results[0].auditor_name).toBe('EY Vietnam');
  }, 60000);

  it('should insert into all 5 CORE tables (Tracer Bullet 4.4)', async () => {
    // Ensure company exists
    await testDb.run(
      "INSERT OR REPLACE INTO companies (ticker, company_name, business_model) VALUES ('MBB', 'Military Bank', 'bank')"
    );

    const loader = new D1Loader();
    await loader.save('MBB', 2024, 'consolidated', {
      audit_report: {
        auditor_name: 'Deloitte Vietnam',
        audit_opinion: 'unqualified',
        going_concern_issue: false,
        going_concern_detail: null
      },
      related_party_transactions: [
        {
          related_party_name: 'Cong ty con A',
          relationship: 'Subsidiary',
          transaction_type: 'loan',
          value: 50000000000
        }
      ],
      debts_breakdown: [
        {
          creditor_name: 'Ngan hang TMCP Vietinbank',
          debt_type: 'short_term',
          amount: 200000000000
        }
      ],
      inventories_and_projects: [
        {
          item_name: 'Phan mem core banking',
          item_type: 'construction_in_progress',
          value: 15000000000
        }
      ]
    }, { businessModel: 'bank' });

    const verifyResult = await testDb.run(
      "SELECT (SELECT ticker FROM companies WHERE ticker = 'MBB') as ticker, (SELECT auditor_name FROM audit_reports WHERE id = 'MBB_2024_consolidated') as auditor_name, (SELECT value FROM related_party_transactions WHERE ticker = 'MBB') as value, (SELECT amount FROM debts_breakdown WHERE ticker = 'MBB') as amount, (SELECT value FROM inventories_and_projects WHERE ticker = 'MBB') as project_value"
    );
    
    expect(verifyResult.results[0].ticker).toBe('MBB');
    expect(verifyResult.results[0].auditor_name).toBe('Deloitte Vietnam');
    expect(verifyResult.results[0].value).toBe(50000000000);
    expect(verifyResult.results[0].amount).toBe(200000000000);
    expect(verifyResult.results[0].project_value).toBe(15000000000);
  }, 60000);

  it('should insert into banking_metrics for bank model (Tracer Bullet 4.5)', async () => {
    const loader = new D1Loader();
    await loader.save('MBB', 2024, 'consolidated', {
      banking_metrics: {
        casa_ratio: 40.5,
        nim: 4.8,
        non_performing_loans: [
          { group: 3, value: 500000000000 },
          { group: 4, value: 300000000000 }
        ],
        provision_coverage_ratio: 150.2
      }
    }, { businessModel: 'bank' });

    const result = await testDb.run("SELECT casa_ratio, nim, non_performing_loans FROM banking_metrics WHERE id = 'MBB_2024_consolidated'");
    expect(result.results[0].casa_ratio).toBe(40.5);
    expect(result.results[0].nim).toBe(4.8);
    expect(result.results[0].non_performing_loans).toContain('group');
  }, 60000);

  it('should insert into financial_insights (Tracer Bullet 3)', async () => {
    // Ensure company exists
    await testDb.run(
      "INSERT OR REPLACE INTO companies (ticker, company_name, business_model) VALUES ('AAA', 'An Phat Xanh', 'manufacturing')"
    );

    const loader = new D1Loader();
    await loader.save('AAA', 2024, 'consolidated', {
      financial_insights: {
        related_party_risk: 'Giao dịch cho vay nội bộ đáng lưu ý',
        debt_risk: 'Áp lực trả nợ trái phiếu lớn',
        inventory_risk: 'Hàng tồn kho ứ đọng nhiều',
        governance_risk_score: 8,
        overall_analysis: 'Doanh nghiệp có rủi ro thanh khoản cao'
      }
    }, { businessModel: 'manufacturing' });

    const result = await testDb.run("SELECT related_party_risk, governance_risk_score, overall_analysis FROM financial_insights WHERE id = 'AAA_2024_consolidated'");
    expect(result.results.length).toBe(1);
    expect(result.results[0].related_party_risk).toBe('Giao dịch cho vay nội bộ đáng lưu ý');
    expect(result.results[0].governance_risk_score).toBe(8);
    expect(result.results[0].overall_analysis).toBe('Doanh nghiệp có rủi ro thanh khoản cao');
  }, 60000);
});
