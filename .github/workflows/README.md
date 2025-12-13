# GitHub Actions ワークフロー

## e2e-test.yml

E2E Visual Regression Testを実行するワークフローです。

### トリガー

- `repository_dispatch` イベント（`backlog-push`タイプ）
  - BacklogのwebhookからGitHub API経由でトリガー
- `workflow_dispatch` イベント
  - 手動実行（テスト用）

### 必要なGitHub Secrets

以下のSecretsをGitHubリポジトリのSettings > Secrets and variables > Actionsに設定してください：

- `BASE_URL`: テスト対象のベースURL（例: `https://example.com`）
- `SLACK_WEBHOOK_URL`: Slack通知用のWebhook URL（オプション）

### 動作

1. GitHubリポジトリ（ooyama91/202512_visual-test）から指定ブランチをチェックアウト
2. Node.jsとPlaywrightのセットアップ
3. Visual Regression Testを実行
   - mainブランチ: ベースラインスクリーンショットを更新
   - その他のブランチ: ベースラインと比較
4. テスト結果をGitHub Pagesに公開
5. Slackにテスト結果とGitHub PagesのURLを通知

### GitHub Pagesの設定

リポジトリのSettings > Pagesで以下を設定してください：

- Source: GitHub Actions

