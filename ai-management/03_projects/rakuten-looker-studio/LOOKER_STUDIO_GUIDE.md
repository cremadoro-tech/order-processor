# Looker Studio 設定ガイド — 楽天市場ECダッシュボード

## 事前準備チェックリスト

- [ ] BigQueryテーブル作成済み（`sql/01_create_tables.sql` 実行済み）
- [ ] BigQuery Viewsを作成済み（`sql/02_create_views.sql` 実行済み）
- [ ] 受注データを少なくとも1件BigQueryに書き込み済み（`npm run rakuten:sync --prefix scripts`）
- [ ] Googleアカウント（hankoya-store-analytics プロジェクトにアクセス権あり）

---

## Step 1: データソース設定

Looker Studio（https://lookerstudio.google.com）を開いて「データソースを作成」。

### データソース一覧（5つ作成する）

| データソース名 | 接続先View | 用途 |
|:------------|:---------|:-----|
| `楽天_日次KPI` | `v_rakuten_daily_kpi` | ページ1・2 |
| `楽天_商品別累計` | `v_rakuten_product_performance` | ページ3 ランキング |
| `楽天_商品別日次` | `v_rakuten_product_daily` | ページ3 トレンド |
| `楽天_月次サマリー` | `v_rakuten_monthly_summary` | ページ2 |
| `楽天_商品別月次` | `v_rakuten_product_monthly` | ページ3 月次比較 |

### 各データソースの作成手順

1. 「データソースを作成」→「BigQuery」を選択
2. プロジェクト: `hankoya-store-analytics`
3. データセット: `ec_analytics`
4. テーブル/ビュー: 上記のView名を選択
5. 「接続」→「レポートに追加」

### フィールド設定（データソース作成後に変更）

| フィールド名 | タイプ | 集計方法 |
|:-----------|:------|:--------|
| `date` | 日付 | — |
| `revenue` | 数値 | 合計 |
| `orders` | 数値 | 合計 |
| `avg_order_value` | 数値 | 平均 |
| `item_name` | テキスト | — |
| `total_revenue` | 数値 | 合計 |
| `total_qty` | 数値 | 合計 |

---

## Step 2: ページ1 — ストア概要

### レイアウト

```
+------------------+------------------+------------------+------------------+
|   総売上(月次)    |    注文件数       |     客単価        |  転換率(※別途)   |
|   ¥XX,XXX,XXX   |    XXX件         |    ¥X,XXX        |    X.X%          |
+------------------+------------------+------------------+------------------+
|                                                                            |
|              日次売上推移グラフ（過去30日）                                    |
|                     折れ線グラフ                                             |
|                                                                            |
+----------------------------------------+-----------------------------------+
|   前月比（売上）                          |   注文件数の推移                   |
|   棒グラフ（当月/前月）                    |   棒グラフ                        |
+----------------------------------------+-----------------------------------+
```

### グラフ設定

**スコアカード × 4**（データソース: `楽天_日次KPI`）

| カード | ディメンション | 指標 | フィルター |
|:------|:------------|:----|:---------|
| 総売上 | — | `revenue` SUM | 期間コントロールと連動 |
| 注文件数 | — | `orders` SUM | 同上 |
| 客単価 | — | `avg_order_value` AVG | 同上 |
| ユニーク顧客 | — | `unique_customers` SUM | 同上 |

**折れ線グラフ — 日次売上推移**（データソース: `楽天_日次KPI`）
- ディメンション: `date`
- 指標: `revenue`（棒）、`orders`（折れ線・右軸）
- 期間: 過去30日
- 並べ替え: `date` 昇順

**ページレベルのコントロール**
- 「期間」コントロールを追加 → デフォルトを「今月」に設定

---

## Step 3: ページ2 — 売上トレンド

### グラフ設定

**折れ線グラフ — 月次売上推移**（データソース: `楽天_月次サマリー`）
- ディメンション: `month_date`
- 指標: `revenue`（当月）、`prev_month_revenue`（前月）
- 表示形式: 比較折れ線

