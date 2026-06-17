import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { buildInsertSql } from './sql-builder.mjs';

const execAsync = util.promisify(exec);

// Global mutex promise to serialize D1 local database writes and eliminate SQLITE_BUSY locks under high concurrency
let writeMutex = Promise.resolve();

export class D1Loader {
  constructor(options = {}) {
    this.database = options.database || 'stock_db';
    this.local = options.local !== undefined ? options.local : true;
  }

  async save(ticker, year, reportType, enrichedData, options = {}) {
    const businessModel = options.businessModel || 'general';
    const reportId = `${ticker}_${year}_${reportType}`;
    const sqlStatements = [];

    // Tự động chèn doanh nghiệp vào bảng companies để tránh lỗi vi phạm khóa ngoại (FOREIGN KEY constraint failed) cho các ticker mới
    sqlStatements.push(`INSERT OR IGNORE INTO companies (ticker, company_name, business_model) VALUES ('${ticker}', '${ticker}', '${businessModel}');`);


    // 1. Audit Report SQL
    if (enrichedData.audit_report) {
      const data = {
        id: reportId,
        ticker,
        year,
        report_type: reportType,
        auditor_name: enrichedData.audit_report.auditor_name,
        audit_opinion: enrichedData.audit_report.audit_opinion,
        going_concern_issue: enrichedData.audit_report.going_concern_issue ? 1 : 0,
        going_concern_detail: enrichedData.audit_report.going_concern_detail || null
      };
      sqlStatements.push(buildInsertSql('audit_reports', data));
    }

    // 2. Related Party Transactions SQL
    if (Array.isArray(enrichedData.related_party_transactions)) {
      // Clear legacy transactions first to ensure idempotency / avoid duplicate keys on retry
      sqlStatements.push(`DELETE FROM related_party_transactions WHERE ticker = '${ticker}' AND year = ${year} AND report_type = '${reportType}';`);
      
      enrichedData.related_party_transactions.forEach((txn, index) => {
        const data = {
          id: `${reportId}_related_${index}`,
          ticker,
          year,
          report_type: reportType,
          related_party_name: txn.related_party_name,
          relationship: txn.relationship || null,
          transaction_type: txn.transaction_type || null,
          value: txn.value !== undefined ? txn.value : null,
          interest_rate: txn.interest_rate || null,
          collateral: txn.collateral || null
        };
        sqlStatements.push(buildInsertSql('related_party_transactions', data));
      });
    }

    // 3. Debts Breakdown SQL
    if (Array.isArray(enrichedData.debts_breakdown)) {
      sqlStatements.push(`DELETE FROM debts_breakdown WHERE ticker = '${ticker}' AND year = ${year} AND report_type = '${reportType}';`);
      
      enrichedData.debts_breakdown.forEach((debt, index) => {
        const data = {
          id: `${reportId}_debt_${index}`,
          ticker,
          year,
          report_type: reportType,
          creditor_name: debt.creditor_name,
          debt_type: debt.debt_type, // 'short_term' | 'long_term'
          amount: debt.amount !== undefined ? debt.amount : null,
          interest_rate: debt.interest_rate || null,
          collateral: debt.collateral || null,
          maturity_date: debt.maturity_date || null
        };
        sqlStatements.push(buildInsertSql('debts_breakdown', data));
      });
    }

    // 4. Inventories and Projects SQL
    if (Array.isArray(enrichedData.inventories_and_projects)) {
      sqlStatements.push(`DELETE FROM inventories_and_projects WHERE ticker = '${ticker}' AND year = ${year} AND report_type = '${reportType}';`);
      
      enrichedData.inventories_and_projects.forEach((item, index) => {
        const data = {
          id: `${reportId}_inventory_${index}`,
          ticker,
          year,
          report_type: reportType,
          item_name: item.item_name,
          item_type: item.item_type,
          value: item.value !== undefined ? item.value : null,
          provision: item.provision !== undefined ? item.provision : null,
          description: item.description || null
        };
        sqlStatements.push(buildInsertSql('inventories_and_projects', data));
      });
    }

    // 5. Industry Metrics SQL
    if (businessModel === 'bank' && enrichedData.banking_metrics) {
      sqlStatements.push(`DELETE FROM banking_metrics WHERE ticker = '${ticker}' AND year = ${year} AND report_type = '${reportType}';`);
      
      const metrics = enrichedData.banking_metrics;
      const data = {
        id: reportId,
        ticker,
        year,
        report_type: reportType,
        casa_ratio: metrics.casa_ratio !== undefined ? metrics.casa_ratio : null,
        nim: metrics.nim !== undefined ? metrics.nim : null,
        non_performing_loans: metrics.non_performing_loans ? (typeof metrics.non_performing_loans === 'string' ? metrics.non_performing_loans : JSON.stringify(metrics.non_performing_loans)) : null,
        provision_coverage_ratio: metrics.provision_coverage_ratio !== undefined ? metrics.provision_coverage_ratio : null
      };
      sqlStatements.push(buildInsertSql('banking_metrics', data));
    } 
    else if (businessModel === 'securities' && enrichedData.securities_metrics) {
      sqlStatements.push(`DELETE FROM securities_metrics WHERE ticker = '${ticker}' AND year = ${year} AND report_type = '${reportType}';`);
      
      const metrics = enrichedData.securities_metrics;
      const data = {
        id: reportId,
        ticker,
        year,
        report_type: reportType,
        margin_outstanding: metrics.margin_outstanding !== undefined ? metrics.margin_outstanding : null,
        fvtpl_value: metrics.fvtpl_value !== undefined ? metrics.fvtpl_value : null,
        afs_value: metrics.afs_value !== undefined ? metrics.afs_value : null,
        htm_value: metrics.htm_value !== undefined ? metrics.htm_value : null
      };
      sqlStatements.push(buildInsertSql('securities_metrics', data));
    } 
    else if (businessModel === 'real_estate' && enrichedData.real_estate_metrics) {
      sqlStatements.push(`DELETE FROM real_estate_metrics WHERE ticker = '${ticker}' AND year = ${year} AND report_type = '${reportType}';`);
      
      const metrics = enrichedData.real_estate_metrics;
      const data = {
        id: reportId,
        ticker,
        year,
        report_type: reportType,
        customer_advances: metrics.customer_advances !== undefined ? metrics.customer_advances : null,
        unearned_revenue: metrics.unearned_revenue !== undefined ? metrics.unearned_revenue : null
      };
      sqlStatements.push(buildInsertSql('real_estate_metrics', data));
    } 
    else if (enrichedData.general_metrics) {
      sqlStatements.push(`DELETE FROM general_metrics WHERE ticker = '${ticker}' AND year = ${year} AND report_type = '${reportType}';`);
      
      const metrics = enrichedData.general_metrics;
      const data = {
        id: reportId,
        ticker,
        year,
        report_type: reportType,
        gross_margin: metrics.gross_margin !== undefined ? metrics.gross_margin : null,
        depreciation_expense: metrics.depreciation_expense !== undefined ? metrics.depreciation_expense : null,
        divestment_profit: metrics.divestment_profit !== undefined ? metrics.divestment_profit : null
      };
      sqlStatements.push(buildInsertSql('general_metrics', data));
    }

    // 5.5 Financial Insights SQL
    if (enrichedData.financial_insights || enrichedData.business_risks) {
      sqlStatements.push(`DELETE FROM financial_insights WHERE ticker = '${ticker}' AND year = ${year} AND report_type = '${reportType}';`);
      
      const insights = enrichedData.financial_insights || {};
      const businessRisks = enrichedData.business_risks || insights.business_risks;
      const data = {
        id: reportId,
        ticker,
        year,
        report_type: reportType,
        related_party_risk: insights.related_party_risk || null,
        debt_risk: insights.debt_risk || null,
        inventory_risk: insights.inventory_risk || null,
        governance_risk_score: insights.governance_risk_score !== undefined ? insights.governance_risk_score : null,
        overall_analysis: insights.overall_analysis || null,
        business_risks: businessRisks ? (typeof businessRisks === 'string' ? businessRisks : JSON.stringify(businessRisks)) : null
      };
      sqlStatements.push(buildInsertSql('financial_insights', data));
    }

    // 5.6 Shareholder Structures SQL
    if (Array.isArray(enrichedData.shareholder_structures)) {
      sqlStatements.push(`DELETE FROM shareholder_structures WHERE ticker = '${ticker}' AND year = ${year};`);
      
      enrichedData.shareholder_structures.forEach((sh, index) => {
        const data = {
          id: `${ticker}_${year}_${index}`,
          ticker,
          year,
          shareholder_name: sh.shareholder_name,
          shareholder_type: sh.shareholder_type,
          share_count: sh.share_count !== undefined ? sh.share_count : null,
          share_percentage: sh.share_percentage,
          is_major_shareholder: sh.is_major_shareholder ? 1 : 0,
          is_board_member: sh.is_board_member ? 1 : 0
        };
        sqlStatements.push(buildInsertSql('shareholder_structures', data));
      });
    }

    // 6. Record Processed Report (Idempotency Journal)
    const processedData = {
      id: reportId,
      ticker,
      year,
      report_type: reportType
    };
    sqlStatements.push(buildInsertSql('processed_reports', processedData));

    if (sqlStatements.length === 0) return;

    // Concat all statements with newlines
    const fullSql = sqlStatements.join('\n');

    // Create a unique temporary SQL file to avoid concurrent writes and locking issues
    const tempFileName = `temp_insert_${ticker}_${year}_${Date.now()}.sql`;
    // Use relative paths to bypass Windows shell encoding issues with absolute paths containing Vietnamese accents (e.g. "Hùng" -> "HA1ng")
    const tempFilePath = tempFileName;
    
    fs.writeFileSync(tempFilePath, fullSql, 'utf-8');

    // Use relative path for wrangler.js executable to bypass Windows path encoding issues
    const wranglerBin = 'node_modules/wrangler/bin/wrangler.js';
    const targetFlag = this.local ? '--local' : '--remote';
    const cmd = `"node" "${wranglerBin}" d1 execute ${this.database} --file "${tempFilePath}" ${targetFlag} --json`;

    // Mutex locking mechanism to serialize write execution on SQLite local database
    const executeWithMutex = async () => {
      let release;
      const lockPromise = new Promise(r => { release = r; });
      const previousMutex = writeMutex;
      writeMutex = lockPromise;
      
      await previousMutex;
      
      try {
        const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
        return JSON.parse(stdout.trim());
      } finally {
        release();
      }
    };

    try {
      const result = await executeWithMutex();
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return result;
    } catch (error) {
      const stderr = error.stderr || '';
      throw new Error(`D1 Loader failed to execute SQL file for ${ticker}. Error: ${error.message}. Stderr: ${stderr}`);
    }
  }
}
