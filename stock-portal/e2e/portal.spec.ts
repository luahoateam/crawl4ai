import { test, expect } from '@playwright/test';

test.describe('Stock Portal E2E Tests', () => {
  const BASE_URL = 'http://localhost:4321';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('should search and navigate to HPG detail page', async ({ page }) => {
    const searchInput = page.locator('#search-input');
    await searchInput.fill('HPG');
    
    const dropdownItem = page.locator('.autocomplete-item[data-symbol="HPG"]');
    await expect(dropdownItem).toBeVisible();
    await dropdownItem.click();
    
    await expect(page).toHaveURL(/.*\/companies\/HPG/);
    await expect(page.locator('.symbol-badge')).toHaveText('HPG');
  });

  test('should filter companies list by HOSE exchange', async ({ page }) => {
    await page.goto(`${BASE_URL}/companies`);
    
    const exchangeSelect = page.locator('#filter-exchange');
    await exchangeSelect.selectOption('HOSE');
    
    // Đợi filter áp dụng
    await page.waitForTimeout(500);
    
    const visibleCards = page.locator('.company-card:visible');
    const count = await visibleCards.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const card = visibleCards.nth(i);
      const exchangeText = await card.locator('span:has-text("HOSE")').textContent();
      expect(exchangeText?.trim()).toBe('HOSE');
    }
  });

  test('should gate Daily Research tab and show login CTA when unauthenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/companies/HPG`);
    
    const dailyResearchTab = page.locator('.tab-trigger[data-tab="daily-research"]');
    await dailyResearchTab.click();
    
    const lockOverlay = page.locator('.gated-lock-overlay');
    await expect(lockOverlay).toBeVisible();
    await expect(lockOverlay.locator('.lock-title')).toHaveText('Nội Dung Bị Giới Hạn');
    
    const loginCTA = lockOverlay.locator('.btn-login-cta');
    await expect(loginCTA).toHaveAttribute('href', '/login');
  });

  test('should unlock Daily Research tab after successful login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.locator('#username').fill('luahoateam');
    await page.locator('#password').fill('password123');
    await page.locator('#btn-submit').click();
    
    await expect(page).toHaveURL(/.*\/companies/);
    
    await page.goto(`${BASE_URL}/companies/HPG`);
    
    const dailyResearchTab = page.locator('.tab-trigger[data-tab="daily-research"]');
    await dailyResearchTab.click();
    
    const lockOverlay = page.locator('.gated-lock-overlay');
    await expect(lockOverlay).not.toBeVisible();
    
    const researchReports = page.locator('.research-card');
    await expect(researchReports.first()).toBeVisible();
  });

  test('should persist light/dark theme preference', async ({ page }) => {
    const themeToggle = page.locator('.theme-toggle').first();
    const htmlElement = page.locator('html');
    
    const initialTheme = await htmlElement.getAttribute('data-theme');
    await themeToggle.click();
    
    const toggledTheme = await htmlElement.getAttribute('data-theme');
    expect(toggledTheme).not.toBe(initialTheme);
    
    await page.reload();
    const persistedTheme = await htmlElement.getAttribute('data-theme');
    expect(persistedTheme).toBe(toggledTheme);
  });

  test('should render Lua Hoa brand logo correctly', async ({ page }) => {
    const logoImg = page.locator('img[alt="Logo Lúa Hóa"]');
    await expect(logoImg).toBeVisible();
    await expect(logoImg).toHaveAttribute('src', '/logo.png');
  });

  test('should render 10,000+ hours banner and VN30 section on homepage', async ({ page }) => {
    // Check banner
    const banner = page.locator('text=10,000+ giờ lao động');
    await expect(banner).toBeVisible();

    // Check VN30 section
    const vn30Section = page.locator('text=Mô Hình Kinh Doanh Nhóm VN30');
    await expect(vn30Section).toBeVisible();

    const vn30Cards = page.locator('section:has-text("Mô Hình Kinh Doanh Nhóm VN30") .bg-card');
    await expect(vn30Cards.first()).toBeVisible();
  });

  test('should not show OCR keyword and show Accordion layout on /documents', async ({ page }) => {
    await page.goto(`${BASE_URL}/documents`);

    // Title & H1 check (No OCR word)
    const pageTitle = await page.title();
    expect(pageTitle).not.toContain('OCR');
    
    const h1 = page.locator('h1.page-title');
    await expect(h1).toHaveText('Báo Cáo Tài Chính Cho AI Đọc');
    expect(await h1.textContent()).not.toContain('OCR');

    // Check Accordion components
    const accordions = page.locator('.company-card-accordion');
    await expect(accordions.first()).toBeVisible();

    // Expand accordion and load document list
    const firstAccordionHeader = accordions.first().locator('.accordion-header');
    await firstAccordionHeader.click();

    const docList = accordions.first().locator('.doc-sublist');
    await expect(docList).toBeVisible();
    
    // Chờ fetch API trả về kết quả tài liệu
    await page.waitForTimeout(1000);
    const docItems = docList.locator('.sublist-item');
    await expect(docItems.first()).toBeVisible();

    const readBtn = docItems.first().locator('.read-ai-btn');
    await expect(readBtn).toHaveText('Đọc bằng AI →');
    expect(await readBtn.textContent()).not.toContain('OCR');
  });

  test('should not show News tab but show news links under Business Model on symbol page', async ({ page }) => {
    await page.goto(`${BASE_URL}/companies/HPG`);

    // Tab News should not exist
    const newsTab = page.locator('.tab-trigger[data-tab="news"]');
    await expect(newsTab).toHaveCount(0);

    // Business model tab should show news links section
    const newsLinksSection = page.locator('text=Thông tin thêm từ website chính chủ của doanh nghiệp');
    await expect(newsLinksSection).toBeVisible();
  });
});
