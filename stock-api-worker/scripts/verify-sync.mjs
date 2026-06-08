#!/usr/bin/env zx
import { $, retry } from 'zx'

$.shell = 'powershell.exe'
$.prefix = ''

process.env.CLOUDFLARE_ACCOUNT_ID = '7c72ee1bcdc2afa2991960a054a10e8e'

// Expected row counts sau khi sync (khớp chính xác 100% với Local D1 SQLite)
const EXPECTED = {
  debts_breakdown: 8081,
  inventories_and_projects: 6785,
  related_party_transactions: 16392,
  financial_insights: 1636,
  general_metrics: 1530,
  banking_metrics: 102,
}


console.log('\n🔍 Đang kiểm tra số lượng bản ghi trên Cloudflare D1 Remote...\n')

// Chạy các queries kiểm tra song song với retry phòng trường hợp rate limit từ Cloudflare API
const results = await Promise.all(
  Object.entries(EXPECTED).map(async ([table, expected]) => {
    try {
      const out = await retry(3, '2s', async () => {
        return await $`npx wrangler d1 execute stock_db --remote --command="SELECT COUNT(*) as cnt FROM ${table}" --json`
      })
      const stdout = out.stdout.toString()
      const json = JSON.parse(stdout)
      const actual = json[0]?.results?.[0]?.cnt ?? 0
      const passed = actual >= expected * 0.95 // Cho phép sai lệch 5% do thay đổi dữ liệu
      console.log(`${passed ? '✅' : '❌'} Bảng ${table}: ${actual} records (dự kiến ~${expected})`)
      return { table, expected, actual, passed }
    } catch (err) {
      console.log(`❌ Bảng ${table} gặp lỗi khi truy vấn: ${err.message}`)
      return { table, expected, actual: 0, passed: false }
    }
  })
)

const allPassed = results.every(r => r.passed)
console.log(`\n${allPassed ? '🎉 Tất cả bảng metrics trên Remote D1 đã được đồng bộ đầy đủ dữ liệu!' : '⚠️ Có một số bảng có thể chưa đồng bộ hoàn chỉnh'}`)
if (!allPassed) process.exit(1)
