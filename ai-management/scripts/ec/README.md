# EC 売上データ収集スクリプト

7つのECチャネルから日次売上データを自動取得し、Google Sheetsに書き込むスクリプトです。

## チャネル一覧

| チャネル | ファイル | 取得方法 |
|:--------|:--------|:--------|
| Amazon | `scrapers/amazon.js` | セラーセントラル（Playwright） |
| 楽天 | `scrapers/rakuten.js` | RMS データツール（Playwright） |
| Yahoo! | `scrapers/yahoo.js` | ストアクリエイターPro（Playwright） |
| Shopify | `scrapers/shopify.js` | 管理画面アナリティクス（Playwright） |
| ギフトモール | `scrapers/giftmall.js` | GoQ経由（Playwright） |
| Qoo10 | `scrapers/qoo10.js` | GoQ経由（Playwright） |
| auPAY | `scrapers/aupay.js` | GoQ経由（Playwright） |

> ⚠️ **すべてのサイトで API は不使用です。Playwright によるブラウザ操作のみで取得します。**

---

## セットアップ（初回のみ）

### 1. 依存パッケージのインストール

```bash
cd ai-management/scripts
npm install
npx playwright install chromium
```

### 2. 環境変数の設定

```bash
cp ../../.env.example ../../.env
```

`.env` ファイルを開いて以下を設定します：

```
# Google Sheets
GOOGLE_CLIENT_ID=xxxxx
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_SPREADSHEET_ID=1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw

# Amazon（ログイン用メールアドレス）
AMAZON_SELLER_EMAIL=your@email.com

# Yahoo!（ストアID）
YAHOO_STORE_ID=pro.hankoya-store-7

# Shopify（管理画面URLのストアハンドル）
# admin.shopify.com/store/【ここを設定】/analytics
SHOPIFY_STORE_HANDLE=your-store-handle
```

### 3. Google 認証

```bash
node ec/login-helper.js --google
```

ブラウザが開くので、Google アカウントでログインします。

### 4. EC サイトへのログイン（1回実施するだけ）

```bash
node ec/login-helper.js ec-all
```

各サイトのブラウザが順番に開きます。それぞれ手動でログインして `Enter` を押すと次のサイトへ進みます。

**ログイン情報はプロファイルとして保存される**ため、次回以降は自動ログインされます。

> ⚠️ **セッションが切れた場合は、そのサイト単体で再ログインしてください**
> 例：`node ec/login-helper.js rakuten`

---

## 使い方

### 基本（前日分を全サイト取得）

```bash
cd ai-management/scripts
node ec/index.js
```

### 日付指定

```bash
node ec/index.js 2026-03-04
```

### 日付範囲指定

```bash
node ec/index.js 2026-03-01 2026-03-07
```

### サイト指定

```bash
node ec/index.js --sites rakuten,amazon
node ec/index.js --sites shopify
node ec/index.js 2026-03-04 --sites goq
```

### テスト（Sheets書き込みをスキップ）

```bash
node ec/index.js --no-sheets
```

---

## スプレッドシート構成

| シート名 | 内容 |
|:--------|:-----|
| 日次データ | 日付×サイト別の売上・注文数（全サイト共通） |
| 楽天 | 楽天の詳細データ（アクセス数・転換率・客単価） |
| Yahoo! | Yahoo!の詳細データ |
| Amazon | Amazonの詳細データ（CSVレポートのデータ） |
| GoQ詳細 | ギフトモール・Qoo10・auPAYの詳細データ |

---

## ログインプロファイルの保存場所

`scripts/.cookies/profile-{サイト名}/` に永続プロファイルが保存されます。

```
scripts/
  .cookies/
    google-token.json       ← Google Sheets 認証トークン
    profile-amazon/         ← Amazon ログインセッション
    profile-rakuten/        ← 楽天 ログインセッション
    profile-yahoo/          ← Yahoo! ログインセッション
    profile-shopify/        ← Shopify ログインセッション
    profile-goq/            ← GoQシステム ログインセッション
```

---

## トラブルシューティング

### 「ログインが必要」と毎回表示される

セッションが期限切れです。対象サイトのみ再ログインしてください：

```bash
node ec/login-helper.js [サイト名]
# 例: node ec/login-helper.js amazon
```

### 特定サイトのみ失敗した場合

実行後に表示される再実行コマンドをコピーして実行します：

```bash
# 例（失敗メッセージに表示されるコマンドをそのまま実行）
node ec/index.js 2026-03-04 --sites rakuten
```

### Shopify のデータが取れない

1. `.env` の `SHOPIFY_STORE_HANDLE` が正しいか確認
   （`https://admin.shopify.com/store/【ここ】/analytics`）
2. 再ログイン：`node ec/login-helper.js shopify`
3. ページレイアウトが変更されている場合は、`/tmp/shopify-debug.png` を確認

---

## 自動実行（毎日自動取得）

```bash
# スケジュール登録（毎朝8時に実行）
node ../../scripts/schedule.mjs add "ec-daily" "0 8 * * *" "node scripts/ec/index.js"
```
