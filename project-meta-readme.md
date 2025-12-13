# 目的
MedicalDOCのE2Eテストを行う


# 詳細
- まずは見た目のテストから
- ある箇所で加えた変更が、意図せず他の箇所に影響を与えていないかを主に確認したい
- 最終的にはブランチごとにテストをとりたいが、
  - developがマージされたタイミングでデモ環境のテストを行う
  - mainがマージされたら本番環境のテストを行う
- まずはシンプルなテストを行う
- github pagesにテスト結果を表示する
- ビジュアルテストを行うURLのリストは別ファイルで管理し、更新しやすくする
- slackにテストが終わったこと・github pagesにテスト結果が公開されたことを通知する

# 検討中のこと

## 5. GitHub Pagesにテスト結果を表示する
### 実現可能性: ⭐⭐⭐⭐⭐ (非常に高)

### 概要
Playwrightのテスト結果レポートをGitHub Pagesに公開し、ブラウザからアクセス可能な形でテスト結果を確認できるようにする。

### 実装方法

#### 5-1. GitHub Pagesの有効化
1. GitHubリポジトリの「Settings」→「Pages」にアクセス
2. 「Source」で「GitHub Actions」を選択
3. これにより、GitHub Actionsから直接GitHub Pagesにデプロイ可能になる

#### 5-2. Playwrightレポートの生成と公開
`.github/workflows/e2e-test.yml`に以下を追加：

