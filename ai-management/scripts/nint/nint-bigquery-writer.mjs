/**
 * nint-bigquery-writer.mjs — NintデータのBigQuery書き込みモジュール
 *
 * スクレイパー (index.js) と CSVインポーター (nint-csv-importer.mjs) の
 * 両方から呼び出される共通モジュール。
 *
 * 認証パターンは rakuten-api/bigquery-writer.mjs を踏襲。
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

const TABLE_RANKINGS      = 'nint_rankings';
const TABLE_TRENDS        = 'nint_trends';
const TABLE_SHOP_ANALYSIS = 'nint_shop_analysis';
const TABLE_GENRE_RANKING = 'nint_genre_ranking';

let _bqClient = null;

/**
 * 認証済みBigQueryクライアントを返す
 */
async function getBqClient() {
  if (_bqClient) return _bqClient;

  let auth;
  try {
    const keyFile = JSON.parse(readFileSync(KEY_FILE, 'utf-8'));
    auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/bigquery'],
    });
  } catch (err) {
    console.warn(`[BQ-Nint] サービスアカウントキーが見つかりません: ${KEY_FILE}`);
    console.warn('[BQ-Nint] Application Default Credentials (gcloud auth) を使用します');
    auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/bigquery'],
    });
  }

  _bqClient = google.bigquery({ version: 'v2', auth });
  return _bqClient;
}

/**
 * BigQuery insertAll (streaming insert) でデータを書き込む
 *
 * @param {string} tableId - テーブル名
 * @param {object[]} rows  - 書き込む行の配列
 * @param {(row: object, idx: number) => string} genInsertId - insertId生成関数
 * @returns {Promise<number>} 書き込んだ件数
 */
async function insertRows(tableId, rows, genInsertId) {
  if (rows.length === 0) return 0;

  const bq = await getBqClient();
  const CHUNK_SIZE = 500;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    const requestBody = {
      rows: chunk.map((row, idx) => ({
        insertId: genInsertId(row, i + idx),
        json: row,
      })),
      skipInvalidRows: false,
      ignoreUnknownValues: false,
    };

    const res = await bq.tabledata.insertAll({
      projectId: PROJECT_ID,
      datasetId: DATASET_ID,
      tableId,
      requestBody,
    });

    const insertErrors = res.data.insertErrors || [];
    if (insertErrors.length > 0) {
      console.error(`[BQ-Nint] insertAll エラー (${tableId}):`, JSON.stringify(insertErrors[0], null, 2));
      throw new Error(`BigQuery insertAll に${insertErrors.length}件のエラーがあります`);
    }

    totalInserted += chunk.length;
    if (rows.length > CHUNK_SIZE) {
      console.log(`[BQ-Nint] ${tableId}: ${totalInserted}/${rows.length}件 書き込み済み`);
    }
  }

  return totalInserted;
}

/**
 * 価格文字列から数値を抽出する
 * 例: "¥1,280" → 1280, "1280円" → 1280, "1,280" → 1280
 * パース失敗時はnullを返す
 *
 * @param {string} priceStr
 * @returns {number|null}
 */
export function parsePrice(priceStr) {
  if (!priceStr || priceStr === '-') return null;
  const digits = priceStr.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;
  const num = parseInt(digits, 10);
  return isNaN(num) ? null : num;
}

/**
 * Nintスクレイパーの reportData をBigQueryに書き込む
 *
 * @param {object} reportData - runNintScraper() の返却値の data プロパティ
 * @param {object} options
 * @param {boolean} options.dryRun - trueの場合書き込まずにログ出力のみ
 * @returns {Promise<{rankingsWritten: number, trendsWritten: number}>}
 */
