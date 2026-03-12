# /update-ec-data — EC各サイトの売上データを取得してスプレッドシートに書き込む

## 概要
Playwright を使って各ECサイトの管理画面にログインし、売上・注文・在庫データを取得して Google Sheets に書き込むスキル。

## 対象ECサイト

| サイト | 管理画面URL | 取得データ |
|:------|:----------|:---------|
| Amazon | セラーセントラル | 売上・注文数・在庫・広告費 |
| 楽天 | RMS (Rakuten Merchant Server) | 売上・注文数・商品ランキング |
| Yahoo!ショッピング | ストアクリエイターPro | 売上・注文数・アクセス数 |
| Shopify / 自社EC | Shopify Admin | 売上・注文数・顧客数 |
| ギフトモール | 管理画面 | 売上・注文数 |
| AuPay | 管理画面 | 売上・注文数 |
| Qoo10 | Q-manager | 売上・注文数 |

## 前提条件
- MCP `playwright` が有効になっていること
- MCP `google-sheets` が有効になっていること
- `.env` に各サイトのログイン情報が設定されていること
  ```
  AMAZON_SELLER_EMAIL=
  AMAZON_SELLER_PASSWORD=
  RAKUTEN_SELLER_ID=
  RAKUTEN_SELLER_PASSWORD=
  YAHOO_STORE_ID=
  YAHOO_PASSWORD=
  SHOPIFY_STORE_URL=
  SHOPIFY_API_KEY=
  GIFTMALL_EMAIL=
  GIFTMALL_PASSWORD=
  AUPAY_EMAIL=
  AUPAY_PASSWORD=
  QOO10_SELLER_ID=
  QOO10_PASSWORD=
  GOOGLE_SPREADSHEET_ID=
  ```

## 実行手順

1. **取得期間を確認する**
   - デフォルト：前日の実績
   - ユーザーが「今週」「先月」等と指定した場合は対応する

2. **各サイトからデータを取得する**（Playwright で各管理画面にアクセス）

   ### Amazon
   - セラーセントラル → ビジネスレポート → 売上・トラフィック
   - 取得項目：注文数・売上高・単価・広告費・ACOS

   ### 楽天
   - RMS → 店舗カルテ / レポート
   - 取得項目：注文数・売上高・転換率・アクセス数

   ### Yahoo!ショッピング
   - ストアクリエイターPro → 注文管理 / 売上管理
   - 取得項目：注文数・売上高・アクセス数

   ### Shopify
   - Shopify Admin → Analytics / Reports
   - 取得項目：注文数・売上高・新規顧客数

   ### ギフトモール・AuPay・Qoo10
   - 各管理画面から注文数・売上高を取得

3. **データを Google Sheets に書き込む**
   - MCP `google-sheets` を使用
   - シート構成：
     - `月次サマリー`：各サイト比較・合計
     - `日次データ`：日付 × サイト別の詳細
     - `Amazon`：Amazon専用詳細シート
     - `楽天`：楽天専用詳細シート
     - （各サイト別シート）

4. **サマリーを生成してユーザーに報告する**
   - 昨日の総売上・注文数
   - 前週比・前月比
   - 注目すべき変動（急増・急減）
   - アクションが必要な項目（在庫切れ等）

## 出力フォーマット（報告）

```
📊 EC売上レポート YYYY/MM/DD

合計売上：XX,XXX円（前日比 +/-XX%）
合計注文：XX件

【チャネル別】
Amazon:     XX,XXX円（XX件）
楽天:       XX,XXX円（XX件）
Yahoo!:     XX,XXX円（XX件）
Shopify:    XX,XXX円（XX件）
ギフトモール: XX,XXX円（XX件）
AuPay:      XX,XXX円（XX件）
Qoo10:      XX,XXX円（XX件）

【要注意】
- 在庫切れ商品: X件
- 低評価レビュー: X件
```

## スプレッドシートの初回セットアップ
初回実行時は以下のシートを自動作成する：
- `月次サマリー`
- `日次データ`
- `Amazon`、`楽天`、`Yahoo!`、`Shopify`、`ギフトモール`、`AuPay`、`Qoo10`
