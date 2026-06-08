#!/usr/bin/env zx
import { $, fetch } from 'zx'

$.shell = 'powershell.exe'
$.prefix = ''

const BASE = process.env.BASE_URL ?? 'http://localhost:8787'

// Các endpoints cần check
const ENDPOINTS = [
  { path: '/api/companies', type: 'array' },
  { path: '/api/companies/VNM', type: 'object' },
  { path: '/api/companies/VNM/business-model', type: 'object' },
  { path: '/api/companies/VNM/research', type: 'object' },
  { path: '/api/companies/VNM/financial-insights', type: 'array' },
  { path: '/api/companies/VNM/debts-breakdown', type: 'array' },
  { path: '/api/companies/VNM/inventories', type: 'array' },
  { path: '/api/companies/VNM/related-party-transactions', type: 'array' },
  { path: '/api/companies/VNM/banking-metrics', type: 'array' },
  { path: '/api/companies/VNM/pack', type: 'object' },
]

console.log(`🚀 Chạy kiểm tra sức khỏe API tại địa chỉ: ${BASE}\n`)

const results = await Promise.all(
  ENDPOINTS.map(async ({ path, type }) => {
    try {
      const start = Date.now()
      const res = await fetch(`${BASE}${path}`, {
        headers: {
          'X-API-Key': 'Luahoachungkhoan@ssi'
        }
      })
      const ms = Date.now() - start
      const body = await res.json()

      let snakeKeys = []
      let data = body.result


      if (data) {
        if (Array.isArray(data)) {
          if (data.length > 0) {
            snakeKeys = Object.keys(data[0]).filter(k => k.includes('_'))
          }
        } else if (typeof data === 'object') {
          // Check top-level keys
          snakeKeys = Object.keys(data).filter(k => k.includes('_'))
        }
      }

      const passed = res.status === 200 && snakeKeys.length === 0
      const icon = passed ? '✅' : '❌'
      console.log(`${icon} ${path} — ${res.status} (${ms}ms)${snakeKeys.length ? ` | snake_case keys phát hiện: ${snakeKeys.join(', ')}` : ''}`)
      return { path, status: res.status, ms, snakeKeys, passed }
    } catch (err) {
      console.log(`❌ ${path} — Error: ${err.message}`)
      return { path, status: 500, ms: 0, snakeKeys: [], passed: false }
    }
  })
)

const failed = results.filter(r => !r.passed)
if (failed.length === 0) {
  console.log('\n🎉 Toàn bộ API hoạt động chính xác và chuẩn hóa camelCase!')
} else {
  console.log(`\n⚠️ Phát hiện ${failed.length} endpoints bị lỗi hoặc chưa đúng chuẩn:`)
  failed.forEach(r => console.log(`  - ${r.path}: status=${r.status}, snakeCaseKeys=[${r.snakeKeys.join(', ')}]`))  
  process.exit(1)
}
