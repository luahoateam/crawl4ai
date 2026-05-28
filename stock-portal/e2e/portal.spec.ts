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
    
    const visibleExchangeBadges = page.locator('.company-card:visible .badge-exchange');
    const count = await visibleExchangeBadges.count();
    
    for (let i = 0; i < count; i++) {
      await expect(visibleExchangeBadges.nth(i)).toHaveText('HOSE');
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

  test('should render Lua Hoa brand logo and title correctly', async ({ page }) => {
    const logoImg = page.locator('img[alt="Logo Lúa Hóa"]');
    await expect(logoImg).toBeVisible();
    await expect(logoImg).toHaveAttribute('src', '/logo.png');

    const logoText = page.locator('span:has-text("LÚA HÓA")');
    await expect(logoText).toBeVisible();
  });
});
