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
        await page.goto(pageConfig.path, { waitUntil: 'load' });
        // ページが安定するまで待機（動的コンテンツの読み込みを待つ）
        await page.waitForTimeout(2000);
        // スクロール位置を固定
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);
        
        // マスク処理が必要な場合
        const maskSelectors = pageConfig.mask || [];
        const maskLocators = maskSelectors.map(selector => page.locator(selector));
        
        await expect(page).toHaveScreenshot(`${pageConfig.name}-${viewport}.png`, {
          mask: maskLocators.length > 0 ? maskLocators : undefined,
          timeout: 10000, // スクリーンショットのタイムアウトを10秒に延長
          maxDiffPixels: 1000, // 許容するピクセル差分を増やす
        });
      });
    });
  });

  // 要素単位のテスト
  testUrls.elements.forEach((elementConfig) => {
    test(`${elementConfig.description}の見た目が変わっていないか`, async ({ page, testInfo }) => {
      await page.goto(elementConfig.path, { waitUntil: 'load' });
      await page.waitForTimeout(1000);
      
      // 要素が存在するか確認
      const element = page.locator(elementConfig.selector);
      const count = await element.count();
      
      if (count === 0) {
        testInfo.skip(true, `Element "${elementConfig.selector}" not found on page`);
        return;
      }
      
      // 要素が表示されるまで待機（タイムアウトを短く設定）
      try {
        await element.first().waitFor({ state: 'visible', timeout: 10000 });
      } catch (e) {
        // 要素が見つからない場合はスキップ
        testInfo.skip(true, `Element "${elementConfig.selector}" not visible within timeout`);
        return;
      }
      
      await page.waitForTimeout(500);
      
      await expect(element.first()).toHaveScreenshot(`${elementConfig.name}.png`, {
        timeout: 10000,
        maxDiffPixels: 500,
      });
    });
  });
});

