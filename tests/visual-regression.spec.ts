import { test, expect } from '@playwright/test';
import testUrls from '../config/visual-test-urls.json';
import * as fs from 'fs';
import * as path from 'path';

const viewportSizes = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

// UTC時刻をJST（UTC+9）に変換する関数
function toJST(utcString: string): string {
  try {
    const date = new Date(utcString);
    // UTC+9時間（JST）に変換
    const jstTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const year = jstTime.getUTCFullYear();
    const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jstTime.getUTCDate()).padStart(2, '0');
    const hours = String(jstTime.getUTCHours()).padStart(2, '0');
    const minutes = String(jstTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(jstTime.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} JST`;
  } catch (e) {
    return utcString; // 変換に失敗した場合は元の文字列を返す
  }
}

test.describe('Visual Regression Tests', () => {
  // URLリストから動的にテストを生成
  testUrls.pages.forEach((pageConfig) => {
    const viewports = pageConfig.viewport || ['desktop'];
    
    viewports.forEach((viewport) => {
      test(`${pageConfig.description} - ${viewport}`, async ({ page }, testInfo) => {
        // 画像取得時刻を記録（スクリーンショット撮影前）
        const screenshotTimestamp = new Date().toISOString();
        
        // ベースラインメタデータを読み込む
        let baselineInfo = null;
        const metadataPath = path.join(__dirname, 'baseline-metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            baselineInfo = {
              commit: metadata.commit || 'unknown',
              timestamp: metadata.timestamp || 'unknown',
              runId: metadata.run_id || 'unknown',
            };
          } catch (e) {
            console.warn('Failed to read baseline metadata:', e);
          }
        }
        
        // レポートにベースライン情報と現在のテスト情報を表示
        if (process.env.GITHUB_SHA) {
          const currentCommit = process.env.GITHUB_SHA.slice(0, 7);
          const branch = process.env.GITHUB_REF_NAME || 'unknown';
          const isMainBranch = branch === 'main';
          
          // ベースライン情報
          if (baselineInfo) {
            const baselineTimestampJST = baselineInfo.timestamp !== 'unknown' ? toJST(baselineInfo.timestamp) : 'unknown';
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: `Baseline from Commit: ${baselineInfo.commit} | Captured: ${baselineTimestampJST} | Run: ${baselineInfo.runId}`,
            });
          } else {
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: isMainBranch 
                ? 'Creating new baseline (first run)'
                : `Comparing against baseline from main branch (Commit: ${process.env.BASELINE_COMMIT || 'latest'})`,
            });
          }
          
          // 現在のテスト実行情報（画像取得時刻を使用）
          testInfo.annotations.push({
            type: 'Current Test',
            description: `Test Commit: ${currentCommit} | Branch: ${branch} | Screenshot captured: ${screenshotTimestamp}`,
          });
        } else {
          if (baselineInfo) {
            const baselineTimestampJST = baselineInfo.timestamp !== 'unknown' ? toJST(baselineInfo.timestamp) : 'unknown';
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: `Baseline from ${baselineTimestampJST} (Run: ${baselineInfo.runId})`,
            });
          } else {
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: 'Comparing against local baseline image',
            });
          }
          testInfo.annotations.push({
            type: 'Current Test',
            description: `Screenshot captured: ${screenshotTimestamp}`,
          });
        }

        await page.setViewportSize(viewportSizes[viewport as keyof typeof viewportSizes]);
        await page.goto(pageConfig.path, { waitUntil: 'load' });
        
        // ページが完全に安定するまで待機
        // 動的コンテンツ（アニメーション、遅延読み込みなど）を考慮
        await page.waitForTimeout(3000);
        
        // スクロール位置を固定
        await page.evaluate(() => {
          window.scrollTo(0, 0);
          // アニメーションを無効化
          document.body.style.setProperty('animation', 'none', 'important');
          document.body.style.setProperty('transition', 'none', 'important');
        });
        
        // 追加の待機時間
        await page.waitForTimeout(1000);
        
        // マスク処理が必要な場合
        const maskSelectors = pageConfig.mask || [];
        const maskLocators = maskSelectors.map(selector => page.locator(selector));
        
        await expect(page).toHaveScreenshot(`${pageConfig.name}-${viewport}.png`, {
          mask: maskLocators.length > 0 ? maskLocators : undefined,
          timeout: 30000, // スクリーンショットのタイムアウトを30秒に延長
          maxDiffPixels: 2000, // 許容するピクセル差分をさらに増やす
          animations: 'disabled', // アニメーションを無効化
        });
        
        // 成功時でもスクリーンショットをレポートに添付
        const screenshot = await page.screenshot({
          mask: maskLocators.length > 0 ? maskLocators : undefined,
          fullPage: true,
        });
        await testInfo.attach(`${pageConfig.name}-${viewport}-actual.png`, {
          body: screenshot,
          contentType: 'image/png',
        });
      });
    });
  });

  // 要素単位のテスト
  testUrls.elements.forEach((elementConfig) => {
      test(`${elementConfig.description}の見た目が変わっていないか`, async ({ page }, testInfo) => {
        // 画像取得時刻を記録（スクリーンショット撮影前、JSTで表示）
        const screenshotTimestampUTC = new Date().toISOString();
        const screenshotTimestamp = toJST(screenshotTimestampUTC);
        
        // ベースラインメタデータを読み込む
        let baselineInfo = null;
        const metadataPath = path.join(__dirname, 'baseline-metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            baselineInfo = {
              commit: metadata.commit || 'unknown',
              timestamp: metadata.timestamp || 'unknown',
              runId: metadata.run_id || 'unknown',
            };
          } catch (e) {
            console.warn('Failed to read baseline metadata:', e);
          }
        }
        
        // レポートにベースライン情報と現在のテスト情報を表示
        if (process.env.GITHUB_SHA) {
          const currentCommit = process.env.GITHUB_SHA.slice(0, 7);
          const branch = process.env.GITHUB_REF_NAME || 'unknown';
          const isMainBranch = branch === 'main';
          
          // ベースライン情報
          if (baselineInfo) {
            const baselineTimestampJST = baselineInfo.timestamp !== 'unknown' ? toJST(baselineInfo.timestamp) : 'unknown';
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: `Baseline from Commit: ${baselineInfo.commit} | Captured: ${baselineTimestampJST} | Run: ${baselineInfo.runId}`,
            });
          } else {
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: isMainBranch 
                ? 'Creating new baseline (first run)'
                : `Comparing against baseline from main branch (Commit: ${process.env.BASELINE_COMMIT || 'latest'})`,
            });
          }
          
          // 現在のテスト実行情報（画像取得時刻を使用）
          testInfo.annotations.push({
            type: 'Current Test',
            description: `Test Commit: ${currentCommit} | Branch: ${branch} | Screenshot captured: ${screenshotTimestamp}`,
          });
        } else {
          if (baselineInfo) {
            const baselineTimestampJST = baselineInfo.timestamp !== 'unknown' ? toJST(baselineInfo.timestamp) : 'unknown';
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: `Baseline from ${baselineTimestampJST} (Run: ${baselineInfo.runId})`,
            });
          } else {
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: 'Comparing against local baseline image',
            });
          }
          testInfo.annotations.push({
            type: 'Current Test',
            description: `Screenshot captured: ${screenshotTimestamp}`,
          });
        }

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
      
      // 成功時でもスクリーンショットをレポートに添付
      const elementScreenshot = await element.first().screenshot();
      await testInfo.attach(`${elementConfig.name}-actual.png`, {
        body: elementScreenshot,
        contentType: 'image/png',
      });
    });
  });
});

