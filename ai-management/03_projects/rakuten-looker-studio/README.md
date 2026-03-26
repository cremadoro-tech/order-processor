# 楽天市場 Looker Studio ダッシュボード

## 概要

楽天RMS受注APIからデータを取得し、BigQueryに蓄積、Looker Studioで可視化する仕組み。
AIによるデータ参照も可能（BigQuery / Google Sheets経由）。

## アーキテクチャ

```
楽天RMS 受注API (SOAP)
      ↓
  sync.mjs（Node.js）
      ↓
BigQuery（hankoya-store-analytics.ec_analytics）
      ↓
Looker Studio ← ネイティブ接続
      ↓
Claude Code（AI分析）← BigQuery MCP or Sheets
```

## データソース

| データ | 取得元 | 方法 |
|:------|:------|:-----|
| 受注データ（注文・商品明細） | RMS 受注API | SOAP API自動取得 |
| アクセス解析（PV・転換率）| RMS データツール | Playwright スクレイピング（既存） |

## BigQueryテーブル構成

| テーブル/ビュー | 内容 |
|:------------|:-----|
| `rakuten_orders` | 受注ヘッダー（注文単位） |
| `rakuten_order_items` | 受注明細（商品単位） |
| `v_rakuten_daily_kpi` | 日次KPIビュー |
| `v_rakuten_product_performance` | 商品別累計パフォーマンス |
| `v_rakuten_product_daily` | 商品別日次売上 |

## Looker Studioページ構成

| ページ | 主要グラフ |
|:------|:---------|
| 1. ストア概要 | KPIスコアカード・日次売上推移 |
| 2. 売上トレンド | 月次・週次・日次グラフ・前年比 |
| 3. 商品別パフォーマンス | 商品ランキング・転換率・売上テーブル |
| 4. 打ち手（AI分析） | 要注意商品・アクション提案 |

## セットアップ手順

### 1. BigQueryテーブル作成

```bash
# GCPコンソール or bqコマンドで実行
cat sql/01_create_tables.sql | bq query --use_legacy_sql=false
cat sql/02_create_views.sql | bq query --use_legacy_sql=false
```

または BigQueryコンソール（https://console.cloud.google.com/bigquery）で
`sql/` フォルダ内のSQLを順番に実行。

### 2. サービスアカウントキー配置

```
.env に記載済み:
BIGQUERY_KEY_FILE=.cookies/bigquery-service-account.json
```

BigQueryへの書き込み権限を持つサービスアカウントキーを上記パスに配置する。

### 3. データ同期実行

```bash
# 前日分を取得
node scripts/rakuten-api/sync.mjs

# 期間指定で取得
node scripts/rakuten-api/sync.mjs --start 2026-01-01 --end 2026-03-13

# テスト（BigQueryに書き込まない）
node scripts/rakuten-api/sync.mjs --dry-run
```

### 4. Looker Studio接続

`LOOKER_STUDIO_GUIDE.md` を参照。

## 定期実行

```bash
# crontab に追加（毎朝7時に前日分を取得）
0 7 * * * cd /Users/emikomizukami/My\ WorkSpace/ai-management && node scripts/rakuten-api/sync.mjs >> logs/rakuten-sync.log 2>&1
```

## ファイル構成

```
03_projects/rakuten-looker-studio/
├── README.md                    # この文書
├── LOOKER_STUDIO_GUIDE.md       # Looker Studio設定手順
├── schema/
│   ├── rakuten_orders.json      # 受注ヘッダー スキーマ
│   └── rakuten_order_items.json # 受注明細 スキーマ
└── sql/
    ├── 01_create_tables.sql     # テーブル作成SQL
    └── 02_create_views.sql      # ビュー定義SQL

scripts/rakuten-api/
├── sync.mjs                     # エントリポイント（CLI）
├── rms-client.mjs               # RMS SOAP APIクライアント
└── bigquery-writer.mjs          # BigQuery書き込みモジュール
```
