import { beforeAll, inject } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { companies, businessModels } from '../src/db/schema';

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
});
