import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright設定ファイル
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60000, // テストタイムアウトを60秒に延長
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 30000, // アクションのタイムアウトを30秒に設定
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Visual Comparison設定
  expect: {
    toHaveScreenshot: {
      // スクリーンショットの比較モード
      mode: 'strict', // 'strict' | 'pixel' | 'css'
      // 許容するピクセル差分の閾値（0-1）
      threshold: 0.2,
      // アニメーションやタイミングによる差分を無視するための設定
      animations: 'disabled',
    },
  },
});

