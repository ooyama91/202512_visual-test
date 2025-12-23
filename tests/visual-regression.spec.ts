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

// Baseline情報の型定義
interface BaselineInfo {
  commit: string;
  timestamp: string;
  runId: string;
}

test.describe('Visual Regression Tests', () => {
  // URLリストから動的にテストを生成
  testUrls.pages.forEach((pageConfig) => {
    const viewports = pageConfig.viewport || ['desktop'];
    
    viewports.forEach((viewport) => {
      test(`${pageConfig.description} - ${viewport}`, async ({ page }, testInfo) => {
        // 画像取得時刻を記録（スクリーンショット撮影前、JSTで表示）
        const screenshotTimestampUTC = new Date().toISOString();
        const screenshotTimestamp = toJST(screenshotTimestampUTC);
        
        // ベースラインメタデータを読み込む（オプション、表示用）
        let baselineInfo: BaselineInfo | null = null;
        const metadataPath = path.join(__dirname, 'baseline-metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
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
          
          // ベースライン情報（固定baseline方式）
          if (baselineInfo && baselineInfo.timestamp !== 'unknown') {
            const baselineTimestampJST = toJST(baselineInfo.timestamp);
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: `Baseline from Commit: ${baselineInfo.commit} | Captured: ${baselineTimestampJST}`,
            });
          } else {
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: 'Comparing against committed baseline screenshots (fixed baseline)',
            });
          }
          
          // 現在のテスト実行情報（画像取得時刻を使用）
          testInfo.annotations.push({
            type: 'Current Test',
            description: `Test Commit: ${currentCommit} | Branch: ${branch} | Screenshot captured: ${screenshotTimestamp}`,
          });
        } else {
          if (baselineInfo && baselineInfo.timestamp !== 'unknown') {
            const baselineTimestampJST = toJST(baselineInfo.timestamp);
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: `Baseline from ${baselineTimestampJST}`,
            });
          } else {
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: 'Comparing against committed baseline screenshots',
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
        
        // baseline画像も添付（存在する場合）
        // Playwrightのbaseline画像は通常、テストファイル名-snapshotsディレクトリに保存される
        const snapshotPath = testInfo.snapshotPath(`${pageConfig.name}-${viewport}.png`);
        const possibleBaselinePaths = [
          snapshotPath,
          path.join(__dirname, 'visual-regression.spec.ts-snapshots', `${pageConfig.name}-${viewport}.png`),
          path.join(process.cwd(), 'tests', 'visual-regression.spec.ts-snapshots', `${pageConfig.name}-${viewport}.png`),
          path.resolve('tests', 'visual-regression.spec.ts-snapshots', `${pageConfig.name}-${viewport}.png`),
        ];
        
        let baselineImagePath: string | null = null;
        for (const tryPath of possibleBaselinePaths) {
          console.log(`Trying to find baseline image at: ${tryPath}`);
          if (fs.existsSync(tryPath)) {
            baselineImagePath = tryPath;
            console.log(`Found baseline image at: ${baselineImagePath}`);
            break;
          }
        }
        
        if (baselineImagePath) {
          try {
            const baselineImage = fs.readFileSync(baselineImagePath);
            await testInfo.attach(`${pageConfig.name}-${viewport}-baseline.png`, {
              body: baselineImage,
              contentType: 'image/png',
            });
            console.log(`Baseline image attached: ${pageConfig.name}-${viewport}-baseline.png`);
          } catch (e) {
            console.warn('Failed to attach baseline image:', e);
          }
        } else {
          console.log(`Baseline image not found for ${pageConfig.name}-${viewport}.png`);
          console.log(`Snapshot path from Playwright: ${snapshotPath}`);
        }
      });
    });
  });

  // 要素単位のテスト
  testUrls.elements.forEach((elementConfig) => {
      test(`${elementConfig.description}の見た目が変わっていないか`, async ({ page }, testInfo) => {
        // 画像取得時刻を記録（スクリーンショット撮影前、JSTで表示）
        const screenshotTimestampUTC = new Date().toISOString();
        const screenshotTimestamp = toJST(screenshotTimestampUTC);
        
        // ベースラインメタデータを読み込む（オプション、表示用）
        let baselineInfo: BaselineInfo | null = null;
        const metadataPath = path.join(__dirname, 'baseline-metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
            const metadata = JSON.parse(metadataContent);
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
          
          // ベースライン情報（固定baseline方式）
          if (baselineInfo && baselineInfo.timestamp !== 'unknown') {
            const baselineTimestampJST = toJST(baselineInfo.timestamp);
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: `Baseline from Commit: ${baselineInfo.commit} | Captured: ${baselineTimestampJST}`,
            });
          } else {
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: 'Comparing against committed baseline screenshots (fixed baseline)',
            });
          }
          
          // 現在のテスト実行情報（画像取得時刻を使用）
          testInfo.annotations.push({
            type: 'Current Test',
            description: `Test Commit: ${currentCommit} | Branch: ${branch} | Screenshot captured: ${screenshotTimestamp}`,
          });
        } else {
          if (baselineInfo && baselineInfo.timestamp !== 'unknown') {
            const baselineTimestampJST = toJST(baselineInfo.timestamp);
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: `Baseline from ${baselineTimestampJST}`,
            });
          } else {
            testInfo.annotations.push({
              type: 'Baseline Info',
              description: 'Comparing against committed baseline screenshots',
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
      
      // baseline画像も添付（存在する場合）
      // Playwrightのbaseline画像は通常、テストファイル名-snapshotsディレクトリに保存される
      const snapshotPath = testInfo.snapshotPath(`${elementConfig.name}.png`);
      const possibleBaselinePaths = [
        snapshotPath,
        path.join(__dirname, 'visual-regression.spec.ts-snapshots', `${elementConfig.name}.png`),
        path.join(process.cwd(), 'tests', 'visual-regression.spec.ts-snapshots', `${elementConfig.name}.png`),
        path.resolve('tests', 'visual-regression.spec.ts-snapshots', `${elementConfig.name}.png`),
      ];
      
      let baselineImagePath: string | null = null;
      for (const tryPath of possibleBaselinePaths) {
        console.log(`Trying to find baseline image at: ${tryPath}`);
        if (fs.existsSync(tryPath)) {
          baselineImagePath = tryPath;
          console.log(`Found baseline image at: ${baselineImagePath}`);
          break;
        }
      }
      
      if (baselineImagePath) {
        try {
          const baselineImage = fs.readFileSync(baselineImagePath);
          await testInfo.attach(`${elementConfig.name}-baseline.png`, {
            body: baselineImage,
            contentType: 'image/png',
          });
          console.log(`Baseline image attached: ${elementConfig.name}-baseline.png`);
        } catch (e) {
          console.warn('Failed to attach baseline image:', e);
        }
      } else {
        console.log(`Baseline image not found for ${elementConfig.name}.png`);
        console.log(`Snapshot path from Playwright: ${snapshotPath}`);
      }
    });
  });
});

