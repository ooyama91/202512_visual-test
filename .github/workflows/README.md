# GitHub Actions ワークフロー

## e2e-test.yml

E2E Visual Regression Testを実行するワークフローです。

### トリガー

- `repository_dispatch` イベント（`backlog-push`タイプ）
  - BacklogのwebhookからGitHub API経由でトリガー
- `workflow_dispatch` イベント
  - 手動実行（テスト用）

### 必要な設定

#### GitHub Secrets（オプション）

Slack通知を使用する場合のみ、GitHubリポジトリのSettings > Secrets and variables > Actionsに設定：

- `SLACK_WEBHOOK_URL`: Slack通知用のWebhook URL

#### 設定ファイル

- `config/base-url.json`: テスト対象のベースURLを設定
  ```json
  {
    "baseUrl": "https://example.com"
  }
  ```

### 動作

1. GitHubリポジトリ（ooyama91/202512_visual-test）から指定ブランチをチェックアウト
2. Node.jsとPlaywrightのセットアップ
3. `config/base-url.json`からBASE_URLを読み込み
4. Visual Regression Testを実行
   - mainブランチ: ベースラインスクリーンショットを更新
   - その他のブランチ: ベースラインと比較
5. テスト結果をArtifactsとして保存（GitHub ActionsのUIからダウンロード可能）
6. テスト結果をGitHub Pagesに公開（オプション、有効化されている場合のみ）
7. Slackにテスト結果を通知（オプション、設定されている場合のみ）

### テスト結果の確認方法

#### Artifactsから確認（推奨）
- GitHub Actionsのワークフロー実行ページから「Artifacts」セクションを確認
- `playwright-report-{ブランチ名}`をダウンロードして、ローカルで`index.html`を開く

#### GitHub Pagesから確認（オプション）
- プライベートリポジトリの場合、GitHub Pro以上が必要
- またはリポジトリをパブリックにする必要がある
- リポジトリのSettings > Pagesで「Source: GitHub Actions」を設定

