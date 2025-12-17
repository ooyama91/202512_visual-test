# MedicalDOC E2E Visual Regression Test

MedicalDOCのE2Eテスト（Visual Regression Test）を実行するプロジェクトです。

## 概要

このプロジェクトは、Playwrightを使用してMedicalDOCアプリケーションの視覚的回帰テストを自動実行します。

- BacklogのwebhookをトリガーとしてGitHub Actionsでテストを実行
- テスト結果をGitHub Pagesに公開
- Slackにテスト結果を通知

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Playwrightブラウザのインストール

```bash
npx playwright install --with-deps
```

### 3. テスト対象URLの設定

#### 3-1. ベースURLの設定

`config/base-url.json`を編集して、テスト対象のベースURLを設定してください。

```json
{
  "baseUrl": "https://example.com"
}
```

#### 3-2. テスト対象ページの設定

`config/visual-test-urls.json`を編集して、テスト対象のURLを設定してください。

```json
{
  "pages": [
    {
      "path": "/",
      "name": "top-page",
      "description": "トップページ",
      "viewport": ["desktop", "tablet", "mobile"]
    }
  ]
}
```

### 4. GitHub Secretsの設定（オプション）

Slack通知を使用する場合のみ、GitHubリポジトリ（ooyama91/202512_visual-test）のSettings > Secrets and variables > Actionsで以下を設定：

- `SLACK_WEBHOOK_URL`: Slack通知用のWebhook URL

**注意**: `GITHUB_TOKEN`は自動的に提供されるため、設定不要です。

### 5. GitHub Pagesの設定（オプション）

**注意**: 無料プランでは、プライベートリポジトリではGitHub Pagesは利用できません。

#### テスト結果の確認方法

1. **Artifactsから確認（推奨）**
   - GitHub Actionsのワークフロー実行ページから「Artifacts」セクションを確認
   - `playwright-report-{ブランチ名}`をダウンロード
   - ダウンロードしたフォルダ内の`index.html`をブラウザで開く

2. **GitHub Pagesから確認（オプション）**
   - パブリックリポジトリの場合: Settings > Pagesで「Source: GitHub Actions」を選択
   - プライベートリポジトリの場合: GitHub Pro以上が必要
   - またはリポジトリをパブリックにする（無料で利用可能）

GitHub Pagesが利用できない場合でも、ワークフローは正常に動作し、テスト結果はGitHub ActionsのArtifactsからダウンロードできます。

## ローカルでのテスト実行

### テストを実行

```bash
npm test
```

### Visual Regression Testのみ実行

```bash
npm run test:visual
```

### ベースラインスクリーンショットを更新

```bash
npm run test:update
```

### Visual Regression Testのベースラインを更新

```bash
npm run test:visual:update
```

### テストレポートを表示

```bash
npm run report
```

## テストの追加方法

`config/visual-test-urls.json`に新しいページや要素を追加するだけで、自動的にテストが生成されます。

### ページ全体のテストを追加

```json
{
  "path": "/new-page",
  "name": "new-page",
  "description": "新しいページ",
  "viewport": ["desktop"]
}
```

### 特定要素のテストを追加

```json
{
  "path": "/",
  "selector": ".new-component",
  "name": "new-component",
  "description": "新しいコンポーネント"
}
```

## ワークフローのトリガー

### Cloudflare Workersから実行

Cloudflare Workersのエンドポイントにアクセスすることで、テストを実行できます。

**エンドポイントURL:**
```
https://202512visual-test.account-047.workers.dev/run-test
```

**実行方法:**
- **ブラウザから**: 上記URLをブラウザで開く（GETリクエスト）
- **curlから**: `curl https://202512visual-test.account-047.workers.dev/run-test`
- **Backlogのwebhookから**: Backlogのwebhook設定で上記URLを送信先に指定

**注意**: `/run-test` 以外のパス（例: `/` や `/favicon.ico`）にアクセスしてもテストは実行されません。

### Backlogのwebhookから

Backlogのwebhookを設定して、GitHub APIの`repository_dispatch`イベントをトリガーします。

```bash
curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/dispatches \
  -d '{
    "event_type": "backlog-push",
    "client_payload": {
      "branch": "develop"
    }
  }'
```

**推奨**: Backlogのwebhook送信先は、Cloudflare Workersの `/run-test` エンドポイントを指定してください。

### 手動実行

GitHub ActionsのUIから手動でワークフローを実行することもできます。

## ファイル構成

```
.
├── .github/
│   └── workflows/
│       └── e2e-test.yml          # GitHub Actionsワークフロー
├── config/
│   └── visual-test-urls.json    # テスト対象URLリスト
├── tests/
│   └── visual-regression.spec.ts # Visual Regression Test
├── playwright.config.ts          # Playwright設定
├── package.json                  # 依存関係
└── README.md                     # このファイル
```

## 詳細

詳細な実装方法については、`global-readme.md`を参照してください。