export async function writeNintDataToBigQuery(reportData, { dryRun = false } = {}) {
  const now = new Date().toISOString();
  const reportDate = reportData.date; // 'YYYY-MM-DD'

  // --- ランキングデータの変換 ---
  const rankingRows = [];
  for (const genre of reportData.genres) {
    for (const item of genre.rankings) {
      rankingRows.push({
        report_date:   reportDate,
        genre:         genre.name,
        rank:          parseInt(item.rank, 10) || 0,
        product_name:  item.name || null,
        price:         item.price || null,
        price_numeric: parsePrice(item.price),
        sales:         item.sales || null,
        keyword:       item.keyword || null,
        inserted_at:   now,
      });
    }
  }

  // --- トレンドキーワードの変換 ---
  const trendRows = reportData.trends.map((keyword, idx) => ({
    report_date:  reportDate,
    keyword:      keyword,
    position:     idx + 1,
    inserted_at:  now,
  }));

  if (dryRun) {
    console.log(`[BQ-Nint DRY-RUN] ランキング ${rankingRows.length}件 / トレンド ${trendRows.length}件 を書き込む予定`);
    if (rankingRows.length > 0) {
      console.log('[BQ-Nint DRY-RUN] サンプル:', JSON.stringify(rankingRows[0], null, 2));
    }
    return { rankingsWritten: rankingRows.length, trendsWritten: trendRows.length };
  }

  // --- 書き込み実行 ---
  console.log(`[BQ-Nint] ランキング ${rankingRows.length}件 書き込み中...`);
  const rankingsWritten = await insertRows(
    TABLE_RANKINGS,
    rankingRows,
    (row) => `${row.report_date}_${row.genre}_${row.rank}`,
  );

  console.log(`[BQ-Nint] トレンド ${trendRows.length}件 書き込み中...`);
  const trendsWritten = await insertRows(
    TABLE_TRENDS,
    trendRows,
    (row) => `${row.report_date}_${row.keyword}`,
  );

  console.log(`[BQ-Nint] 完了: ランキング ${rankingsWritten}件 / トレンド ${trendsWritten}件`);
  return { rankingsWritten, trendsWritten };
}

/**
 * パーセント文字列をFloat値に変換する
 * 例: "30.19%" → 30.19, "0.03%" → 0.03
 */
