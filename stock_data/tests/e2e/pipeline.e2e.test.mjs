import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import util from 'util';
import { testDb } from '../helpers/db.js';

const execAsync = util.promisify(exec);

describe('Pipeline E2E Integration', () => {
  it('should enrich AAA 2024 and persist to D1 local', async () => {
    // Clear AAA 2024 data to ensure e2e test runs fresh
    await testDb.run("DELETE FROM audit_reports WHERE id = 'AAA_2024_consolidated'");
    await testDb.run("DELETE FROM processed_reports WHERE id = 'AAA_2024_consolidated'");
    await testDb.run("DELETE FROM financial_insights WHERE id = 'AAA_2024_consolidated'");
    
    // Execute pipeline for AAA 2024 local
    const { stdout, stderr } = await execAsync(
      `"node" "src/pipeline.mjs" --ticker AAA --year 2024`
    );
    
    console.log("Stdout of pipeline E2E run:\n", stdout);
    if (stderr) console.error("Stderr of pipeline E2E run:\n", stderr);
    
    // Verify D1 database record insertion (audit_reports)
    const result = await testDb.run(
      "SELECT auditor_name, audit_opinion FROM audit_reports WHERE id = 'AAA_2024_consolidated'"
    );
    
    expect(result.results.length).toBe(1);
    expect(result.results[0].auditor_name).toMatch(/Ernst & Young/);
    expect(result.results[0].audit_opinion).toBe('unqualified');

    // Verify financial_insights insertion
    const insightsResult = await testDb.run(
      "SELECT related_party_risk, debt_risk, governance_risk_score, overall_analysis FROM financial_insights WHERE id = 'AAA_2024_consolidated'"
    );
    expect(insightsResult.results.length).toBe(1);
    expect(insightsResult.results[0].related_party_risk).toBeTruthy();
    expect(insightsResult.results[0].debt_risk).toBeTruthy();
    expect(insightsResult.results[0].overall_analysis).toBeTruthy();
    expect(typeof insightsResult.results[0].governance_risk_score).toBe('number');
    expect(insightsResult.results[0].governance_risk_score).toBeGreaterThanOrEqual(1);
    expect(insightsResult.results[0].governance_risk_score).toBeLessThanOrEqual(10);
  }, 480000); // 8 minutes timeout to ensure LLM call completes safely safely
});
