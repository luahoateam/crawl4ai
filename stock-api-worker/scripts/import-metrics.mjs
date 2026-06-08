#!/usr/bin/env zx
import { $, fs } from 'zx'

$.shell = 'powershell.exe'
$.prefix = ''

process.env.CLOUDFLARE_ACCOUNT_ID = '7c72ee1bcdc2afa2991960a054a10e8e'

const SEED_DIR = './migrations/seeds'

console.log('Starting Cloudflare D1 Remote Import sequentially...')

if (!fs.existsSync(SEED_DIR)) {
  console.error(`Error: Seeds directory ${SEED_DIR} does not exist. Run export_metrics.py first.`)
  process.exit(1)
}

const files = fs.readdirSync(SEED_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  console.log('No SQL files found to import.')
  process.exit(0)
}

console.log(`Found ${files.length} SQL files to import.`)

for (const file of files) {
  const filePath = `${SEED_DIR}/${file}`
  console.log(`\n-----------------------------------------`)
  console.log(`Executing import: ${file}`)
  console.log(`-----------------------------------------`)
  
  try {
    // Execute wrangler d1 execute command
    await $`npx wrangler d1 execute stock_db --remote --file=${filePath}`
    console.log(`✅ Success: Imported ${file}`)
  } catch (err) {
    console.error(`❌ Error importing ${file}:`, err)
    process.exit(1)
  }
}

console.log('\n🎉 Done! All partitioned D1 seed files successfully imported!')
