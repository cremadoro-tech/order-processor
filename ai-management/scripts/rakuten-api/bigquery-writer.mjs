/**
 * bigquery-writer.mjs — BigQueryへの書き込みモジュール
 *
 * googleapis の BigQuery REST API v2 を使用。
 * 認証: サービスアカウントキー (.env の BIGQUERY_KEY_FILE)
 *
 * 重複防止: insertAll は order_number で重複チェック後に書き込む
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

const TABLE_ORDERS = 'rakuten_orders';
const TABLE_ITEMS  = 'rakuten_order_items';

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
    // サービスアカウントキーが見つからない場合はデフォルト認証を試みる
    console.warn(`[BQ] サービスアカウントキーが見つかりません: ${KEY_FILE}`);
    console.warn('[BQ] Application Default Credentials (gcloud auth) を使用します');
    auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/bigquery'],
    });
  }

  _bqClient = google.bigquery({ version: 'v2', auth });
  return _bqClient;
}

/**
 * 既にBigQueryに存在する注文番号リストを取得（重複防止用）
 *
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate   - 'YYYY-MM-DD'
 * @returns {Promise<Set<string>>}
 */
export async function getExistingOrderNumbers(startDate, endDate) {
  const bq = await getBqClient();

  const query = `
    SELECT DISTINCT order_number
    FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ORDERS}\`
    WHERE order_date_jst BETWEEN DATE('${startDate}') AND DATE('${endDate}')
  `;

  try {
    const res = await bq.jobs.query({
      projectId: PROJECT_ID,
      requestBody: {
        query,
        useLegacySql: false,
        timeoutMs: 30000,
      },
    });

    const rows = res.data.rows || [];
    return new Set(rows.map(r => r.f[0].v));
  } catch (err) {
    // テーブルが存在しない場合は空のSetを返す
    if (err.message?.includes('Not found')) return new Set();
    throw err;
  }
}

/**
 * BigQuery insertAll (streaming insert) でデータを書き込む
 *
 * @param {string} tableId - テーブル名
 * @param {object[]} rows  - 書き込む行の配列
 * @returns {Promise<number>} 書き込んだ件数
 */
async function insertRows(tableId, rows) {
  if (rows.length === 0) return 0;

  const bq = await getBqClient();

  // BigQueryのinsertAll上限は1リクエスト10MBなので500件ずつに分割
  const CHUNK_SIZE = 500;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    const requestBody = {
      rows: chunk.map((row, idx) => ({
        // insertId で重複防止（同じinsertIdはBQ側が自動的に除外）
        insertId: `${row.order_number || `row_${i + idx}`}_${tableId}`,
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
      console.error(`[BQ] insertAll エラー (${tableId}):`, JSON.stringify(insertErrors[0], null, 2));
      throw new Error(`BigQuery insertAll に${insertErrors.length}件のエラーがあります`);
    }

    totalInserted += chunk.length;
    if (rows.length > CHUNK_SIZE) {
      console.log(`[BQ] ${tableId}: ${totalInserted}/${rows.length}件 書き込み済み`);
    }
  }

  return totalInserted;
}

/**
 * 受注ヘッダーと受注明細をBigQueryに書き込む
 *
 * @param {object[]} orders - 受注ヘッダー行
 * @param {object[]} items  - 受注明細行
 * @param {object}   options
 * @param {boolean}  options.dryRun    - trueの場合書き込まずにログ出力のみ
 * @param {boolean}  options.skipDedup - trueの場合重複チェックをスキップ
 * @param {string}   options.startDate - 重複チェック用の開始日
 * @param {string}   options.endDate   - 重複チェック用の終了日
 * @returns {Promise<{ordersWritten: number, itemsWritten: number}>}
 */
export async function writeOrdersToBigQuery(orders, items, {
  dryRun = false,
  skipDedup = false,
  startDate = null,
  endDate = null,
} = {}) {

  if (orders.length === 0) {
    console.log('[BQ] 書き込むデータなし');
    return { ordersWritten: 0, itemsWritten: 0 };
  }

  let ordersToWrite = orders;
  let itemsToWrite  = items;

  // 重複チェック（既存のorder_numberを除外）
  if (!skipDedup && startDate && endDate) {
    console.log('[BQ] 重複チェック中...');
    const existingNums = await getExistingOrderNumbers(startDate, endDate);

    if (existingNums.size > 0) {
      const beforeCount = ordersToWrite.length;
      ordersToWrite = ordersToWrite.filter(o => !existingNums.has(o.order_number));
      itemsToWrite  = itemsToWrite.filter(i => !existingNums.has(i.order_number));
      console.log(`[BQ] 重複除外: ${beforeCount - ordersToWrite.length}件 (残: ${ordersToWrite.length}件)`);
    }
  }

  if (dryRun) {
    console.log(`[BQ DRY-RUN] 受注ヘッダー ${ordersToWrite.length}件 / 明細 ${itemsToWrite.length}件 を書き込む予定`);
    console.log('[BQ DRY-RUN] サンプル受注:', JSON.stringify(ordersToWrite[0], null, 2));
    return { ordersWritten: ordersToWrite.length, itemsWritten: itemsToWrite.length };
  }

  // 書き込み実行
  console.log(`[BQ] 受注ヘッダー ${ordersToWrite.length}件 書き込み中...`);
  const ordersWritten = await insertRows(TABLE_ORDERS, ordersToWrite);

  console.log(`[BQ] 受注明細 ${itemsToWrite.length}件 書き込み中...`);
  const itemsWritten = await insertRows(TABLE_ITEMS, itemsToWrite);

  console.log(`[BQ] 完了: ヘッダー ${ordersWritten}件 / 明細 ${itemsWritten}件`);
  return { ordersWritten, itemsWritten };
}
