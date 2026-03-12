# /daily-report — EC売上データ取得 + スプレッドシート記録 + Slack日報投稿

## 概要
EC全サイトの売上データを取得してスプレッドシートに書き込み、その後Slackに日報を投稿する一連の流れを実行するまとめスキル。

## 実行手順

### Step 1: ECデータ取得 + スプレッドシート書き込み

```bash
cd /Users/emizukami/My\ WorkSpace/ai-management && node scripts/ec/index.js
```

- 引数なし: 日次データシートの最終日の翌日〜前日まで自動取得（休日の穴埋め対応）
- 日付指定: `node scripts/ec/index.js 2026-03-01`
- 範囲指定: `node scripts/ec/index.js 2026-03-01 2026-03-05`

対象サイト: Shopify, Amazon, 楽天, Yahoo!, GoQ(ギフトモール/Qoo10/auPAY)

重複防止ロジック搭載: 同一日付のデータは既存行を削除してから追記する。

### Step 2: Slack日報投稿

```bash
cd /Users/emizukami/My\ WorkSpace/ai-management && node scripts/slack-daily-report.mjs
```

スプレッドシートから前日データを読み込み、`hs-ec運営` チャンネルに売上日報を投稿する。

## 注意事項

- Step 1でブラウザが開き、手動ログインが必要なサイトがある（Amazon, 楽天, Yahoo!, GoQ）
- ログイン後はクッキーが保存され、次回以降は自動ログインされる
- Step 1が全て完了してからStep 2を実行すること（データがシートに反映されてから投稿する）
- エラーが出た場合はStep 1のログを確認し、必要に応じて個別サイトのみ再実行する

## 前提条件

- `.env` に各ECサイトのログイン情報 + Google OAuth + Slack Bot Token が設定されていること
- `scripts/.cookies/google-token.json` にrefresh_token付きのGoogle認証トークンがあること
- Node.js依存パッケージがインストール済みであること (`npm install` 済み)
