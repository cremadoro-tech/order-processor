-- ============================================================
-- 楽天市場 Looker Studio用 BigQuery ビュー定義
-- プロジェクト: hankoya-store-analytics
-- データセット: ec_analytics
-- ============================================================
-- このファイルのビューをLooker Studioのデータソースに設定する

-- ============================================================
-- View 1: 日次KPI（Page1 ストア概要 / Page2 売上トレンド用）
-- ============================================================
CREATE OR REPLACE VIEW `hankoya-store-analytics.ec_analytics.v_rakuten_daily_kpi` AS
SELECT
  o.order_date_jst                                    AS date,
  COUNT(DISTINCT o.order_number)                      AS orders,
  SUM(o.total_price)                                  AS revenue,
  ROUND(AVG(o.total_price))                           AS avg_order_value,
  SUM(o.postage)                                      AS total_postage,
  SUM(o.point_used)                                   AS total_point_used,
  SUM(o.coupon_discount)                              AS total_coupon_discount,
  COUNTIF(o.order_progress BETWEEN 700 AND 800)       AS cancelled_orders,
  COUNT(DISTINCT o.customer_id)                       AS unique_customers
FROM `hankoya-store-analytics.ec_analytics.rakuten_orders` o
WHERE o.order_progress NOT BETWEEN 700 AND 800  -- キャンセルを除外（メイン集計）
GROUP BY o.order_date_jst;

-- ============================================================
-- View 2: 商品別累計パフォーマンス（Page3 商品別パフォーマンス用）
-- ============================================================
CREATE OR REPLACE VIEW `hankoya-store-analytics.ec_analytics.v_rakuten_product_performance` AS
SELECT
  i.item_id,
  i.item_name,
  SUM(i.quantity)                               AS total_qty,
  SUM(i.item_total)                             AS total_revenue,
  COUNT(DISTINCT i.order_number)                AS order_count,
  ROUND(AVG(i.unit_price))                      AS avg_unit_price,
  ROUND(SUM(i.item_total) / NULLIF(SUM(i.quantity), 0)) AS revenue_per_unit,
  MIN(i.order_date_jst)                         AS first_order_date,
  MAX(i.order_date_jst)                         AS last_order_date,
  DATE_DIFF(MAX(i.order_date_jst), MIN(i.order_date_jst), DAY) + 1 AS active_days
FROM `hankoya-store-analytics.ec_analytics.rakuten_order_items` i
INNER JOIN `hankoya-store-analytics.ec_analytics.rakuten_orders` o
  ON i.order_number = o.order_number
WHERE o.order_progress NOT BETWEEN 700 AND 800  -- キャンセル除外
GROUP BY i.item_id, i.item_name;

-- ============================================================
-- View 3: 商品別日次売上（Page3 商品別トレンドグラフ用）
-- ============================================================
CREATE OR REPLACE VIEW `hankoya-store-analytics.ec_analytics.v_rakuten_product_daily` AS
SELECT
  i.order_date_jst                              AS date,
  i.item_id,
  i.item_name,
  SUM(i.quantity)                               AS qty,
  SUM(i.item_total)                             AS revenue,
  COUNT(DISTINCT i.order_number)                AS orders,
  ROUND(AVG(i.unit_price))                      AS avg_unit_price
FROM `hankoya-store-analytics.ec_analytics.rakuten_order_items` i
INNER JOIN `hankoya-store-analytics.ec_analytics.rakuten_orders` o
  ON i.order_number = o.order_number
WHERE o.order_progress NOT BETWEEN 700 AND 800
GROUP BY i.order_date_jst, i.item_id, i.item_name;

-- ============================================================
-- View 4: 月次サマリー（前月比計算込み）
-- ============================================================
CREATE OR REPLACE VIEW `hankoya-store-analytics.ec_analytics.v_rakuten_monthly_summary` AS
WITH monthly AS (
  SELECT
    FORMAT_DATE('%Y-%m', order_date_jst)        AS month,
    DATE_TRUNC(order_date_jst, MONTH)           AS month_date,
    COUNT(DISTINCT order_number)                AS orders,
    SUM(total_price)                            AS revenue,
    ROUND(AVG(total_price))                     AS avg_order_value,
    COUNT(DISTINCT customer_id)                 AS unique_customers
  FROM `hankoya-store-analytics.ec_analytics.rakuten_orders`
  WHERE order_progress NOT BETWEEN 700 AND 800
  GROUP BY month, month_date
)
SELECT
  month,
  month_date,
  orders,
  revenue,
  avg_order_value,
  unique_customers,
  LAG(revenue) OVER (ORDER BY month_date)       AS prev_month_revenue,
  LAG(orders)  OVER (ORDER BY month_date)       AS prev_month_orders,
  ROUND(
    SAFE_DIVIDE(revenue - LAG(revenue) OVER (ORDER BY month_date),
                LAG(revenue) OVER (ORDER BY month_date)) * 100, 1
  )                                             AS revenue_mom_pct,   -- 前月比(%)
  ROUND(
    SAFE_DIVIDE(orders - LAG(orders) OVER (ORDER BY month_date),
                LAG(orders) OVER (ORDER BY month_date)) * 100, 1
  )                                             AS orders_mom_pct
FROM monthly
ORDER BY month_date DESC;

-- ============================================================
-- View 5: 商品別月次（期間フィルタと組み合わせて使用）
-- ============================================================
CREATE OR REPLACE VIEW `hankoya-store-analytics.ec_analytics.v_rakuten_product_monthly` AS
SELECT
  DATE_TRUNC(i.order_date_jst, MONTH)           AS month_date,
  FORMAT_DATE('%Y-%m', i.order_date_jst)        AS month,
  i.item_id,
  i.item_name,
  SUM(i.quantity)                               AS qty,
  SUM(i.item_total)                             AS revenue,
  COUNT(DISTINCT i.order_number)                AS orders
FROM `hankoya-store-analytics.ec_analytics.rakuten_order_items` i
INNER JOIN `hankoya-store-analytics.ec_analytics.rakuten_orders` o
  ON i.order_number = o.order_number
WHERE o.order_progress NOT BETWEEN 700 AND 800
GROUP BY month_date, month, i.item_id, i.item_name;

-- 確認
SELECT table_name FROM `hankoya-store-analytics.ec_analytics.INFORMATION_SCHEMA.VIEWS`
WHERE table_name LIKE 'v_rakuten_%'
ORDER BY table_name;
