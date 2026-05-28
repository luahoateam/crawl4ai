import puppeteer from 'puppeteer';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function audit() {
  const targetUrl = 'https://stock-portal.luahoateam.workers.dev';
  console.log(`🚀 Bắt đầu Chrome DevTools Audit cho Phase 9 trên: ${targetUrl}`);
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  const consoleErrors = [];
  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // 1. Audit Trang chủ
    console.log('\n--- 🏠 Audit Trang Chủ ---');
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    
    // Check Logo text
    const logoTextHtml = await page.evaluate(() => {
      const headerLogo = document.querySelector('header a');
      return headerLogo ? headerLogo.innerHTML : '';
    });
    assert(!logoTextHtml.includes('LÚA HÓA'), 'Không hiển thị text "LÚA HÓA" thừa trong logo của Header.');

    // Check /research links
    const hasResearchLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('header a, nav a, footer a'));
      return links.some(a => a.getAttribute('href') === '/research');
    });
    assert(!hasResearchLinks, 'Đã loại bỏ hoàn toàn các liên kết đến /research khỏi Header, Navigation và Footer.');

    // Check VN30 section position
    const vn30Position = await page.evaluate(() => {
      const vn30 = document.querySelector('[data-section="vn30"]');
      if (!vn30) return null;
      const rect = vn30.getBoundingClientRect();
      return rect.top;
    });
    assert(vn30Position !== null, 'Section VN30 tồn tại với attribute data-section="vn30".');
    assert(vn30Position < 800, `Section VN30 hiển thị ở vị trí đầu trang (getBoundingClientRect().top = ${vn30Position}px).`);

    // Check BCTC section removal
    const hasBCTCSection = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2'));
      return headings.some(h => h.textContent.includes('Báo Cáo Tài Chính Cho AI Đọc'));
    });
    assert(!hasBCTCSection, 'Section "Báo Cáo Tài Chính Cho AI Đọc" đã được dọn dẹp hoàn toàn khỏi trang chủ.');

    // 2. Audit access trực tiếp trang /research
    console.log('\n--- 🔍 Audit Trang Nghiên Cứu (/research) ---');
    const researchResponse = await page.goto(`${targetUrl}/research`, { waitUntil: 'networkidle2' });
    assert(researchResponse.status() === 200, 'Trang /research vẫn truy cập trực tiếp thành công (Status 200).');

    // 3. Audit trang chi tiết HPG (JSON ValueChain & SSI Research)
    console.log('\n--- 📊 Audit Trang Chi Tiết HPG (JSON Value Chain) ---');
    await page.goto(`${targetUrl}/companies/HPG`, { waitUntil: 'networkidle2' });

    // Check flow cards
    const hpgFlowCards = await page.evaluate(() => {
      return document.querySelectorAll('.interactive-flow-card').length;
    });
    assert(hpgFlowCards > 0, `Hiển thị ${hpgFlowCards} flow cards của chuỗi giá trị HPG thành công.`);

    // Check ratio badge
    const emptyBadgesCountHpg = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('.card-ratio-badge'));
      return badges.filter(b => b.textContent.trim() === '0%' || b.textContent.trim() === '').length;
    });
    assert(emptyBadgesCountHpg === 0, 'Tuyệt vời! Huy hiệu tỉ trọng (ratio badge) được bảo vệ, không render các badge rỗng vô nghĩa.');

    // Check SSI Research Tab (gated overlay)
    // Click tab Daily Research
    await page.evaluate(() => {
      const trigger = document.querySelector('.tab-trigger[data-tab="daily-research"]');
      if (trigger) trigger.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const lockOverlayVisible = await page.evaluate(() => {
      const overlay = document.querySelector('.gated-lock-overlay');
      return overlay && getComputedStyle(overlay).display !== 'none';
    });
    assert(lockOverlayVisible, 'Hệ thống gated block hiển thị overlay khóa nội dung báo cáo khi chưa đăng nhập.');

    // 4. Audit trang chi tiết FPT (Text thô ValueChain & No Empty Badge/Tooltip)
    console.log('\n--- 💻 Audit Trang Chi Tiết FPT (Text Thô Value Chain) ---');
    await page.goto(`${targetUrl}/companies/FPT`, { waitUntil: 'networkidle2' });

    // Check flow cards
    const fptFlowCards = await page.evaluate(() => {
      return document.querySelectorAll('.interactive-flow-card').length;
    });
    assert(fptFlowCards > 0, `Hiển thị ${fptFlowCards} flow cards từ dữ liệu text thô của chuỗi giá trị FPT thành công.`);

    // Check empty ratio badge
    const emptyBadgesCount = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('.card-ratio-badge'));
      return badges.filter(b => b.textContent.trim() === '0%' || b.textContent.trim() === '').length;
    });
    assert(emptyBadgesCount === 0, 'Tuyệt vời! Không có ratio badge rỗng (hoặc 0%) vô nghĩa hiển thị trên trang FPT.');

    // Check tooltip title parenthesis
    const tooltipTitlesEmptyParenthesis = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('.tooltip-header'));
      return headers.some(h => h.textContent.includes('()'));
    });
    assert(!tooltipTitlesEmptyParenthesis, 'Không có dấu ngoặc đơn trống "()" trong tiêu đề của tooltip khi tỉ trọng rỗng.');

    // 5. Kiểm thử login để kiểm tra SSI Research 2-block layout & badge
    console.log('\n--- 🔑 Kiểm Thử Đăng Nhập & Layout Báo Cáo Chuyên Sâu ---');
    await page.goto(`${targetUrl}/login`, { waitUntil: 'networkidle2' });
    await page.type('#username', 'luahoateam');
    await page.type('#password', 'password123');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // Quay lại HPG
    await page.goto(`${targetUrl}/companies/HPG`, { waitUntil: 'networkidle2' });
    // Click tab
    await page.evaluate(() => {
      const trigger = document.querySelector('.tab-trigger[data-tab="daily-research"]');
      if (trigger) trigger.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Check 2-block layout
    const hasSummaryBlock = await page.evaluate(() => {
      return document.body.textContent.includes('Tóm Tắt Nhận Định');
    });
    const hasSsiReviewBlock = await page.evaluate(() => {
      return document.body.textContent.includes('Đánh Giá Chi Tiết SSI Research');
    });
    assert(hasSummaryBlock && hasSsiReviewBlock, 'Hiển thị chính xác layout 2 khối song song (Tóm Tắt Nhận Định & Đánh Giá Chi Tiết).');

    // Check new badge SSI Research
    const hasSsiResearchBadge = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('.research-card span'));
      return badges.some(b => b.textContent.includes('SSI Research'));
    });
    const hasChuyenSauBadge = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('.research-card span'));
      return badges.some(b => b.textContent.includes('CHUYÊN SÂU'));
    });
    assert(hasSsiResearchBadge, 'Badge nhãn của Daily Research đổi tên thành "SSI Research" thành công.');
    assert(!hasChuyenSauBadge, 'Nhãn cũ "CHUYÊN SÂU" đã được loại bỏ hoàn toàn.');

    // 6. Console Errors Audit
    console.log('\n--- 🛠️ Console Errors Audit ---');
    if (consoleErrors.length === 0) {
      console.log('✅ Tuyệt vời! Không phát hiện lỗi JavaScript nào trên Console.');
    } else {
      console.warn('⚠️ Phát hiện lỗi Console (nếu có):');
      consoleErrors.forEach(err => console.warn(`   - ${err}`));
    }

    console.log(`\n📊 KẾT QUẢ AUDIT: ${passCount} PASSED, ${failCount} FAILED.`);
    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Lỗi nghiêm trọng khi thực hiện audit:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

audit();
