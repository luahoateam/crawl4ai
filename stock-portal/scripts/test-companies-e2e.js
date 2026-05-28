import puppeteer from 'puppeteer';
import fs from 'fs';
import assert from 'assert';

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

let chromePath = '';
for (const path of chromePaths) {
  if (fs.existsSync(path)) {
    chromePath = path;
    break;
  }
}

if (!chromePath) {
  console.error('❌ Không tìm thấy Google Chrome!');
  process.exit(1);
}

async function testCompaniesE2E() {
  console.log('Running testCompaniesE2E...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:4321/companies', { waitUntil: 'networkidle2' });

    console.log('Checking badge elements...');
    // Đếm số badge bm, research và docs hiện có
    const badgeBmCount = await page.evaluate(() => {
      return document.querySelectorAll('.badge-bm').length;
    });
    console.log(`Badge BM Count: ${badgeBmCount}`);
    
    // RED phase: Khi chưa cập nhật index.astro của companies, các class badge-bm sẽ không có.
    assert.ok(badgeBmCount >= 1, 'Should render at least 1 badge-bm for seeded AAA or VNM');

    // Kiểm tra filter select #filter-data-type
    const filterDataTypeExists = await page.evaluate(() => {
      return !!document.getElementById('filter-data-type');
    });
    console.log(`Filter data type select exists: ${filterDataTypeExists}`);
    assert.ok(filterDataTypeExists, 'Filter data-type select element must exist');

    console.log('✅ GREEN PASS: Trang /companies có đầy đủ badges và bộ lọc mới!');
  } catch (err) {
    console.error('❌ RED FAIL / Assertion failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testCompaniesE2E();