function parsePct(str) {
  if (!str) return null;
  const num = parseFloat(str.replace(/%/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * 数値文字列をIntegerに変換する（カンマ対応）
 */
function parseIntSafe(str) {
  if (str === undefined || str === null || str === '' || str === '-') return null;
  const num = parseInt(String(str).replace(/[^0-9-]/g, ''), 10);
  return isNaN(num) ? null : num;
}

/**
 * 数値文字列をFloatに変換する
 */
function parseFloatSafe(str) {
  if (str === undefined || str === null || str === '' || str === '-') return null;
  const num = parseFloat(String(str));
  return isNaN(num) ? null : num;
}

/**
 * Nintショップ分析CSVデータをBigQueryに書き込む
 *
 * @param {object} params
 * @param {string} params.reportDate - 'YYYY-MM-DD'
 * @param {string} params.shopName - ショップ名
 * @param {string[]} params.headers - CSVヘッダー
 * @param {string[][]} params.rows - CSVデータ行
 * @param {boolean} params.dryRun
 * @returns {Promise<{written: number}>}
 */
export async function writeShopAnalysisToBigQuery({ reportDate, shopName, headers, rows, dryRun = false }) {
  const now = new Date().toISOString();

  // ヘッダーインデックスマッピング（trim + 部分一致で検索）
  const cleanHeaders = headers.map(s => s.replace(/\r/g, '').trim());
  const h = {};
  cleanHeaders.forEach((name, idx) => { h[name] = idx; });

  // 部分一致ヘルパー（全角/半角括弧の差異を吸収）
  const findCol = (keyword) => {
    const exact = h[keyword];
    if (exact !== undefined) return exact;
    const found = cleanHeaders.findIndex(col => col.includes(keyword));
    return found >= 0 ? found : -1;
  };

  const bqRows = rows.map(row => ({
    report_date:   reportDate,
    shop_name:     shopName,
    product_code:  row[findCol('商品Code')] || null,
    product_name:  row[findCol('商品名')] || null,
    product_url:   row[findCol('商品URL')] || null,
    genre:         row[findCol('ジャンル')] || null,
    price:         parseIntSafe(row[findCol('価格')]),
    has_ad:        row[findCol('広告出稿')] === '有',
    shipping:      row[findCol('送料')] || null,
    in_stock:      row[findCol('在庫')] === '有',
    point_rate:    parseIntSafe(row[findCol('ポイント倍率')]),
    sales_7d:      parseIntSafe(row[cleanHeaders.findIndex(c => c.includes('7日') && c.includes('売上'))]),
    qty_7d:        parseIntSafe(row[cleanHeaders.findIndex(c => c.includes('7日') && c.includes('販売'))]),
    sales_14d:     parseIntSafe(row[cleanHeaders.findIndex(c => c.includes('14日') && c.includes('売上'))]),
    qty_14d:       parseIntSafe(row[cleanHeaders.findIndex(c => c.includes('14日') && c.includes('販売'))]),
    sales_30d:     parseIntSafe(row[cleanHeaders.findIndex(c => c.includes('30日') && c.includes('売上'))]),
    qty_30d:       parseIntSafe(row[cleanHeaders.findIndex(c => c.includes('30日') && c.includes('販売'))]),
    review_count:  parseIntSafe(row[findCol('レビュー数')]),
    rating:        parseFloatSafe(row[findCol('商品評価')]),
    image_url:     row[findCol('画像URL')] || null,
    inserted_at:   now,
  }));

  if (dryRun) {
    console.log(`[BQ-Nint DRY-RUN] ショップ分析 ${bqRows.length}件 を書き込む予定`);
    if (bqRows.length > 0) {
      console.log('[BQ-Nint DRY-RUN] サンプル:', JSON.stringify(bqRows[0], null, 2));
    }
    return { written: bqRows.length };
  }

  console.log(`[BQ-Nint] ショップ分析 ${bqRows.length}件 書き込み中...`);
  const written = await insertRows(
    TABLE_SHOP_ANALYSIS,
    bqRows,
    (row) => `${row.report_date}_${row.shop_name}_${row.product_code}`,
  );

  console.log(`[BQ-Nint] 完了: ショップ分析 ${written}件`);
  return { written };
}

/**
 * Nint業種分析ランキングCSVデータをBigQueryに書き込む
 *
 * @param {object} params
 * @param {string} params.reportDate - 'YYYY-MM-DD'
 * @param {string} params.category - カテゴリ（例: 筆記具）
 * @param {string} params.subcategory - サブカテゴリ（例: 多機能ペン）
 * @param {string[]} params.headers - CSVヘッダー
 * @param {string[][]} params.rows - CSVデータ行
 * @param {boolean} params.dryRun
 * @returns {Promise<{written: number}>}
 */
export async function writeGenreRankingToBigQuery({ reportDate, category, subcategory, headers, rows, dryRun = false }) {
  const now = new Date().toISOString();

  const cleanHeaders = headers.map(s => s.replace(/\r/g, '').trim());
  const h = {};
  cleanHeaders.forEach((name, idx) => { h[name] = idx; });

  const findCol = (keyword) => {
    const exact = h[keyword];
    if (exact !== undefined) return exact;
    const found = cleanHeaders.findIndex(col => col.includes(keyword));
    return found >= 0 ? found : -1;
  };

  const bqRows = rows.map(row => ({
    report_date:     reportDate,
    category:        category,
    subcategory:     subcategory || null,
    rank:            parseIntSafe(row[findCol('Rank')]) || 0,
    product_name:    row[findCol('商品名')] || null,
    product_url:     row[findCol('商品URL')] || null,
    shop_name:       row[findCol('ショップ名')] || null,
    price:           parseIntSafe(row[findCol('価格')]),
    avg_price:       parseIntSafe(row[findCol('平均価格')]),
    sales_amount:    parseIntSafe(row[findCol('売上指数')]) ?? parseIntSafe(row[findCol('売上推数')]),
    sales_qty:       parseIntSafe(row[cleanHeaders.findIndex(c => c.includes('販売量') && !c.includes('シェア'))]),
    sales_share_pct: parsePct(row[findCol('売上シェア')]),
    qty_share_pct:   parsePct(row[findCol('販売量シェア')]),
    review_count:    parseIntSafe(row[findCol('レビュー数')]),
    rating:          parseFloatSafe(row[findCol('商品評価')]),
    image_url:       row[findCol('画像URL')] || null,
    inserted_at:     now,
  }));

  if (dryRun) {
    console.log(`[BQ-Nint DRY-RUN] 業種分析 ${bqRows.length}件 を書き込む予定`);
    if (bqRows.length > 0) {
      console.log('[BQ-Nint DRY-RUN] サンプル:', JSON.stringify(bqRows[0], null, 2));
    }
    return { written: bqRows.length };
  }

  console.log(`[BQ-Nint] 業種分析 ${bqRows.length}件 書き込み中...`);
  const written = await insertRows(
    TABLE_GENRE_RANKING,
    bqRows,
    (row) => `${row.report_date}_${row.category}_${row.subcategory}_${row.rank}`,
  );

  console.log(`[BQ-Nint] 完了: 業種分析 ${written}件`);
  return { written };
}
