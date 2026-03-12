# ECデータ取得スクレイパー

## 概要
7つのECチャネルから日次売上データを取得し、Google Sheetsに書き込むシステム。

## エントリポイント
```bash
node scripts/ec/index.js                    # 未取得日を自動検出・全サイト取得
node scripts/ec/index.js --date 2026-03-04   # 日付指定
node scripts/ec/index.js --sites rakuten,amazon  # サイト指定
node scripts/ec/index.js --no-sheets         # シート書き込みスキップ（テスト用）
```

## チャネル別取得方法

| チャネル | ファイル | 取得方法 |
|:--------|:--------|:--------|
| Shopify | `scrapers/shopify.js` | REST API直接 |
| Amazon | `scrapers/amazon.js` | セラーセントラル（Playwright） |
| 楽天 | `scrapers/rakuten.js` | RMS データツール（Playwright） |
| Yahoo! | `scrapers/yahoo.js` | ストアクリエイターPro（Playwright） |
| ギフトモール | `scrapers/giftmall.js` | GoQ経由（Playwright） |
| Qoo10 | `scrapers/qoo10.js` | GoQ経由（Playwright） |
| auPAY | `scrapers/aupay.js` | GoQ経由（Playwright） |

## 重要な仕様
- **重複排除**: Sheetsに既存の日付はスキップ（`getRakutenExistingDates()`）
- **休日ギャップ補完**: 土日月は休み。月曜実行で金〜日の3日分を自動取得
- **ブラウザセッション**: `scripts/.cookies/profile-{site}/` に永続化。毎回ログイン不要
- **Yahoo!列検索**: `colStrict()` で厳密な順序検索（部分一致エラー防止済み）
- **Amazon**: 3回リトライ（15秒間隔）
- **GoQ**: ギフトモール・Qoo10・auPAYを `scrapers/goq.js` で一括取得

## スプレッドシート
- ID: `.env` の `GOOGLE_SPREADSHEET_ID`
- シート: 日次データ / 楽天詳細 / Yahoo詳細 / Amazon詳細 / GoQ詳細

## 依存
- `playwright`（ブラウザ自動化）
- `googleapis`（Sheets API）
- `.env`（認証情報）
