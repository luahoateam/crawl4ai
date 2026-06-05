import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

// Helper thực thi query trực tiếp vào D1 local để kiểm tra
const runQuery = (sql: string) => {
  try {
    const stdout = execSync(`npx wrangler d1 execute macro_db --local --command="${sql}" --json`, {
      cwd: 'L:/Hung/crawl4ai/Macro_Data'
    });
    const parsed = JSON.parse(stdout.toString().trim());
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch (error: any) {
    throw new Error(`Failed to execute query: ${error.message}. Output: ${error.stdout?.toString()}`);
  }
};

describe("D1 macro_db Schema Integration", () => {
  it("all 30 macro tables must exist after migration", () => {
    const MACRO_TABLES = [
      "gold_price", "metadata",
      "macro_gdp", "macro_cpi", "macro_exchange_rate",
      "macro_commodity_coke", "macro_commodity_corn", "macro_commodity_gas", "macro_commodity_gold",
      "macro_commodity_iron_ore", "macro_commodity_oil_crude", "macro_commodity_pork",
      "macro_commodity_soybean", "macro_commodity_steel", "macro_commodity_sugar",
      "macro_economy_credit", "macro_economy_fdi", "macro_economy_import_export",
      "macro_economy_money_supply", "macro_economy_state_budget", "macro_economy_total_investment",
      "macro_economy_industry_prod", "macro_economy_retail", "macro_economy_population_labor",
      "macro_currency_interest_rate", "macro_currency_deposit_rate", "macro_currency_interbank_rate",
      "macro_currency_omo", "macro_currency_policy_rate", "macro_global_bond_yield",
      "macro_global_fed_rate", "macro_global_index"
    ];
    
    const result = runQuery("SELECT name FROM sqlite_master WHERE type='table'");
    const existingTables = result.results.map((r: any) => r.name);
    
    for (const table of MACRO_TABLES) {
      expect(existingTables, `Bảng vĩ mô ${table} phải tồn tại trên macro_db`).toContain(table);
    }
  });

  it("should have populated data in key macro tables (after data migration)", () => {
    const result = runQuery("SELECT (SELECT COUNT(*) FROM macro_gdp) as gdp, (SELECT COUNT(*) FROM macro_cpi) as cpi");
    expect(result.results[0].gdp).toBeGreaterThan(0);
    expect(result.results[0].cpi).toBeGreaterThan(0);
  }, 30000);
});
