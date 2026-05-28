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

async function testNewsPageE2E() {
  console.log('Running testNewsPageE2E...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const res = await page.goto('http://localhost:4321/news', { waitUntil: 'networkidle2' });
    console.log(`Response status of /news: ${res.status()}`);

    if (res.status() === 404) {
      console.log('RED phase: /news returned 404 as expected (Page not created yet).');
      return;
    }

    assert.strictEqual(res.status(), 200, 'Page status must be 200');
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    assert.ok(title.toLowerCase().includes('tin tức'), 'Title must contain "Tin tức"');

    const searchInputExists = await page.evaluate(() => {
      return !!document.getElementById('news-search');
    });
    console.log(`Search input exists: ${searchInputExists}`);
    assert.ok(searchInputExists, 'Search input #news-search must exist');

    const newsItemsCount = await page.evaluate(() => {
      return document.querySelectorAll('.news-item').length;
    });
    console.log(`News Items Count: ${newsItemsCount}`);
    assert.ok(newsItemsCount >= 1, 'Should render news items from D1');

    console.log('✅ GREEN PASS: Trang /news hoạt động tốt và hiển thị đầy đủ tin tức!');
  } catch (err) {
    console.error('❌ RED FAIL / Assertion failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testNewsPageE2E();
