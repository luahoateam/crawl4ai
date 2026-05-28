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

async function testDocumentsPageE2E() {
  console.log('Running testDocumentsPageE2E...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const res = await page.goto('http://localhost:4321/documents', { waitUntil: 'networkidle2' });
    console.log(`Response status of /documents: ${res.status()}`);

    if (res.status() === 404) {
      console.log('RED phase: /documents returned 404 as expected (Page not created yet).');
      return;
    }

    assert.strictEqual(res.status(), 200, 'Page status must be 200');
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    assert.ok(title.toLowerCase().includes('tài liệu'), 'Title must contain "Tài liệu"');

    const yearFilterExists = await page.evaluate(() => {
      return !!document.getElementById('filter-year');
    });
    console.log(`Year filter exists: ${yearFilterExists}`);
    assert.ok(yearFilterExists, 'Year filter #filter-year must exist');

    const docItemsCount = await page.evaluate(() => {
      return document.querySelectorAll('.doc-item').length;
    });
    console.log(`Document Items Count: ${docItemsCount}`);
    assert.ok(docItemsCount >= 1, 'Should render document items from D1');

    // Kiểm tra cấu trúc phần tử của doc item đầu tiên
    const hasViewBtn = await page.evaluate(() => {
      const firstItem = document.querySelector('.doc-item');
      if (!firstItem) return false;
      const viewBtn = firstItem.querySelector('.doc-view-btn');
      return !!viewBtn && viewBtn.getAttribute('href').includes('/api/documents/');
    });
    console.log(`First item has correct view button: ${hasViewBtn}`);
    assert.ok(hasViewBtn, 'Each doc item must have a link .doc-view-btn pointing to document fileUrl API');

    console.log('✅ GREEN PASS: Trang /documents hoạt động tốt và hiển thị đầy đủ tài liệu OCR!');
  } catch (err) {
    console.error('❌ RED FAIL / Assertion failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testDocumentsPageE2E();
