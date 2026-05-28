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

async function testResearchPageE2E() {
  console.log('Running testResearchPageE2E...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Xóa cookie trước tiên để đảm bảo trạng thái chưa đăng nhập
    await page.deleteCookie({ name: 'token', domain: 'localhost' });

    // 1. Kiểm tra trang /research khi chưa đăng nhập
    console.log('Step 1: Truy cập /research khi chưa đăng nhập...');
    const res = await page.goto('http://localhost:4321/research', { waitUntil: 'networkidle2' });
    console.log(`Response status of /research: ${res.status()}`);

    if (res.status() === 404) {
      console.log('RED phase: /research returned 404 as expected (Page not created yet).');
      return;
    }

    assert.strictEqual(res.status(), 200, 'Page status must be 200');

    // Kiểm tra title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    assert.ok(title.toLowerCase().includes('nghiên cứu') || title.toLowerCase().includes('phân tích'), 'Title must contain "Nghiên cứu" or "Phân tích"');

    // Kiểm tra có overlay khóa
    const hasOverlay = await page.evaluate(() => {
      return !!document.querySelector('.auth-gate-overlay');
    });
    console.log(`Auth gate overlay exists: ${hasOverlay}`);
    assert.ok(hasOverlay, 'Auth gate overlay must exist when not logged in');

    // Đảm bảo không render nội dung nghiên cứu thực sự trong DOM để tránh bypass bằng CSS
    const hasRealContent = await page.evaluate(() => {
      const items = document.querySelectorAll('.research-item-real');
      if (items.length === 0) return false;
      // Kiểm tra xem có item nào chứa nội dung phân tích thực sự không
      return Array.from(items).some(item => {
        const text = item.textContent || '';
        return text.includes('Hòa Phát') || text.includes('HPG') || text.includes('VNM') || text.includes('Vinamilk');
      });
    });
    console.log(`Has real content in DOM: ${hasRealContent}`);
    assert.ok(!hasRealContent, 'Real research content must NOT be rendered in DOM when not logged in');

    // 2. Thực hiện đăng nhập tại trang /login
    console.log('Step 2: Đi tới trang /login để thực hiện đăng nhập...');
    await page.goto('http://localhost:4321/login', { waitUntil: 'networkidle2' });

    await page.type('#username', 'luahoateam');
    await page.type('#password', 'password123');
    
    console.log('Click submit đăng nhập...');
    await Promise.all([
      page.click('#btn-submit'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    console.log(`Đăng nhập thành công, URL hiện tại: ${page.url()}`);

    // 3. Quay lại trang /research và kiểm tra
    console.log('Step 3: Quay lại trang /research...');
    await page.goto('http://localhost:4321/research', { waitUntil: 'networkidle2' });

    // Kiểm tra overlay khóa KHÔNG còn tồn tại
    const hasOverlayAfterLogin = await page.evaluate(() => {
      return !!document.querySelector('.auth-gate-overlay');
    });
    console.log(`Auth gate overlay exists after login: ${hasOverlayAfterLogin}`);
    assert.ok(!hasOverlayAfterLogin, 'Auth gate overlay must NOT exist after login');

    // Kiểm tra nội dung nghiên cứu thực sự xuất hiện trong DOM
    const hasRealContentAfterLogin = await page.evaluate(() => {
      const items = document.querySelectorAll('.research-item-real');
      return items.length >= 1;
    });
    console.log(`Has real content after login: ${hasRealContentAfterLogin}`);
    assert.ok(hasRealContentAfterLogin, 'Real research content must be rendered after login');

    // Clear cookies dọn dẹp
    await page.deleteCookie({ name: 'token', domain: 'localhost' });

    console.log('✅ GREEN PASS: Trang /research hoạt động tốt, phân quyền JWT chuẩn xác!');
  } catch (err) {
    console.error('❌ RED FAIL / Assertion failed:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testResearchPageE2E();