```yaml
      - name: Generate Playwright HTML Report
        if: always()
        run: npx playwright show-report --host 0.0.0.0 || true

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: playwright-report/

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 5-3. 詳細な実装例（環境別レポート）
環境（demo/production）ごとにレポートを分けて管理する場合：

```yaml
      - name: Prepare report directory
        if: always()
        run: |
          ENV="${{ steps.env.outputs.ENV }}"
          BRANCH="${{ github.event.client_payload.branch }}"
          mkdir -p gh-pages-report
          cp -r playwright-report/* gh-pages-report/ || true
          
          # 環境情報を記録
          echo "{\"env\": \"$ENV\", \"branch\": \"$BRANCH\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"run_id\": \"${{ github.run_id }}\"}" > gh-pages-report/metadata.json

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: gh-pages-report/

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 5-4. レポートの履歴管理
複数のテスト実行結果を履歴として保持する場合：

```yaml
      - name: Checkout pages branch
        uses: actions/checkout@v4
        with:
          ref: gh-pages
          fetch-depth: 0

      - name: Save report with timestamp
        if: always()
        run: |
          ENV="${{ steps.env.outputs.ENV }}"
          BRANCH="${{ github.event.client_payload.branch }}"
          TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
          REPORT_DIR="reports/${ENV}/${BRANCH}/${TIMESTAMP}"
          
          mkdir -p "$REPORT_DIR"
          cp -r playwright-report/* "$REPORT_DIR/" || true
          
          # 最新レポートへのシンボリックリンクまたはindex.htmlの更新
          echo "<!DOCTYPE html><html><head><meta http-equiv='refresh' content='0; url=${REPORT_DIR}/index.html'></head></html>" > "reports/${ENV}/${BRANCH}/latest.html"

      - name: Commit and push reports
        if: always()
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add reports/
          git commit -m "Update test reports: ${{ steps.env.outputs.ENV }} - ${{ github.run_id }}" || exit 0
          git push
```

#### 5-5. カスタムレポートページの作成
テスト結果のサマリーを表示するカスタムHTMLページ：

```html
<!-- reports/index.html -->
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>E2Eテスト結果一覧</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .report-link { display: block; margin: 10px 0; padding: 10px; background: #f0f0f0; }
        .success { border-left: 4px solid #28a745; }
        .failure { border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <h1>E2Eテスト結果一覧</h1>
    <div id="reports"></div>
    <script>
        // 最新のテスト結果を表示
        fetch('metadata.json')
            .then(res => res.json())
            .then(data => {
                document.getElementById('reports').innerHTML = `
                    <div class="report-link ${data.status === 'success' ? 'success' : 'failure'}">
                        <h3>${data.env}環境 - ${data.branch}ブランチ</h3>
                        <p>実行日時: ${data.timestamp}</p>
                        <p>Run ID: ${data.run_id}</p>
                        <a href="index.html">詳細レポートを見る</a>
                    </div>
                `;
            });
    </script>
</body>
</html>
```

#### 5-6. アクセス制限（オプション）
GitHub Pagesは公開されるため、必要に応じて：
- プライベートリポジトリを使用（GitHub Pagesもプライベートになる）
- または、認証が必要な別のホスティングサービスを検討

### 必要な設定・ツール
- GitHubリポジトリの「Pages」設定権限
- GitHub Actionsの`pages:write`権限（自動で付与される）
- PlaywrightのHTMLレポート生成機能

### 制約事項
- GitHub Pagesは公開リポジトリでは誰でもアクセス可能
- プライベートリポジトリでも、GitHub Pagesは有料プランが必要な場合がある
- レポートファイルサイズに制限がある（推奨: 1GB以下）
- デプロイには数分かかる場合がある

### メリット
- ブラウザから簡単にテスト結果を確認できる
- テスト結果の履歴を保持できる
- チームメンバーと結果を共有しやすい
- スクリーンショットや動画も含めて確認可能

---

## 1. webhookをトリガーにする
### 実現可能性: ⭐⭐⭐⭐ (高)

### 概要
Backlog Gitリポジトリのプッシュイベントをwebhookで検知し、GitHub Actionsのワークフローをトリガーする。

### 実装方法

#### 1-1. Backlog側のwebhook設定
1. BacklogプロジェクトのGitリポジトリ設定画面にアクセス
2. 「Webhook」セクションで新しいwebhookを追加
3. 送信先URLを設定（後述の中間サービスまたはGitHub Actions用エンドポイント）
4. イベントタイプを選択：
   - `push` イベント（develop/mainブランチのプッシュを検知）

#### 1-2. GitHub Actionsへの連携方法
Backlogのwebhookを直接GitHub Actionsに送ることはできないため、以下のいずれかの方法を採用：

**方法A: 中間サービス経由（安定）**
- Backlog → 中間サービス（サーバーレス関数等）→ GitHub `repository_dispatch` API
- 中間サービスでwebhookペイロードを変換し、GitHub APIを呼び出し

**方法B: GitHub Actionsの`repository_dispatch`イベントを利用（まずは試したい）**
- よりシンプルな実装で、まずはこの方法を試す
- GitHub APIを直接呼び出すことで、中間サービスを不要にする
```yaml
# .github/workflows/e2e-test.yml
on:
  repository_dispatch:
    types: [backlog-push]
```

**方法C: 代替案 - GitHubリポジトリをミラー**
- BacklogリポジトリをGitHubにミラーリング
- GitHub側で`push`イベントを直接トリガーとして使用

#### 1-3. 中間サービス実装例（方法A）
```javascript
// サーバーレス関数（例: Vercel/Netlify Functions）
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ref, repository } = req.body;
  const branch = ref.replace('refs/heads/', '');

  // develop/mainブランチのみ処理
  if (branch !== 'develop' && branch !== 'main') {
    return res.status(200).json({ message: 'Branch ignored' });
  }

  // GitHub repository_dispatch APIを呼び出し
  const response = await fetch(
    `https://api.github.com/repos/OWNER/REPO/dispatches`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'backlog-push',
        client_payload: {
          branch: branch,
          repository: repository.name,
        },
      }),
    }
  );

  return res.status(200).json({ success: true });
}
```

#### 1-4. セキュリティ考慮事項
- **Webhook署名検証**: Backlogのwebhook署名を検証してリクエストの正当性を確認
- **GitHub Token管理**: Personal Access TokenまたはGitHub App TokenをSecretsで管理
- **IP制限**: 中間サービスのIPアドレス制限を設定（可能な場合）

### 必要な設定・ツール
- Backlog Gitリポジトリのwebhook設定権限
- GitHub Personal Access Token（`repo`スコープ）
- 中間サービス（Vercel/Netlify Functions、AWS Lambda等）

### 制約事項
- Backlogのwebhookは直接GitHub Actionsをトリガーできない
- 中間サービスが必要（またはGitHubリポジトリへのミラーリング）

---

## 2. メインのリモートリポジトリは Backlog
### 実現可能性: ⭐⭐⭐⭐⭐ (非常に高)

### 概要
Backlog Gitリポジトリをメインリポジトリとして使用し、GitHub Actionsからアクセスする。

### 実装方法

#### 2-1. Backlog Gitリポジトリの確認
- リポジトリURL形式: `https://[スペース名].backlog.jp/git/[プロジェクトキー]/[リポジトリ名].git`
- SSH URL形式: `git@[スペース名].backlog.jp:[プロジェクトキー]/[リポジトリ名].git`

#### 2-2. GitHub Actionsからのアクセス方法

**方法A: HTTPS認証（APIキー使用）**
```yaml
- name: Checkout Backlog repository
  uses: actions/checkout@v4
  with:
    repository: 'https://[スペース名].backlog.jp/git/[プロジェクトキー]/[リポジトリ名].git'
    ref: ${{ github.event.client_payload.branch }}
    token: ${{ secrets.BACKLOG_API_KEY }}
```

**方法B: SSH認証（推奨）**
```yaml
- name: Setup SSH
  uses: webfactory/ssh-agent@v0.9.0
  with:
    ssh-private-key: ${{ secrets.BACKLOG_SSH_PRIVATE_KEY }}

- name: Checkout Backlog repository
  uses: actions/checkout@v4
  with:
    repository: 'git@[スペース名].backlog.jp:[プロジェクトキー]/[リポジトリ名].git'
    ref: ${{ github.event.client_payload.branch }}
```

#### 2-3. 認証情報の管理
1. **GitHub Secretsに追加**:
   - `BACKLOG_API_KEY`: Backlog APIキー（HTTPS用）
   - `BACKLOG_SSH_PRIVATE_KEY`: SSH秘密鍵（SSH用）
   - `BACKLOG_SSH_PUBLIC_KEY`: SSH公開鍵（Backlogに登録）

2. **SSH鍵の生成と登録**:
   ```bash
   # SSH鍵ペアを生成
   ssh-keygen -t ed25519 -C "github-actions@example.com" -f backlog_key
   
   # 公開鍵をBacklogのSSH鍵設定に登録
   # 秘密鍵をGitHub Secretsに登録
   ```

#### 2-4. ブランチ戦略の確認
- **developブランチ**: デモ環境向け
- **mainブランチ**: 本番環境向け
- webhookペイロードからブランチ名を取得し、適切な環境でテストを実行

### 必要な設定・ツール
- Backlog Gitリポジトリへのアクセス権限
- Backlog APIキーまたはSSH鍵
- GitHub Secretsでの認証情報管理

### 制約事項
- GitHub ActionsからBacklogリポジトリへの直接アクセスには認証が必要
- リポジトリURLはBacklogの形式に従う必要がある

---

## 3. Github Actionsでテストを行う
### 実現可能性: ⭐⭐⭐⭐⭐ (非常に高)

### 概要
Playwrightを使用してE2Eテストを実行し、ブランチに応じてデモ/本番環境でテストする。

### 実装方法

#### 3-1. E2Eテストフレームワークの選定
**推奨: Playwright**
- モダンなE2Eテストフレームワーク
- 複数ブラウザ対応（Chromium, Firefox, WebKit）
- 自動待機機能
- スクリーンショット・動画記録機能

#### 3-2. ワークフローファイルの作成
`.github/workflows/e2e-test.yml`:

```yaml
name: E2E Tests

on:
  repository_dispatch:
    types: [backlog-push]

jobs:
  e2e-test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout Backlog repository
        uses: actions/checkout@v4
        with:
          repository: 'git@[スペース名].backlog.jp:[プロジェクトキー]/[リポジトリ名].git'
          ref: ${{ github.event.client_payload.branch }}
          ssh-key: ${{ secrets.BACKLOG_SSH_PRIVATE_KEY }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Determine test environment
        id: env
        run: |
          BRANCH="${{ github.event.client_payload.branch }}"
          if [ "$BRANCH" = "main" ]; then
            echo "ENV=production" >> $GITHUB_OUTPUT
            echo "BASE_URL=${{ secrets.PRODUCTION_URL }}" >> $GITHUB_OUTPUT
          else
            echo "ENV=demo" >> $GITHUB_OUTPUT
            echo "BASE_URL=${{ secrets.DEMO_URL }}" >> $GITHUB_OUTPUT
          fi

      - name: Run Playwright tests
        env:
          BASE_URL: ${{ steps.env.outputs.BASE_URL }}
          TEST_ENV: ${{ steps.env.outputs.ENV }}
        run: npx playwright test
        continue-on-error: false

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-${{ steps.env.outputs.ENV }}
          path: |
            playwright-report/
            test-results/
          retention-days: 30

      - name: Upload test videos
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-videos-${{ steps.env.outputs.ENV }}
          path: test-results/
          retention-days: 7

      - name: Set test result status
        id: test-result
        if: always()
        run: |
          if [ "${{ job.status }}" = "success" ]; then
            echo "status=success" >> $GITHUB_OUTPUT
            echo "message=E2Eテストが成功しました" >> $GITHUB_OUTPUT
          else
            echo "status=failure" >> $GITHUB_OUTPUT
            echo "message=E2Eテストが失敗しました" >> $GITHUB_OUTPUT
          fi
```

#### 3-3. テスト環境変数の設定
GitHub Secretsに以下を設定：
- `DEMO_URL`: デモ環境のベースURL
- `PRODUCTION_URL`: 本番環境のベースURL
- その他テストに必要な認証情報等

#### 3-4. テスト実行の条件分岐
- `develop`ブランチ → デモ環境（`DEMO_URL`）でテスト
- `main`ブランチ → 本番環境（`PRODUCTION_URL`）でテスト
- その他のブランチ → スキップ（または任意の処理）

#### 3-5. テスト結果の保存・可視化
- **Artifacts**: テストレポートとスクリーンショットを保存
- **GitHub Actions UI**: ワークフロー実行結果を確認
- **Slack通知**: テスト結果をSlackに通知（次項参照）

### 必要な設定・ツール
- Playwrightのインストールと設定
- テスト環境のURL設定
- GitHub Secretsでの環境変数管理

### 制約事項
- テスト実行時間に応じたタイムアウト設定が必要
- ブラウザのインストールに時間がかかる場合がある

---

## 3-6. PlaywrightのVisual Regression Test（視覚的回帰テスト）
### 実現可能性: ⭐⭐⭐⭐⭐ (非常に高)

### 概要
PlaywrightのVisual Regression Test機能を使用して、スクリーンショットを比較することで、意図しない見た目の変更を検出する。ある箇所で加えた変更が、意図せず他の箇所に影響を与えていないかを主に確認する。

### 実装方法

#### 3-6-1. PlaywrightのVisual Comparison機能の設定
`playwright.config.ts`にVisual Comparisonの設定を追加：

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
```

#### 3-6-2. テスト対象URLリストの管理
ビジュアルテストを行うURLのリストを別ファイルで管理し、更新しやすくする：

**URLリストファイルの作成** (`config/visual-test-urls.json`):
```json
{
  "pages": [
    {
      "path": "/",
      "name": "top-page",
      "description": "トップページ",
      "viewport": ["desktop", "tablet", "mobile"]
    },
    {
      "path": "/login",
      "name": "login-page",
      "description": "ログインページ",
      "viewport": ["desktop"]
    },
    {
      "path": "/dashboard",
      "name": "dashboard",
      "description": "ダッシュボード",
      "viewport": ["desktop", "tablet"],
      "mask": [".timestamp", ".user-name"]
    },
    {
      "path": "/settings",
      "name": "settings-page",
      "description": "設定ページ",
      "viewport": ["desktop"]
    }
  ],
  "elements": [
    {
      "path": "/",
      "selector": "header",
      "name": "header",
      "description": "ヘッダー要素"
    },
    {
      "path": "/",
      "selector": "footer",
      "name": "footer",
      "description": "フッター要素"
    }
  ]
}
```

**URLリストを読み込むテスト実装**:
```typescript
// tests/visual-regression.spec.ts
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
```

#### 3-6-3. Visual Regression Testの実装例（従来の方法）
URLリストを使わない従来の実装方法：

```typescript
// tests/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('トップページの見た目が変わっていないか', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // ページ全体のスクリーンショットを取得・比較
    await expect(page).toHaveScreenshot('top-page.png');
  });

  test('ログインページの見た目が変わっていないか', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('login-page.png');
  });

  test('特定の要素の見た目が変わっていないか', async ({ page }) => {
    await page.goto('/');
    
    // 特定の要素のみをスクリーンショット
    const header = page.locator('header');
    await expect(header).toHaveScreenshot('header.png');
    
    const footer = page.locator('footer');
    await expect(footer).toHaveScreenshot('footer.png');
  });

  test('レスポンシブデザインの確認', async ({ page }) => {
    // モバイルビュー
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page).toHaveScreenshot('top-page-mobile.png');
    
    // タブレットビュー
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page).toHaveScreenshot('top-page-tablet.png');
    
    // デスクトップビュー
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page).toHaveScreenshot('top-page-desktop.png');
  });

  test('動的コンテンツのマスク処理', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 日付や時刻など動的に変わる要素をマスク
    await page.locator('.timestamp').evaluate(el => {
      el.style.visibility = 'hidden';
    });
    
    // ユーザー名など個人情報をマスク
    await page.locator('.user-name').evaluate(el => {
      el.textContent = '***';
    });
    
    await expect(page).toHaveScreenshot('dashboard.png', {
      mask: [page.locator('.timestamp'), page.locator('.user-name')],
    });
  });
});
```

#### 3-6-4. ベースラインスクリーンショットの管理
初回実行時にベースライン（期待値）を生成：

```bash
# ベースラインスクリーンショットを更新
npx playwright test --update-snapshots

# 特定のテストのみ更新
npx playwright test visual-regression.spec.ts --update-snapshots
```

#### 3-6-5. GitHub ActionsでのVisual Regression Test実行
`.github/workflows/e2e-test.yml`にVisual Regression Testを追加：

```yaml
      - name: Run Visual Regression Tests
        env:
          BASE_URL: ${{ steps.env.outputs.BASE_URL }}
          TEST_ENV: ${{ steps.env.outputs.ENV }}
        run: |
          # ベースラインスクリーンショットを取得（初回のみ、またはmainブランチから）
          if [ "${{ github.event.client_payload.branch }}" = "main" ]; then
            npx playwright test --grep "Visual Regression" --update-snapshots
          else
            # developブランチでは比較のみ実行
            npx playwright test --grep "Visual Regression"
          fi

      - name: Upload visual comparison results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: visual-comparison-${{ steps.env.outputs.ENV }}
          path: |
            test-results/
            playwright-report/
          retention-days: 30
```

#### 3-6-6. 差分検出時の処理
Visual Regression Testで差分が検出された場合の処理：

```yaml
      - name: Check visual regression results
        id: visual-check
        if: always()
        run: |
          # 差分が検出されたか確認
          if [ -d "test-results" ] && find test-results -name "*-diff.png" | grep -q .; then
            echo "has_diff=true" >> $GITHUB_OUTPUT
            echo "Visual regression detected!" >&2
          else
            echo "has_diff=false" >> $GITHUB_OUTPUT
          fi

      - name: Comment PR with visual diff (if applicable)
        if: steps.visual-check.outputs.has_diff == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const path = require('path');
            
            // 差分画像を探す
            const diffImages = [];
            function findDiffImages(dir) {
              const files = fs.readdirSync(dir);
              for (const file of files) {
                const filePath = path.join(dir, file);
                if (fs.statSync(filePath).isDirectory()) {
                  findDiffImages(filePath);
                } else if (file.includes('-diff.png')) {
                  diffImages.push(filePath);
                }
              }
            }
            findDiffImages('test-results');
            
            // PRにコメント（PRがある場合）
            if (diffImages.length > 0) {
              let comment = '## 🎨 Visual Regression Test で差分が検出されました\n\n';
              comment += `検出された差分: ${diffImages.length}件\n\n`;
              comment += '詳細はGitHub ActionsのArtifactsを確認してください。\n';
              comment += '意図的な変更の場合は、ベースラインを更新してください: `npx playwright test --update-snapshots`';
              
              // ここでPRコメントを追加（必要に応じて）
            }
```

#### 3-6-7. ベースラインの管理戦略
環境やブランチごとのベースライン管理：

```yaml
      - name: Setup baseline screenshots
        run: |
          ENV="${{ steps.env.outputs.ENV }}"
          BRANCH="${{ github.event.client_payload.branch }}"
          
          # mainブランチからベースラインを取得
          if [ "$BRANCH" = "main" ]; then
            # mainブランチのスクリーンショットをベースラインとして保存
            mkdir -p baseline-screenshots/main
            cp -r test-results/* baseline-screenshots/main/ || true
          else
            # developブランチではmainブランチのベースラインと比較
            # （GitHub ActionsのArtifactsから取得、またはリポジトリに保存）
            echo "Comparing against main branch baseline"
          fi
```

#### 3-6-8. 高度な設定: カスタム比較オプション
より細かい制御が必要な場合：

```typescript
// 特定の領域のみを比較
await expect(page).toHaveScreenshot('page.png', {
  clip: { x: 0, y: 0, width: 1920, height: 1080 },
});

// ピクセル単位の比較（より厳密）
await expect(page).toHaveScreenshot('page.png', {
  threshold: 0.1, // 10%の差分まで許容
  maxDiffPixels: 100, // 最大100ピクセルの差分まで許容
});

// アニメーションを無視
await expect(page).toHaveScreenshot('page.png', {
  animations: 'disabled',
});

// 特定の要素をマスク（比較対象から除外）
await expect(page).toHaveScreenshot('page.png', {
  mask: [
    page.locator('.dynamic-content'),
    page.locator('.timestamp'),
  ],
});
```

### 必要な設定・ツール
- PlaywrightのVisual Comparison機能
- ベースラインスクリーンショットの保存場所（リポジトリまたはArtifacts）
- スクリーンショット比較用の十分なストレージ容量

### 制約事項
- ベースラインスクリーンショットの管理が必要
- 環境やブラウザの違いによる誤検知の可能性
- 動的コンテンツ（日付、時刻、ランダム要素）のマスク処理が必要
- スクリーンショットファイルのサイズが大きくなる可能性
- フォントレンダリングの違いによる差分検出の可能性

### メリット
- 意図しない見た目の変更を自動検出
- 複数のページや要素を一括で確認可能
- レスポンシブデザインの確認が容易
- スクリーンショット比較により、変更内容を視覚的に確認可能
- CI/CDパイプラインに組み込むことで、早期に問題を発見

### ベストプラクティス
- **ベースラインの管理**: mainブランチのスクリーンショットをベースラインとして管理
- **マスク処理**: 動的コンテンツは適切にマスクして比較の精度を向上
- **閾値の調整**: プロジェクトに応じて適切な差分閾値を設定
- **定期的な更新**: 意図的なデザイン変更時はベースラインを更新
- **環境の統一**: CI環境とローカル環境で同じブラウザバージョンを使用

---

## 4. Slackにテスト結果を通知する
### 実現可能性: ⭐⭐⭐⭐⭐ (非常に高)

### 概要
E2Eテストの実行結果（成功/失敗）をSlackチャンネルに通知する。

### 実装方法

#### 4-1. Slack Incoming Webhookの設定
1. [Slack API](https://api.slack.com/apps)にアクセス
2. 「Create New App」→「From scratch」を選択
3. アプリ名とワークスペースを選択
4. 「Incoming Webhooks」を有効化
5. 「Add New Webhook to Workspace」をクリック
6. 通知先チャンネルを選択
7. Webhook URLをコピー

#### 4-2. GitHub Secretsへの登録
- `SLACK_WEBHOOK_URL`: 取得したWebhook URLを登録

#### 4-3. ワークフローへの通知ステップ追加
`.github/workflows/e2e-test.yml`に以下を追加：

```yaml
      - name: Send Slack notification
        if: always()
        uses: rtCamp/action-slack-notify@v2
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_CHANNEL: '#e2e-test-results'  # オプション
          SLACK_USERNAME: 'GitHub Actions'
          SLACK_ICON_EMOJI: ':robot_face:'
        with:
          status: ${{ job.status }}
          text: |
            E2Eテスト結果通知
            
            *ブランチ*: ${{ github.event.client_payload.branch }}
            *環境*: ${{ steps.env.outputs.ENV }}
            *ステータス*: ${{ steps.test-result.outputs.status }}
            *メッセージ*: ${{ steps.test-result.outputs.message }}
            
            ${{ steps.test-result.outputs.status == 'success' && '✅ テスト成功' || '❌ テスト失敗' }}
          fields: |
            [
              {"title": "ブランチ", "value": "${{ github.event.client_payload.branch }}", "short": true},
              {"title": "環境", "value": "${{ steps.env.outputs.ENV }}", "short": true},
              {"title": "ステータス", "value": "${{ steps.test-result.outputs.status }}", "short": true},
              {"title": "実行時間", "value": "${{ job.duration }}", "short": true}
            ]
```

#### 4-4. カスタム通知実装（より詳細な通知）
より詳細な通知が必要な場合、カスタムステップを実装：

```yaml
      - name: Send detailed Slack notification
        if: always()
        run: |
          BRANCH="${{ github.event.client_payload.branch }}"
          ENV="${{ steps.env.outputs.ENV }}"
          STATUS="${{ job.status }}"
          WORKFLOW_URL="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          
          if [ "$STATUS" = "success" ]; then
            COLOR="good"
            EMOJI="✅"
            MESSAGE="E2Eテストが成功しました"
          else
            COLOR="danger"
            EMOJI="❌"
            MESSAGE="E2Eテストが失敗しました"
          fi
          
          curl -X POST -H 'Content-type: application/json' \
            --data "{
              \"attachments\": [{
                \"color\": \"$COLOR\",
                \"title\": \"$EMOJI $MESSAGE\",
                \"fields\": [
                  {\"title\": \"ブランチ\", \"value\": \"$BRANCH\", \"short\": true},
                  {\"title\": \"環境\", \"value\": \"$ENV\", \"short\": true},
                  {\"title\": \"ワークフロー\", \"value\": \"<$WORKFLOW_URL|詳細を確認>\", \"short\": false}
                ],
                \"footer\": \"GitHub Actions\",
                \"ts\": $(date +%s)
              }]
            }" \
            ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### 4-5. エラー時の詳細通知
テスト失敗時に詳細情報を含める：

```yaml
      - name: Send failure details
        if: failure()
        run: |
          # テストレポートから失敗情報を抽出
          FAILED_TESTS=$(find test-results -name "*.txt" -exec cat {} \; | grep -i "failed" || echo "詳細はレポートを確認してください")
          
          curl -X POST -H 'Content-type: application/json' \
            --data "{
              \"text\": \"❌ E2Eテスト失敗の詳細\",
              \"attachments\": [{
                \"color\": \"danger\",
                \"text\": \"$FAILED_TESTS\",
                \"footer\": \"GitHub Actions\"
              }]
            }" \
            ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 必要な設定・ツール
- Slackワークスペースへのアクセス権限
- Slack Incoming Webhook URL
- GitHub SecretsでのWebhook URL管理

### 制約事項
- Webhook URLは機密情報として適切に管理する必要がある
- Slack APIのレート制限に注意

---

## 実装手順のまとめ

### ステップ1: 環境準備
1. Backlog Gitリポジトリの確認
2. GitHubリポジトリの作成（ワークフロー用）
3. Slack Incoming Webhookの作成

### ステップ2: 認証情報の設定
1. Backlog APIキー/SSH鍵の生成
2. GitHub Secretsへの登録
3. Slack Webhook URLの登録

### ステップ3: 中間サービスの構築（webhook連携用）
1. サーバーレス関数の作成
2. Backlog webhookの設定
3. GitHub `repository_dispatch` APIの呼び出し実装

### ステップ4: GitHub Actionsワークフローの作成
1. `.github/workflows/e2e-test.yml`の作成
2. Playwrightの設定
3. 環境変数の設定

### ステップ5: テストと検証
1. developブランチへのプッシュでテスト
2. mainブランチへのプッシュでテスト
3. Slack通知の確認

---

## 参考リソース

### 公式ドキュメント
- [Backlog Git Webhook](https://support.backlog.com/hc/ja/articles/115015385567-Git-Webhook)
- [GitHub Actions Documentation](https://docs.github.com/ja/actions)
- [Playwright Documentation](https://playwright.dev/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)

### 関連ツール
- [rtCamp/action-slack-notify](https://github.com/rtCamp/action-slack-notify)
- [actions/checkout](https://github.com/actions/checkout)
- [actions/setup-node](https://github.com/actions/setup-node)

---

## 課題・リスク

### 想定される問題点
1. **Webhook連携の複雑さ**: BacklogからGitHub Actionsへの直接連携ができない
2. **認証情報の管理**: 複数の認証情報（Backlog、GitHub、Slack）を適切に管理する必要がある
3. **テスト実行時間**: E2Eテストの実行時間が長くなる可能性

### 代替案
1. **GitHubリポジトリへのミラーリング**: BacklogリポジトリをGitHubにミラーし、直接`push`イベントを使用
2. **別のCI/CDツール**: GitHub Actionsの代わりに、Backlogと直接連携可能なCI/CDツールを検討

### セキュリティ考慮事項
- すべての認証情報はGitHub Secretsで管理
- Webhook URLは機密情報として扱う
- SSH鍵は適切な権限で生成・管理
- 中間サービスでのリクエスト検証を実装