**棒グラフ — 前月比**（データソース: `楽天_月次サマリー`）
- ディメンション: `month`
- 指標: `revenue_mom_pct`
- 条件付き書式: 0以上→緑、0未満→赤

**積み上げ棒グラフ — 曜日別売上**（データソース: `楽天_日次KPI`）
- ディメンション: `WEEKDAY(date)`（計算フィールドで作成）
- 指標: `revenue` AVG
- 計算フィールド: `WEEKDAY(date)` → 曜日ラベル用に `CASE WHEN WEEKDAY(date)=1 THEN '月' ...`

**期間コントロール** — 月選択できるようにする

---

## Step 4: ページ3 — 商品別パフォーマンス ★メインページ

### レイアウト

```
+------------------------------------------------------------------+
|  期間フィルター  |  商品名検索フィルター                              |
+----------------------------------+-------------------------------+
|                                  |  売上TOP商品ランキング            |
|   商品別売上テーブル               |  （横棒グラフ TOP20）             |
|   （ページネーション付き）           |                               |
|   商品名 | 売上 | 注文数 | 数量     |                               |
|   | 単価 | 売上シェア              |                               |
+----------------------------------+-------------------------------+
|         選択商品の日次売上推移（折れ線グラフ）                        |
+------------------------------------------------------------------+
```

### グラフ設定

**ピボットテーブル / 表 — 商品別売上テーブル**（データソース: `楽天_商品別累計`）
- ディメンション: `item_id`, `item_name`
- 指標: `total_revenue`, `order_count`, `total_qty`, `avg_unit_price`
- 並べ替え: `total_revenue` 降順
- ページネーション: オン（50件/ページ）
- 条件付き書式: `total_revenue` → データバー表示

計算フィールド（データソース内で追加）:
```
売上シェア = total_revenue / SUM(total_revenue)
```
→ 「パーセント」形式で表示

**横棒グラフ — 売上TOP20**（データソース: `楽天_商品別累計`）
- ディメンション: `item_name`
- 指標: `total_revenue`
- 並べ替え: `total_revenue` 降順
- 表示件数: 20件
- バーの色: グラデーション（売上額に応じて）

**折れ線グラフ — 商品別トレンド**（データソース: `楽天_商品別日次`）
- ディメンション: `date`
- 内訳ディメンション: `item_name`（上位5商品）
- 指標: `revenue`
- フィルター: 商品名フィルターと連動（オプション）

**コントロール追加**
- 「期間コントロール」: デフォルト「今月」
- 「ドロップダウン（商品名）」: `item_name` → 商品別トレンドグラフと連動

---

## Step 5: ページ4 — 打ち手（AI分析）

このページはBigQueryビューの集計結果を元に、注目すべき商品・改善ポイントを表示する。

### BigQuery側で追加するView（SQL手動実行）

```sql
-- 要注目商品ビュー（前月比で急変動した商品）
CREATE OR REPLACE VIEW `hankoya-store-analytics.ec_analytics.v_rakuten_action_items` AS
WITH monthly_product AS (
  SELECT
    item_id, item_name,
    DATE_TRUNC(order_date_jst, MONTH) AS month_date,
    SUM(item_total) AS revenue,
    SUM(quantity) AS qty
  FROM `hankoya-store-analytics.ec_analytics.rakuten_order_items` i
  JOIN `hankoya-store-analytics.ec_analytics.rakuten_orders` o USING (order_number)
  WHERE o.order_progress < 700
  GROUP BY item_id, item_name, month_date
),
with_lag AS (
  SELECT *,
    LAG(revenue) OVER (PARTITION BY item_id ORDER BY month_date) AS prev_revenue,
    LAG(qty)     OVER (PARTITION BY item_id ORDER BY month_date) AS prev_qty
  FROM monthly_product
)
SELECT
  month_date,
  item_id,
  item_name,
  revenue,
  qty,
  prev_revenue,
  ROUND(SAFE_DIVIDE(revenue - prev_revenue, prev_revenue) * 100, 1) AS revenue_mom_pct,
  CASE
    WHEN SAFE_DIVIDE(revenue - prev_revenue, prev_revenue) > 0.3  THEN '急増（追加仕入・広告強化を検討）'
    WHEN SAFE_DIVIDE(revenue - prev_revenue, prev_revenue) < -0.3 THEN '急減（原因調査・価格見直しを検討）'
    WHEN prev_revenue IS NULL                                      THEN '新規商品（初月）'
    ELSE '通常'
  END AS action_label
FROM with_lag
WHERE month_date >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH), MONTH);
```

