import { test, expect } from '@playwright/test';
import testUrls from '../config/visual-test-urls.json';

const viewportSizes = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

test.describe('Visual Regression Tests', () => {
  // URLリストから動的にテストを生成
  testUrls.pages.forEach((pageConfig) => {
    const viewports = pageConfig.viewport || ['desktop'];
    
    viewports.forEach((viewport) => {
      test(`${pageConfig.description} - ${viewport}`, async ({ page }) => {
        await page.setViewportSize(viewportSizes[viewport as keyof typeof viewportSizes]);
        await page.goto(pageConfig.path);
        await page.waitForLoadState('networkidle');
        
        // マスク処理が必要な場合
        const maskSelectors = pageConfig.mask || [];
        const maskLocators = maskSelectors.map(selector => page.locator(selector));
        
        await expect(page).toHaveScreenshot(`${pageConfig.name}-${viewport}.png`, {
          mask: maskLocators.length > 0 ? maskLocators : undefined,
        });
      });
    });
  });

  // 要素単位のテスト
  testUrls.elements.forEach((elementConfig) => {
    test(`${elementConfig.description}の見た目が変わっていないか`, async ({ page }) => {
      await page.goto(elementConfig.path);
      await page.waitForLoadState('networkidle');
      
      const element = page.locator(elementConfig.selector);
      await expect(element).toHaveScreenshot(`${elementConfig.name}.png`);
    });
  });
});

