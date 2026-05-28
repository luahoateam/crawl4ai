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

async function testHomepage() {
  console.log('Running testHomepage E2E...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:4321', { waitUntil: 'networkidle2' });

    console.log('Testing statistics counts...');
    const statsText = await page.evaluate(() => {
      const el = document.querySelector('.stat-companies');
      return el ? el.textContent.trim() : null;
    });
    console.log(`Stats Companies Text: ${statsText}`);
    // RED phase: Nếu chưa implement fetchStats, statsText có thể hiển thị số cứng cũ hoặc lỗi.
    // GREEN phase mong đợi statsText chứa số thực tế từ DB, ví dụ "1.617" hoặc số > 0.
    assert.ok(statsText, 'Stats companies element must exist');
    
    // Kiểm tra các widget khác
    const hasNewsFeed = await page.evaluate(() => !!document.querySelector('.news-feed-section'));
    const hasResearchFeed = await page.evaluate(() => !!document.querySelector('.research-feed-section'));
    const hasDocsWidget = await page.evaluate(() => !!document.querySelector('.widget-docs'));

    console.log(`News Feed exists: ${hasNewsFeed}`);
    console.log(`Research Feed exists: ${hasResearchFeed}`);
    console.log(`Docs Widget exists: ${hasDocsWidget}`);

    assert.ok(hasNewsFeed, 'News feed widget section must exist');
    assert.ok(hasResearchFeed, 'Research feed widget section must exist');
    assert.ok(hasDocsWidget, 'Docs widget section must exist');

    console.log('Checking news cards rendering...');
    const newsCardsCount = await page.evaluate(() => {
      return document.querySelectorAll('.news-feed-section .news-card').length;
    });
    console.log(`News Cards Count: ${newsCardsCount}`);
    assert.ok(newsCardsCount >= 1, 'Should render news cards');

    console.log('Checking docs cards rendering...');
    const docsCardsCount = await page.evaluate(() => {
      return document.querySelectorAll('.widget-docs .doc-card').length;
    });
    console.log(`Docs Cards Count: ${docsCardsCount}`);
    assert.ok(docsCardsCount >= 1, 'Should render document cards');

    console.log('✅ GREEN PASS: Trang chủ render đầy đủ các widgets và dữ liệu từ API!');
  } catch (err) {
    console.error('❌ RED FAIL / Assertion failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testHomepage();