### グラフ設定

**テーブル — 要注目商品**（データソース: `楽天_アクションアイテム` ※上記Viewを追加）
- ディメンション: `item_name`
- 指標: `revenue`, `revenue_mom_pct`
- 追加列: `action_label`
- フィルター: `action_label != '通常'`
- 条件付き書式: `revenue_mom_pct` > 0 → 緑、< 0 → 赤

**スコアカード — 今月急増商品数**
- フィルター: `action_label CONTAINS '急増'`
- 指標: COUNT(item_id)

**スコアカード — 今月急減商品数**
- フィルター: `action_label CONTAINS '急減'`
- 指標: COUNT(item_id)

---

## Step 6: 全体デザイン設定

### テーマ設定
- Looker Studio「テーマとレイアウト」→「カスタム」
- プライマリカラー: `#BF0000`（楽天カラー）
- フォント: Noto Sans JP

### ページヘッダー（各ページ共通）
```
[楽天市場] ストア分析ダッシュボード  |  データ更新: {最終更新日}
```

最終更新日の表示方法:
- テキストボックスを追加
- `今日 - 1日` のDATE計算で自動表示

### 共通フィルター
全ページに「期間コントロール」を配置し、デフォルトを以下に設定:
- Page1（概要）: 今月
- Page2（トレンド）: 過去12ヶ月
- Page3（商品別）: 今月
- Page4（打ち手）: 過去2ヶ月

---

## AIによるデータ参照方法

Claudeから直接BigQueryのデータを参照するには:

### 方法1: BigQuery MCP（推奨）
BigQuery MCPが設定されていれば、以下のように問い合わせ可能:
```
「楽天の今月の売上TOP10商品を教えて」
→ v_rakuten_product_performance を参照
```

### 方法2: Google Sheets連携
BigQuery → Sheets への定期エクスポートを設定:
1. BigQueryコンソール → クエリ結果を「Googleスプレッドシートにエクスポート」
2. または: Data StudioのScheduled Data Refresh

### 方法3: sync.mjs の拡張
`sync.mjs` にGoogle Sheetsへの書き込みを追加（既存の `sheets.js` ユーティリティを活用）

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|:----|:----|:----|
| データが表示されない | BigQueryにデータなし | `npm run rakuten:sync` を実行 |
| 認証エラー | サービスアカウント権限不足 | BigQuery Data Editor 権限を付与 |
| SOAP APIエラー | serviceSecret/licenseKey 期限切れ | RMSで再発行（3ヶ月ごと） |
| 商品名が `null` | RMS API レスポンスのフィールド名差異 | `rms-client.mjs` のパース部分を調整 |
| Looker Studioで接続エラー | BigQueryプロジェクトへのアクセス権なし | GCPでIAMロールを確認 |

---

## 定期実行の設定

```bash
# macOS launchd または crontab で設定
# 毎朝7:30に前日分を自動同期
30 7 * * * cd "/Users/emikomizukami/My WorkSpace/ai-management/scripts" && node rakuten-api/sync.mjs >> /tmp/rakuten-sync.log 2>&1
```

または既存の `daily-report.sh` に以下を追加:
```bash
# 楽天受注データをBigQueryに同期
node /Users/emikomizukami/My\ WorkSpace/ai-management/scripts/rakuten-api/sync.mjs
```
