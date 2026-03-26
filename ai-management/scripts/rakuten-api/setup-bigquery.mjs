/**
 * setup-bigquery.mjs — BigQueryのテーブル・ビュー・データセットを初回セットアップ
 *
 * 実行: node scripts/rakuten-api/setup-bigquery.mjs
 */

import { readFileSync } from 'fs';
import { google }       from 'googleapis';
import { config }       from 'dotenv';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });

const PROJECT_ID   = process.env.BIGQUERY_PROJECT_ID || 'hankoya-store-analytics';
const DATASET_ID   = process.env.BIGQUERY_DATASET    || 'ec_analytics';
const KEY_FILE_REL = process.env.BIGQUERY_KEY_FILE   || '.cookies/bigquery-service-account.json';
const KEY_FILE     = resolve(join(__dirname, '../../', KEY_FILE_REL));

async function getAuth() {
  const keyFile = JSON.parse(readFileSync(KEY_FILE, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: [
      'https://www.googleapis.com/auth/bigquery',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
  });
  return auth;
}

async function main() {
  console.log('BigQuery セットアップ開始');
  console.log(`プロジェクト: ${PROJECT_ID}`);
  console.log(`データセット: ${DATASET_ID}`);
  console.log('');

  const auth = await getAuth();
  const bq   = google.bigquery({ version: 'v2', auth });

  // --- 1. データセット作成 ---
  console.log('📁 データセット確認中...');
  try {
    await bq.datasets.get({ projectId: PROJECT_ID, datasetId: DATASET_ID });
    console.log(`  ✅ データセット "${DATASET_ID}" は既に存在します`);
  } catch (err) {
    if (err.code === 404) {
      await bq.datasets.insert({
        projectId: PROJECT_ID,
        requestBody: {
          datasetReference: { projectId: PROJECT_ID, datasetId: DATASET_ID },
          location: 'asia-northeast1',
          description: 'EC Analytics データセット（楽天・Amazon等）',
        },
      });
      console.log(`  ✅ データセット "${DATASET_ID}" を作成しました（東京リージョン）`);
    } else {
      throw err;
    }
  }

  // --- 2. テーブル作成 ---
  console.log('\n📋 テーブル作成中...');

  const tables = [
    {
      tableId: 'rakuten_orders',
      description: '楽天市場 受注ヘッダー (注文単位)',
      schema: {
        fields: [
          { name: 'order_number',    type: 'STRING',    mode: 'REQUIRED', description: '楽天注文番号' },
          { name: 'order_date',      type: 'TIMESTAMP', mode: 'REQUIRED', description: '注文日時(JST)' },
          { name: 'order_date_jst',  type: 'DATE',      mode: 'REQUIRED', description: '注文日(JST)' },
          { name: 'order_progress',  type: 'INTEGER',   mode: 'NULLABLE', description: '注文ステータス' },
          { name: 'customer_id',     type: 'STRING',    mode: 'NULLABLE', description: '楽天会員ID' },
          { name: 'subtotal_price',  type: 'INTEGER',   mode: 'NULLABLE', description: '商品合計金額(税込)' },
          { name: 'postage',         type: 'INTEGER',   mode: 'NULLABLE', description: '送料' },
          { name: 'charge',          type: 'INTEGER',   mode: 'NULLABLE', description: '手数料' },
          { name: 'total_price',     type: 'INTEGER',   mode: 'NULLABLE', description: '注文合計金額' },
          { name: 'point_used',      type: 'INTEGER',   mode: 'NULLABLE', description: '使用ポイント数' },
          { name: 'coupon_discount', type: 'INTEGER',   mode: 'NULLABLE', description: 'クーポン割引額' },
          { name: 'settlement_name', type: 'STRING',    mode: 'NULLABLE', description: '支払い方法' },
          { name: 'delivery_pref',   type: 'STRING',    mode: 'NULLABLE', description: '配送先都道府県' },
          { name: 'is_new_customer', type: 'BOOLEAN',   mode: 'NULLABLE', description: '新規顧客フラグ' },
          { name: 'inserted_at',     type: 'TIMESTAMP', mode: 'REQUIRED', description: 'BQ書き込み日時' },
        ],
      },
      timePartitioning: { type: 'DAY', field: 'order_date_jst' },
      clustering: { fields: ['order_number'] },
    },
    {
      tableId: 'nint_rankings',
      description: 'Nint EC市場分析 ジャンル別商品ランキング',
      schema: {
        fields: [
          { name: 'report_date',   type: 'DATE',      mode: 'REQUIRED', description: 'レポート日' },
          { name: 'genre',         type: 'STRING',    mode: 'REQUIRED', description: 'ジャンル名（印鑑・ハンコ・スタンプ/筆記具/その他文具）' },
          { name: 'rank',          type: 'INTEGER',   mode: 'REQUIRED', description: 'ランキング順位 1-10' },
          { name: 'product_name',  type: 'STRING',    mode: 'NULLABLE', description: '商品名' },
          { name: 'price',         type: 'STRING',    mode: 'NULLABLE', description: '価格（原データそのまま）' },
          { name: 'price_numeric', type: 'INTEGER',   mode: 'NULLABLE', description: '価格（数値化、パース失敗時NULL）' },
          { name: 'sales',         type: 'STRING',    mode: 'NULLABLE', description: '売上推計（原データ）' },
          { name: 'keyword',       type: 'STRING',    mode: 'NULLABLE', description: '検索キーワード' },
          { name: 'inserted_at',   type: 'TIMESTAMP', mode: 'REQUIRED', description: 'BQ書き込み日時' },
        ],
      },
      timePartitioning: { type: 'DAY', field: 'report_date' },
      clustering: { fields: ['genre', 'rank'] },
    },
    {
      tableId: 'nint_shop_analysis',
      description: 'Nint ショップ分析（特定ショップの全商品データ）',
      schema: {
        fields: [
          { name: 'report_date',      type: 'DATE',      mode: 'REQUIRED', description: 'レポート日' },
          { name: 'shop_name',        type: 'STRING',    mode: 'REQUIRED', description: 'ショップ名（ファイル名から取得）' },
          { name: 'product_code',     type: 'STRING',    mode: 'NULLABLE', description: '商品Code' },
          { name: 'product_name',     type: 'STRING',    mode: 'NULLABLE', description: '商品名' },
          { name: 'product_url',      type: 'STRING',    mode: 'NULLABLE', description: '商品URL' },
          { name: 'genre',            type: 'STRING',    mode: 'NULLABLE', description: 'ジャンル' },
          { name: 'price',            type: 'INTEGER',   mode: 'NULLABLE', description: '価格' },
          { name: 'has_ad',           type: 'BOOLEAN',   mode: 'NULLABLE', description: '広告出稿あり' },
          { name: 'shipping',         type: 'STRING',    mode: 'NULLABLE', description: '送料（込/別）' },
          { name: 'in_stock',         type: 'BOOLEAN',   mode: 'NULLABLE', description: '在庫あり' },
          { name: 'point_rate',       type: 'INTEGER',   mode: 'NULLABLE', description: 'ポイント倍率' },
          { name: 'sales_7d',         type: 'INTEGER',   mode: 'NULLABLE', description: '最近7日売上推数（税込）' },
          { name: 'qty_7d',           type: 'INTEGER',   mode: 'NULLABLE', description: '最近7日販売個数' },
          { name: 'sales_14d',        type: 'INTEGER',   mode: 'NULLABLE', description: '最近14日売上推数（税込）' },
          { name: 'qty_14d',          type: 'INTEGER',   mode: 'NULLABLE', description: '最近14日販売個数' },
          { name: 'sales_30d',        type: 'INTEGER',   mode: 'NULLABLE', description: '最近30日売上推数（税込）' },
          { name: 'qty_30d',          type: 'INTEGER',   mode: 'NULLABLE', description: '最近30日販売個数' },
          { name: 'review_count',     type: 'INTEGER',   mode: 'NULLABLE', description: 'レビュー数' },
          { name: 'rating',           type: 'FLOAT',     mode: 'NULLABLE', description: '商品評価' },
          { name: 'image_url',        type: 'STRING',    mode: 'NULLABLE', description: '画像URL' },
          { name: 'inserted_at',      type: 'TIMESTAMP', mode: 'REQUIRED', description: 'BQ書き込み日時' },
        ],
      },
      timePartitioning: { type: 'DAY', field: 'report_date' },
      clustering: { fields: ['shop_name', 'product_code'] },
    },
    {
      tableId: 'nint_genre_ranking',
      description: 'Nint 業種分析ランキング（ジャンル別TOP商品）',
      schema: {
        fields: [
          { name: 'report_date',      type: 'DATE',      mode: 'REQUIRED', description: 'レポート日' },
          { name: 'category',         type: 'STRING',    mode: 'REQUIRED', description: 'カテゴリ（例: 筆記具）' },
          { name: 'subcategory',      type: 'STRING',    mode: 'NULLABLE', description: 'サブカテゴリ（例: 多機能ペン）' },
          { name: 'rank',             type: 'INTEGER',   mode: 'REQUIRED', description: 'ランキング順位' },
          { name: 'product_name',     type: 'STRING',    mode: 'NULLABLE', description: '商品名' },
          { name: 'product_url',      type: 'STRING',    mode: 'NULLABLE', description: '商品URL' },
          { name: 'shop_name',        type: 'STRING',    mode: 'NULLABLE', description: 'ショップ名' },
          { name: 'price',            type: 'INTEGER',   mode: 'NULLABLE', description: '価格' },
          { name: 'avg_price',        type: 'INTEGER',   mode: 'NULLABLE', description: '平均価格' },
          { name: 'sales_amount',     type: 'INTEGER',   mode: 'NULLABLE', description: '売上推数（税込）' },
          { name: 'sales_qty',        type: 'INTEGER',   mode: 'NULLABLE', description: '販売量（個）' },
          { name: 'sales_share_pct',  type: 'FLOAT',     mode: 'NULLABLE', description: '売上シェア率（%）' },
          { name: 'qty_share_pct',    type: 'FLOAT',     mode: 'NULLABLE', description: '販売量シェア率（%）' },
          { name: 'review_count',     type: 'INTEGER',   mode: 'NULLABLE', description: 'レビュー数' },
          { name: 'rating',           type: 'FLOAT',     mode: 'NULLABLE', description: '商品評価' },
          { name: 'image_url',        type: 'STRING',    mode: 'NULLABLE', description: '画像URL' },
          { name: 'inserted_at',      type: 'TIMESTAMP', mode: 'REQUIRED', description: 'BQ書き込み日時' },
        ],
      },
      timePartitioning: { type: 'DAY', field: 'report_date' },
      clustering: { fields: ['category', 'subcategory', 'rank'] },
    },
    {
      tableId: 'nint_trends',
      description: 'Nint トレンドキーワード',
      schema: {
        fields: [
          { name: 'report_date',  type: 'DATE',      mode: 'REQUIRED', description: 'レポート日' },
          { name: 'keyword',      type: 'STRING',    mode: 'REQUIRED', description: 'トレンドキーワード' },
          { name: 'position',     type: 'INTEGER',   mode: 'NULLABLE', description: '表示順位（取得順）' },
          { name: 'inserted_at',  type: 'TIMESTAMP', mode: 'REQUIRED', description: 'BQ書き込み日時' },
        ],
      },
      timePartitioning: { type: 'DAY', field: 'report_date' },
      clustering: { fields: ['keyword'] },
    },
    {
      tableId: 'rakuten_order_items',
      description: '楽天市場 受注明細 (商品単位)',
      schema: {
        fields: [
          { name: 'order_number',   type: 'STRING',    mode: 'REQUIRED', description: '楽天注文番号' },
          { name: 'order_date_jst', type: 'DATE',      mode: 'REQUIRED', description: '注文日(JST)' },
          { name: 'package_id',     type: 'STRING',    mode: 'NULLABLE', description: 'パッケージID' },
          { name: 'item_id',        type: 'STRING',    mode: 'REQUIRED', description: '商品番号' },
          { name: 'item_name',      type: 'STRING',    mode: 'NULLABLE', description: '商品名' },
          { name: 'item_option',    type: 'STRING',    mode: 'NULLABLE', description: '商品オプション' },
          { name: 'unit_price',     type: 'INTEGER',   mode: 'NULLABLE', description: '販売単価(税込)' },
          { name: 'quantity',       type: 'INTEGER',   mode: 'NULLABLE', description: '注文数量' },
          { name: 'item_total',     type: 'INTEGER',   mode: 'NULLABLE', description: '商品合計金額' },
          { name: 'point_amount',   type: 'INTEGER',   mode: 'NULLABLE', description: '付与ポイント数' },
          { name: 'inserted_at',    type: 'TIMESTAMP', mode: 'REQUIRED', description: 'BQ書き込み日時' },
        ],
      },
      timePartitioning: { type: 'DAY', field: 'order_date_jst' },
      clustering: { fields: ['item_id', 'order_number'] },
    },
  ];

  for (const table of tables) {
    try {
      await bq.tables.get({
        projectId: PROJECT_ID,
        datasetId: DATASET_ID,
        tableId:   table.tableId,
      });
      console.log(`  ✅ テーブル "${table.tableId}" は既に存在します`);
    } catch (err) {
      if (err.code === 404) {
        await bq.tables.insert({
          projectId: PROJECT_ID,
          datasetId: DATASET_ID,
          requestBody: {
            tableReference: { projectId: PROJECT_ID, datasetId: DATASET_ID, tableId: table.tableId },
            description:       table.description,
            schema:            table.schema,
            timePartitioning:  table.timePartitioning,
            clustering:        table.clustering,
          },
        });
        console.log(`  ✅ テーブル "${table.tableId}" を作成しました`);
      } else {
        throw err;
      }
    }
  }

  // --- 3. ビュー作成 ---
  console.log('\n🔭 ビュー作成中...');

  const P = `\`${PROJECT_ID}.${DATASET_ID}`;

  const views = [
    {
      tableId: 'v_rakuten_daily_kpi',
      description: '楽天 日次KPI（Looker Studio Page1・2用）',
      query: `
SELECT
  o.order_date_jst                                    AS date,
  COUNT(DISTINCT o.order_number)                      AS orders,
  SUM(o.total_price)                                  AS revenue,
  ROUND(AVG(o.total_price))                           AS avg_order_value,
  SUM(o.postage)                                      AS total_postage,
  SUM(o.point_used)                                   AS total_point_used,
  COUNTIF(o.order_progress BETWEEN 700 AND 800)       AS cancelled_orders,
  COUNT(DISTINCT o.customer_id)                       AS unique_customers
FROM ${P}.rakuten_orders\` o
WHERE o.total_price > 0
GROUP BY o.order_date_jst`,
    },
    {
      tableId: 'v_rakuten_product_performance',
      description: '楽天 商品別累計パフォーマンス（Looker Studio Page3 ランキング用）',
      query: `
SELECT
  i.item_id,
  i.item_name,
  SUM(i.quantity)                                             AS total_qty,
  SUM(i.item_total)                                          AS total_revenue,
  COUNT(DISTINCT i.order_number)                             AS order_count,
  ROUND(AVG(i.unit_price))                                   AS avg_unit_price,
  ROUND(SUM(i.item_total) / NULLIF(SUM(i.quantity), 0))     AS revenue_per_unit,
  MIN(i.order_date_jst)                                      AS first_order_date,
  MAX(i.order_date_jst)                                      AS last_order_date
FROM ${P}.rakuten_order_items\` i
INNER JOIN ${P}.rakuten_orders\` o ON i.order_number = o.order_number
WHERE o.total_price > 0
GROUP BY i.item_id, i.item_name`,
    },
    {
      tableId: 'v_rakuten_product_daily',
      description: '楽天 商品別日次売上（Looker Studio Page3 トレンドグラフ用）',
      query: `
SELECT
  i.order_date_jst                              AS date,
  i.item_id,
  i.item_name,
  SUM(i.quantity)                               AS qty,
  SUM(i.item_total)                             AS revenue,
  COUNT(DISTINCT i.order_number)                AS orders,
  ROUND(AVG(i.unit_price))                      AS avg_unit_price
FROM ${P}.rakuten_order_items\` i
INNER JOIN ${P}.rakuten_orders\` o ON i.order_number = o.order_number
WHERE o.total_price > 0
GROUP BY i.order_date_jst, i.item_id, i.item_name`,
    },
    {
      tableId: 'v_rakuten_monthly_summary',
      description: '楽天 月次サマリー（前月比込み）',
      query: `
WITH monthly AS (
  SELECT
    FORMAT_DATE('%Y-%m', order_date_jst)        AS month,
    DATE_TRUNC(order_date_jst, MONTH)           AS month_date,
    COUNT(DISTINCT order_number)                AS orders,
    SUM(total_price)                            AS revenue,
    ROUND(AVG(total_price))                     AS avg_order_value,
    COUNT(DISTINCT customer_id)                 AS unique_customers
  FROM ${P}.rakuten_orders\`
  WHERE total_price > 0
  GROUP BY month, month_date
)
SELECT
  month,
  month_date,
  orders,
  revenue,
  avg_order_value,
  unique_customers,
  LAG(revenue,          12) OVER (ORDER BY month_date) AS prev_year_revenue,
  LAG(orders,           12) OVER (ORDER BY month_date) AS prev_year_orders,
  LAG(unique_customers, 12) OVER (ORDER BY month_date) AS prev_year_unique_customers,
  ROUND(
    SAFE_DIVIDE(revenue - LAG(revenue, 12) OVER (ORDER BY month_date),
                LAG(revenue, 12) OVER (ORDER BY month_date)) * 100, 1
  ) AS revenue_yoy_pct,
  ROUND(
    SAFE_DIVIDE(orders - LAG(orders, 12) OVER (ORDER BY month_date),
                LAG(orders,  12) OVER (ORDER BY month_date)) * 100, 1
  ) AS orders_yoy_pct
FROM monthly
ORDER BY month_date DESC`,
    },
    {
      tableId: 'v_rakuten_product_monthly',
      description: '楽天 商品別月次売上',
      query: `
SELECT
  DATE_TRUNC(i.order_date_jst, MONTH)           AS month_date,
  FORMAT_DATE('%Y-%m', i.order_date_jst)        AS month,
  i.item_id,
  i.item_name,
  SUM(i.quantity)                               AS qty,
  SUM(i.item_total)                             AS revenue,
  COUNT(DISTINCT i.order_number)                AS orders
FROM ${P}.rakuten_order_items\` i
INNER JOIN ${P}.rakuten_orders\` o ON i.order_number = o.order_number
WHERE o.total_price > 0
GROUP BY month_date, month, i.item_id, i.item_name`,
    },
    {
      tableId: 'v_rakuten_action_items',
      description: '楽天 打ち手アクションアイテム（前月比急変動商品）',
      query: `
WITH monthly_product AS (
  SELECT
    i.item_id, i.item_name,
    DATE_TRUNC(i.order_date_jst, MONTH) AS month_date,
    SUM(i.item_total)                   AS revenue,
    SUM(i.quantity)                     AS qty
  FROM ${P}.rakuten_order_items\` i
  JOIN ${P}.rakuten_orders\` o USING (order_number)
  WHERE o.total_price > 0
  GROUP BY i.item_id, i.item_name, month_date
),
with_lag AS (
  SELECT *,
    LAG(revenue) OVER (PARTITION BY item_id ORDER BY month_date) AS prev_revenue
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
WHERE month_date >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH), MONTH)`,
    },
    // --- Nint市場分析ビュー ---
    {
      tableId: 'v_nint_ranking_latest',
      description: 'Nint 最新日のジャンル別TOP10',
      query: `
WITH latest AS (
  SELECT MAX(report_date) AS max_date
  FROM ${P}.nint_rankings\`
)
SELECT
  r.report_date,
  r.genre,
  r.rank,
  r.product_name,
  r.price,
  r.price_numeric,
  r.sales,
  r.keyword
FROM ${P}.nint_rankings\` r
CROSS JOIN latest l
WHERE r.report_date = l.max_date
ORDER BY r.genre, r.rank`,
    },
    {
      tableId: 'v_nint_ranking_trend',
      description: 'Nint 商品の順位推移（過去90日）',
      query: `
SELECT
  report_date,
  genre,
  product_name,
  rank,
  price_numeric
FROM ${P}.nint_rankings\`
WHERE report_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
ORDER BY genre, product_name, report_date`,
    },
    {
      tableId: 'v_nint_price_trend',
      description: 'Nint ジャンル別の平均価格推移',
      query: `
SELECT
  report_date,
  genre,
  ROUND(AVG(price_numeric)) AS avg_price,
  MIN(price_numeric)        AS min_price,
  MAX(price_numeric)        AS max_price,
  COUNT(*)                  AS product_count
FROM ${P}.nint_rankings\`
WHERE price_numeric IS NOT NULL
GROUP BY report_date, genre
ORDER BY report_date DESC, genre`,
    },
    {
      tableId: 'v_nint_trend_keywords',
      description: 'Nint トレンドキーワード出現頻度・初出/最終日',
      query: `
SELECT
  keyword,
  COUNT(*)                                              AS appearance_count,
  MIN(report_date)                                      AS first_seen,
  MAX(report_date)                                      AS last_seen,
  DATE_DIFF(MAX(report_date), MIN(report_date), DAY)    AS trend_duration_days
FROM ${P}.nint_trends\`
GROUP BY keyword
ORDER BY appearance_count DESC`,
    },
    {
      tableId: 'v_nint_cross_analysis',
      description: 'Nint ランキング × 楽天売上の横断分析（商品名部分一致）',
      query: `
SELECT
  nr.report_date    AS nint_date,
  nr.genre,
  nr.rank           AS nint_rank,
  nr.product_name   AS nint_product,
  nr.price_numeric  AS nint_price,
  ri.item_id,
  ri.item_name      AS rakuten_product,
  SUM(ri.quantity)   AS rakuten_qty,
  SUM(ri.item_total) AS rakuten_revenue
FROM ${P}.nint_rankings\` nr
LEFT JOIN ${P}.rakuten_order_items\` ri
  ON LOWER(nr.product_name) LIKE CONCAT('%', LOWER(ri.item_name), '%')
  AND ri.order_date_jst BETWEEN DATE_SUB(nr.report_date, INTERVAL 7 DAY) AND nr.report_date
WHERE nr.report_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY nr.report_date, nr.genre, nr.rank, nr.product_name, nr.price_numeric, ri.item_id, ri.item_name
ORDER BY nr.report_date DESC, nr.genre, nr.rank`,
    },
    {
      tableId: 'v_rakuten_pref_summary',
      description: '楽天 都道府県別売上サマリー（Looker Studio 地域分析用）',
      query: `
SELECT
  delivery_pref                   AS prefecture,
  COUNT(DISTINCT order_number)    AS orders,
  SUM(total_price)                AS revenue,
  ROUND(AVG(total_price))         AS avg_order_value
FROM \`hankoya-store-analytics.ec_analytics.rakuten_orders\`
WHERE total_price > 0
  AND delivery_pref IS NOT NULL
GROUP BY delivery_pref
ORDER BY revenue DESC`,
    },
  ];

  for (const view of views) {
    try {
      await bq.tables.get({
        projectId: PROJECT_ID,
        datasetId: DATASET_ID,
        tableId:   view.tableId,
      });
      // 既存ビューを更新
      await bq.tables.update({
        projectId: PROJECT_ID,
        datasetId: DATASET_ID,
        tableId:   view.tableId,
        requestBody: {
          tableReference: { projectId: PROJECT_ID, datasetId: DATASET_ID, tableId: view.tableId },
          description: view.description,
          view: { query: view.query, useLegacySql: false },
        },
      });
      console.log(`  🔄 ビュー "${view.tableId}" を更新しました`);
    } catch (err) {
      if (err.code === 404) {
        await bq.tables.insert({
          projectId: PROJECT_ID,
          datasetId: DATASET_ID,
          requestBody: {
            tableReference: { projectId: PROJECT_ID, datasetId: DATASET_ID, tableId: view.tableId },
            description: view.description,
            view: { query: view.query, useLegacySql: false },
          },
        });
        console.log(`  ✅ ビュー "${view.tableId}" を作成しました`);
      } else {
        console.error(`  ❌ ビュー "${view.tableId}" の作成に失敗:`, err.message);
      }
    }
  }

  console.log('\n========================================');
  console.log('✅ BigQuery セットアップ完了！');
  console.log('');
  console.log('次のステップ:');
  console.log('  楽天データ初回取得:');
  console.log('  node scripts/rakuten-api/sync.mjs --start 2026-01-01 --dry-run');
  console.log('  （--dry-runを外すと実際に書き込まれます）');
  console.log('========================================');
}

main().catch(err => {
  console.error('\n❌ セットアップ失敗:', err.message);
  if (err.errors) console.error('詳細:', JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
