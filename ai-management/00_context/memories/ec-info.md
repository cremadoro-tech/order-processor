# EC・商品情報 & 売上データ管理

## 2026/03/05

### EC売上データ取得パイプライン実装・修正完了

#### 【EC チャネル統合】

| チャネル | データ取得方法 | 最新売上（2026-03-04） | 状態 |
|:--------|:------------|:------------|:-----|
| Shopify | API直接接続 | ¥15,548 (8件) | ✅ 稼働中 |
| 楽天 | RMS データツール（月次データ） | ¥9,692,185 | ✅ 稼働中 |
| Yahoo! | ストアクリエイターPro | ¥814,052 | ✅ **修正完了** |
| ギフトモール | GoQ システム経由 | ¥195,626 | ✅ 稼働中 |
| Qoo10 | GoQ システム経由 | ¥409,445 | ✅ 稼働中 |
| auPAY | GoQ システム経由 | ¥61,015 | ✅ 稼働中 |

#### 【Yahoo! スクレイパー修正内容】
- **修正前**: ¥79,921（誤った値）
- **修正後**: ¥814,052（正確な値）
- **原因**: CSV列の自動判定でキーワード部分一致が「PC売上合計値」に先にマッチしていた
- **対策**: キーワード検索を最も詳細な順序に変更（`colStrict()` 関数で順序付けて検索）
- **詳細**: 【決定6】を参照

#### 【Google Sheets 統合】
- スプレッドシートID: `1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw`
- OAuth認証: `scripts/.cookies/google-token.json` に保存
- 自動書き込みシート:
  - 日次データ（全チャネル合算）
  - 楽天（詳細データ）
  - Yahoo!（詳細データ）
  - Amazon（詳細データ）
  - GM（GoQサブチャネル統計）

#### 【データ取得スクリプト実行コマンド】
```bash
# 前日データ取得
cd /Users/emizukami/My\ WorkSpace/ai-management
node scripts/ec/index.js

# 指定日取得
node scripts/ec/index.js 2026-03-02

# 特定サイトのみ
node scripts/ec/index.js --sites rakuten,amazon

# Sheets書き込みをスキップ（テスト用）
node scripts/ec/index.js --no-sheets
```

#### 【Slack日報送信】
```bash
# テストモード（投稿しない）
node scripts/slack-daily-report.mjs --no-post

# 指定日で投稿
node scripts/slack-daily-report.mjs 2026-03-02

# 前日分を投稿（デフォルト）
node scripts/slack-daily-report.mjs
```

#### 【ログイン情報保存先】
- Shopify: `.env` に `SHOPIFY_STORE_URL`, `SHOPIFY_API_KEY`
- Amazon: `scripts/.cookies/profile-amazon/`, `.cookies/amazon.json`
- 楽天: `scripts/.cookies/profile-rakuten/`, `.cookies/rakuten.json`
- Yahoo: `scripts/.cookies/profile-yahoo/`, `.cookies/yahoo.json`
- GoQ: `scripts/.cookies/profile-goq/`, `.cookies/goq.json`
- Google: `scripts/.cookies/google-token.json`
