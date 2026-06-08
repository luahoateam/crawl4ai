import { beforeAll, inject } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { companies, businessModels, dailyResearch, financialInsights, debtsBreakdown, inventoriesAndProjects, relatedPartyTransactions, bankingMetrics, auditReports } from '../src/db/schema';

beforeAll(async () => {
  // 1. Lấy migrations được cung cấp từ môi trường Node.js và áp dụng
  const migrations = inject('migrations');
  await applyD1Migrations(env.DB, migrations);

  // 2. Seed dữ liệu cho AAA và VNM
  const db = drizzle(env.DB);
  const now = new Date();

  // Seed companies
  await db.insert(companies).values([
    { symbol: 'AAA', exchange: 'HOSE', industry: 'Bao bì', updatedAt: now },
    { symbol: 'VNM', exchange: 'HOSE', industry: 'Sữa', updatedAt: now },
  ]).onConflictDoNothing();

  // Seed business models
  await db.insert(businessModels).values([
    {
      symbol: 'AAA',
      revenueStruct: 'Bao bì nhựa (80%)',
      inputs: 'Hạt nhựa nguyên sinh',
      production: 'Dây chuyền extrude',
      outputs: 'Túi tự hủy',
      profitStruct: 'Mảng bao bì xanh đóng góp 25% lợi nhuận gộp'
    },
    {
      symbol: 'VNM',
      revenueStruct: 'Sữa đặc & Sữa bột (60%)',
      inputs: 'Sữa tươi nguyên liệu',
      production: 'Nhà máy sữa hiện đại',
      outputs: 'Sữa hộp các loại',
      profitStruct: 'Biên lợi nhuận gộp mảng sữa nước đạt 40%'
    }
  ]).onConflictDoNothing();

  // Seed daily research
  await db.insert(dailyResearch).values([
    {
      symbol: 'VNM',
      summary: 'VNM tiếp tục duy trì vị thế dẫn đầu ngành sữa.',
      ssiReview: 'Đánh giá khả quan với mức định giá hợp lý.',
      lastUpdated: now
    }
  ]).onConflictDoNothing();

  // Seed financial insights
  await db.insert(financialInsights).values([
    {
      id: 'VNM_2025_Hopnhat',
      ticker: 'VNM',
      year: 2025,
      reportType: 'Hopnhat',
      relatedPartyRisk: 'Thấp',
      debtRisk: 'Thấp',
      inventoryRisk: 'Trung bình',
      governanceRiskScore: 90,
      overallAnalysis: 'Sức khỏe tài chính rất tốt.'
    }
  ]).onConflictDoNothing();

  // Seed debts breakdown
  await db.insert(debtsBreakdown).values([
    {
      id: 'VNM_2025_Hopnhat_1',
      ticker: 'VNM',
      year: 2025,
      reportType: 'Hopnhat',
      creditorName: 'Ngân hàng VCB',
      debtType: 'Vay ngắn hạn',
      amount: 1000000000000,
      interestRate: '6.5%',
      collateral: 'Tín chấp',
      maturityDate: '2026-06-30'
    }
  ]).onConflictDoNothing();

  // Seed inventories and projects
  await db.insert(inventoriesAndProjects).values([
    {
      id: 'VNM_2025_Hopnhat_inv1',
      ticker: 'VNM',
      year: 2025,
      reportType: 'Hopnhat',
      itemName: 'Nguyên vật liệu sữa',
      itemType: 'Hàng tồn kho',
      value: 2000000000000,
      provision: 10000000000,
      description: 'Nguyên liệu nhập khẩu'
    }
  ]).onConflictDoNothing();

  // Seed related party transactions
  await db.insert(relatedPartyTransactions).values([
    {
      id: 'VNM_2025_Hopnhat_rel1',
      ticker: 'VNM',
      year: 2025,
      reportType: 'Hopnhat',
      relatedPartyName: 'Công ty con Đường Việt Nam',
      relationship: 'Công ty con',
      transactionType: 'Mua nguyên liệu',
      value: 500000000000,
      interestRate: 'N/A',
      collateral: 'Không'
    }
  ]).onConflictDoNothing();

  // Seed banking metrics
  await db.insert(bankingMetrics).values([
    {
      id: 'VNM_2025_Hopnhat_bank1',
      ticker: 'VNM',
      year: 2025,
      reportType: 'Hopnhat',
      casaRatio: 12.5,
      nim: 3.8,
      nonPerformingLoans: '0.8%',
      provisionCoverageRatio: 150.0
    }
  ]).onConflictDoNothing();

  // Seed audit reports
  await db.insert(auditReports).values([
    {
      id: 'VNM_2025_Hopnhat_audit',
      ticker: 'VNM',
      year: 2025,
      reportType: 'Hopnhat',
      auditorName: 'KPMG',
      auditOpinion: 'Chấp nhận toàn phần',
      goingConcernIssue: 0,
      goingConcernDetail: null
    }
  ]).onConflictDoNothing();
});

