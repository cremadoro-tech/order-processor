-- ============================================================
-- 楽天市場 EC Analytics BigQuery テーブル作成
-- プロジェクト: hankoya-store-analytics
-- データセット: ec_analytics
-- 実行方法: BigQueryコンソールまたは bq コマンド
-- ============================================================

-- 1. 受注ヘッダーテーブル（注文単位）
CREATE TABLE IF NOT EXISTS `hankoya-store-analytics.ec_analytics.rakuten_orders`
(
  order_number    STRING    NOT NULL OPTIONS(description='楽天注文番号'),
  order_date      TIMESTAMP NOT NULL OPTIONS(description='注文日時(JST)'),
  order_date_jst  DATE      NOT NULL OPTIONS(description='注文日(JST) パーティション列'),
  order_progress  INT64              OPTIONS(description='注文ステータス: 300=発送待, 400=発送済, 700=キャンセル'),
  customer_id     STRING             OPTIONS(description='楽天会員ID'),
  subtotal_price  INT64              OPTIONS(description='商品合計金額(税込)'),
  postage         INT64              OPTIONS(description='送料'),
  charge          INT64              OPTIONS(description='手数料'),
  total_price     INT64              OPTIONS(description='注文合計金額'),
  point_used      INT64              OPTIONS(description='使用ポイント数'),
  coupon_discount INT64              OPTIONS(description='クーポン割引額'),
  settlement_name STRING             OPTIONS(description='支払い方法'),
  delivery_pref   STRING             OPTIONS(description='配送先都道府県'),
  is_new_customer BOOL               OPTIONS(description='新規顧客フラグ'),
  inserted_at     TIMESTAMP NOT NULL OPTIONS(description='BQ書き込み日時')
)
PARTITION BY order_date_jst
CLUSTER BY order_number
OPTIONS(
  description='楽天市場 受注ヘッダー (注文単位)',
  require_partition_filter = false
);

-- 2. 受注明細テーブル（商品単位）
CREATE TABLE IF NOT EXISTS `hankoya-store-analytics.ec_analytics.rakuten_order_items`
(
  order_number   STRING    NOT NULL OPTIONS(description='楽天注文番号'),
  order_date_jst DATE      NOT NULL OPTIONS(description='注文日(JST) パーティション列'),
  package_id     STRING             OPTIONS(description='パッケージID（配送単位）'),
  item_id        STRING    NOT NULL OPTIONS(description='商品番号(RMS管理番号)'),
  item_name      STRING             OPTIONS(description='商品名'),
  item_option    STRING             OPTIONS(description='商品オプション'),
  unit_price     INT64              OPTIONS(description='販売単価(税込)'),
  quantity       INT64              OPTIONS(description='注文数量'),
  item_total     INT64              OPTIONS(description='商品合計金額'),
  point_amount   INT64              OPTIONS(description='付与ポイント数'),
  inserted_at    TIMESTAMP NOT NULL OPTIONS(description='BQ書き込み日時')
)
PARTITION BY order_date_jst
CLUSTER BY item_id, order_number
OPTIONS(
  description='楽天市場 受注明細 (商品単位)',
  require_partition_filter = false
);

-- 確認クエリ
SELECT 'rakuten_orders' AS table_name, COUNT(*) AS rows FROM `hankoya-store-analytics.ec_analytics.rakuten_orders`
UNION ALL
SELECT 'rakuten_order_items', COUNT(*) FROM `hankoya-store-analytics.ec_analytics.rakuten_order_items`;
