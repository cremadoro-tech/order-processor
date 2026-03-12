/**
 * sheets.js - Google Sheets 書き込みユーティリティ
 *
 * 各ECサイトから取得したデータを以下のシート構成で書き込む：
 *   - 日次データ: 日付 × サイト別の詳細データ（追記）
 *   - 月次サマリー: 月ごとの集計（更新）
 */

import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../../../.env');

// .env を手動パース（googleapis用）
function loadEnv() {
  const content = readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

/**
 * Google Sheets クライアントを初期化する
 * @returns {Promise<import('googleapis').sheets_v4.Sheets>}
 */
export async function getSheetsClient() {
  const env = loadEnv();

  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  );

  // 保存済みトークンを読み込む（初回はlogin-helperで取得）
  const tokenPath = join(__dirname, '../../.cookies/google-token.json');
  try {
    const token = JSON.parse(readFileSync(tokenPath, 'utf-8'));
    auth.setCredentials(token);

    // トークン更新イベント
    auth.on('tokens', (tokens) => {
      writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
    });
  } catch {
    throw new Error(
      'Google認証トークンがありません。先に `node ec/login-helper.js --google` を実行してください。'
    );
  }

  return google.sheets({ version: 'v4', auth });
}

/**
 * 指定シートから、日付が一致する既存行を削除する
 * @param {string} spreadsheetId
 * @param {string} sheetName - シート名（例: '楽天', 'Yahoo!', 'Amazon', '日次データ'）
 * @param {string|string[]} targetDates - 削除対象の日付（複数可）。フォーマットは 'YYYY/M/D' など
 * @param {object} [options]
 * @param {string} [options.siteFilter] - 日次データシート用: サイト名でもフィルタ（B列）
 */
async function deleteRowsByDate(spreadsheetId, sheetName, targetDates, options = {}) {
  const sheets = await getSheetsClient();
  const dates = Array.isArray(targetDates) ? targetDates : [targetDates];

  // 日付を正規化（ゼロ埋めなし）して比較用セットを作る
  const normalizeDate = (s) => {
    if (!s) return '';
    const d = new Date(String(s).replace(/\//g, '-'));
    if (isNaN(d.getTime())) return String(s).trim();
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };
  const dateSet = new Set(dates.map(normalizeDate));

  // シートIDを取得
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = meta.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheetMeta) return;
  const sheetId = sheetMeta.properties.sheetId;

  // A列（+B列）を読み取り
  const maxCol = options.siteFilter ? 'B' : 'A';
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:${maxCol}`,
  });
  const rows = res.data.values || [];

  // 削除対象の行インデックスを収集（末尾から削除するため逆順ソート）
  const rowsToDelete = [];
  for (let i = 1; i < rows.length; i++) { // ヘッダー(i=0)はスキップ
    const cellDate = normalizeDate(rows[i][0]);
    if (!dateSet.has(cellDate)) continue;
    if (options.siteFilter && (rows[i][1] || '').trim() !== options.siteFilter) continue;
    rowsToDelete.push(i);
  }

  if (rowsToDelete.length === 0) return;

  // 末尾から削除（インデックスがずれないように）
  rowsToDelete.sort((a, b) => b - a);
  const requests = rowsToDelete.map(rowIdx => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: rowIdx, endIndex: rowIdx + 1 },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  console.log(`[Sheets] ${sheetName}: ${rowsToDelete.length}行の重複データを削除しました`);
}

/**
 * 日次データシートに1行追記する
 * @param {string} spreadsheetId
 * @param {object} record - 書き込むデータ
 * @param {string} record.date          - 日付 (YYYY/MM/DD)
 * @param {string} record.site          - サイト名
 * @param {number} record.orders        - 注文数
 * @param {number} record.revenue       - 売上高（円）
 * @param {number} [record.sessions]    - セッション数（任意）
 * @param {number} [record.adCost]      - 広告費（任意）
 * @param {string} [record.memo]        - メモ（任意）
 */
export async function appendDailyRecord(spreadsheetId, record) {
  const sheets = await getSheetsClient();

  const row = [
    record.date,
    record.site,
    record.orders,
    record.revenue,
    record.sessions ?? '',
    record.adCost ?? '',
    record.memo ?? '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: '日次データ!A:G',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  console.log(`[Sheets] 日次データを書き込みました: ${record.date} / ${record.site}`);
}

/**
 * 複数サイトのデータをまとめて書き込む
 * @param {string} spreadsheetId
 * @param {object[]} records
 */
export async function appendMultipleDailyRecords(spreadsheetId, records) {
  const sheets = await getSheetsClient();

  // 重複削除: 各レコードの日付+サイトに一致する既存行を削除
  for (const r of records) {
    await deleteRowsByDate(spreadsheetId, '日次データ', r.date, { siteFilter: r.site });
  }

  const rows = records.map(r => [
    r.date,
    r.site,
    r.orders,
    r.revenue,
    r.sessions ?? '',
    r.adCost ?? '',
    r.memo ?? '',
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: '日次データ!A:G',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });

  console.log(`[Sheets] ${records.length}件の日次データを書き込みました`);
}

/**
 * 楽天タブに1行追記する
 * 列構成: 日付 | 曜日 | 売上金額 | アクセス人数 | 転換率 | 客単価 | 受注件数
 * @param {string} spreadsheetId
 * @param {object} record - fetchRakutenData の戻り値
 */
export async function appendRakutenRecord(spreadsheetId, record) {
  const sheets = await getSheetsClient();

  // 日付フォーマット: YYYY/M/D (ゼロ埋めなし、既存データに合わせる)
  const d = new Date(String(record.date).replace(/-/g, '/'));
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  const dowStr = DOW[d.getDay()];

  // 重複削除
  await deleteRowsByDate(spreadsheetId, '楽天', dateStr);

  const row = [
    dateStr,                        // A: 日付
    dowStr,                         // B: 曜日
    record.revenue ?? '',           // C: 売上金額（すべて）
    record.sessions ?? '',          // D: アクセス人数（すべて）
    record.conversionRate ?? '',    // E: 転換率（すべて）
    record.avgOrderValue ?? '',     // F: 客単価（すべて）
    record.orders ?? '',            // G: 受注件数
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: '楽天!A:G',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  console.log(`[Sheets] 楽天データを書き込みました: ${dateStr} 売上¥${(record.revenue || 0).toLocaleString()}`);
}

/**
 * Yahooタブに1行追記する
 * ヘッダー行を読んで列位置を動的に決定するため、列順の変更に対応できる
 * @param {string} spreadsheetId
 * @param {object} record - fetchYahooData の戻り値
 */
export async function appendYahooRecord(spreadsheetId, record) {
  const sheets = await getSheetsClient();

  // 重複削除
  const yd = new Date(String(record.date).replace(/-/g, '/'));
  const yDateStr = `${yd.getFullYear()}/${yd.getMonth() + 1}/${yd.getDate()}`;
  await deleteRowsByDate(spreadsheetId, 'Yahoo', yDateStr);

  // 1行目のヘッダーを読んで列インデックスを特定
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Yahoo!1:1',
  });
  const headers = (headerRes.data.values?.[0] || []);

  const col = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
  const dateCol    = col(['日付', '日時']);
  const dowCol     = col(['曜日']);
  const revenueCol = col(['売上合計値', '売上金額', '売上高']);
  const ordersCol  = col(['注文者数合計', '注文数合計', '注文件数', '受注件数']);
  const sessionsCol = col(['訪問者数', 'セッション合計', 'ページビュー', 'アクセス']);
  const cvrCol     = col(['平均購買率', '転換率', 'CVR']);
  const aovCol     = col(['平均客単価', '客単価', '単価']);

  // 日付フォーマット（YYYY/M/D、ゼロ埋めなし）と曜日
  const d = new Date(String(record.date).replace(/-/g, '/'));
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  const dowStr  = DOW[d.getDay()];

  // ヘッダーの列数分の空配列を作りデータを埋める
  const maxCol = Math.max(dateCol, dowCol, revenueCol, ordersCol, sessionsCol, cvrCol, aovCol) + 1;
  const row = new Array(Math.max(maxCol, 7)).fill('');
  if (dateCol    >= 0) row[dateCol]    = dateStr;
  if (dowCol     >= 0) row[dowCol]     = dowStr;
  if (revenueCol >= 0) row[revenueCol] = record.revenue       ?? '';
  if (ordersCol  >= 0) row[ordersCol]  = record.orders        ?? '';
  if (sessionsCol >= 0) row[sessionsCol] = record.sessions    ?? '';
  if (cvrCol     >= 0) row[cvrCol]     = record.conversionRate ?? '';
  if (aovCol     >= 0) row[aovCol]     = record.avgOrderValue  ?? '';

  // ヘッダーが取れない場合（シートが空）はデフォルト列順で書く
  if (headers.length === 0) {
    row.splice(0, row.length,
      dateStr, dowStr,
      record.revenue       ?? '',
      record.orders        ?? '',
      record.sessions      ?? '',
      record.conversionRate ?? '',
      record.avgOrderValue  ?? '',
    );
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Yahoo!A:A',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  console.log(`[Sheets] Yahooデータを書き込みました: ${dateStr} 売上¥${(record.revenue || 0).toLocaleString()}`);
}

/**
 * Amazonタブに1行追記する
 * CSVのヘッダーとシートのヘッダーを突き合わせて列位置を自動決定する
 * @param {string} spreadsheetId
 * @param {object} csvRecord - fetchAmazonData が返す CSV 1行分（ヘッダー名→値のオブジェクト）
 */
export async function appendAmazonRecord(spreadsheetId, csvRecord) {
  const sheets = await getSheetsClient();

  // 重複削除
  const ad = new Date(String(csvRecord.date).replace(/-/g, '/'));
  const aDateStr = `${ad.getFullYear()}/${ad.getMonth() + 1}/${ad.getDate()}`;
  await deleteRowsByDate(spreadsheetId, 'Amazon', aDateStr);

  // Amazonシートのヘッダーを読む
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Amazon!1:1',
  });
  const sheetHeaders = headerRes.data.values?.[0] ?? [];

  // CSVのキーとシートのヘッダーを正規化して突き合わせ
  const normalize = (s) => String(s).replace(/\s+/g, '').replace(/　/g, '');

  // シートの列数分の空行を作りデータを埋める
  const row = new Array(sheetHeaders.length).fill('');

  // A列（日付）は固定
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(String(csvRecord.date).replace(/-/g, '/'));
  const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  row[0] = dateStr;

  // CSV の各キーをシートのヘッダーに照合して書き込む
  for (const [csvKey, csvVal] of Object.entries(csvRecord)) {
    if (csvKey === 'date' || csvKey === 'site') continue;
    const normKey = normalize(csvKey);
    const sheetIdx = sheetHeaders.findIndex(h => normalize(h) === normKey);
    if (sheetIdx >= 1) {
      row[sheetIdx] = csvVal ?? '';
    }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Amazon!A:A',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  console.log(`[Sheets] Amazonデータを書き込みました: ${dateStr}`);
}

/**
 * GMタブに1行追記する
 * 列構成: 日付 | 受注件数合計 | 新規顧客合計 | 販売点数合計 | 売上合計
 *         | Yahoo! 受注/新規/点数/売上 | Qoo10... | auPAY... | Shopify... | ギフトモール...
 *
 * @param {string} spreadsheetId
 * @param {object} record
 * @param {string} record.date   - 'YYYY/M/D'
 * @param {object} record.total  - { orders, newCustomers, items, revenue }
 * @param {object} record.stores - { 'ストア名': { orders, newCustomers, items, revenue } }
 */
export async function appendGMRecord(spreadsheetId, record) {
  const sheets = await getSheetsClient();

  // 重複削除
  await deleteRowsByDate(spreadsheetId, 'GM', record.date);

  // GMシートのヘッダーを読む
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'GM!1:1',
  });
  const headers = headerRes.data.values?.[0] ?? [];

  const row = new Array(headers.length).fill('');

  // A列: 日付
  const dateIdx = headers.findIndex(h => h === '日付' || h.includes('日付'));
  row[dateIdx >= 0 ? dateIdx : 0] = record.date;

  const total = record.total ?? {};
  const metricMap = {
    orders:       ['受注件数', '注文件数'],
    newCustomers: ['新規顧客'],
    items:        ['販売点数'],
    revenue:      ['売上'],
  };

  headers.forEach((h, i) => {
    if (i === 0) return;

    // 合計列: "受注件数 合計" / "売上 合計" など（ストア名を含まない）
    if (h.includes('合計')) {
      for (const [key, keywords] of Object.entries(metricMap)) {
        if (keywords.some(k => h.includes(k))) {
          row[i] = total[key] ?? '';
          return;
        }
      }
    }

    // ストア列: "ストア名 指標名" の形式
    const stores = record.stores ?? {};
    for (const [storeName, storeData] of Object.entries(stores)) {
      if (h.startsWith(storeName) || h.includes(storeName)) {
        for (const [key, keywords] of Object.entries(metricMap)) {
          if (keywords.some(k => h.includes(k))) {
            row[i] = storeData[key] ?? '';
            return;
          }
        }
      }
    }
  });

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'GM!A:A',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  // 書き込まれた行番号を取得してZ〜AM列に数式を挿入
  // appendRes.data.updates.updatedRange 例: "GM!A791:AM791"
  const updatedRange = appendRes.data.updates?.updatedRange ?? '';
  const rowMatch = updatedRange.match(/!.*?(\d+)/);
  if (rowMatch) {
    const r = parseInt(rowMatch[1], 10);
    const formulas = [
      `= Y${r} / XLOOKUP(EDATE(A${r}, -12), A:A, Y:Y)`,
      `=IFERROR(SUMIFS($Y:$Y,$A:$A,">="&EOMONTH($A${r},-1)+1,$A:$A,"<="&$A${r})/SUMIFS($Y:$Y,$A:$A,">="&EOMONTH(EDATE($A${r},-12),-1)+1,$A:$A,"<="&EDATE($A${r},-12)),"-")`,
      `=SUMIFS($Y:$Y,$A:$A,">="&EOMONTH(EDATE($A${r},-12),-1)+1,$A:$A,"<="&EDATE($A${r},-12))`,
      `= M${r} / XLOOKUP(EDATE(A${r}, -12), A:A, M:M)`,
      `=IFERROR(SUMIFS($M:$M,$A:$A,">="&EOMONTH($A${r},-1)+1,$A:$A,"<="&$A${r})/SUMIFS($M:$M,$A:$A,">="&EOMONTH(EDATE($A${r},-12),-1)+1,$A:$A,"<="&EDATE($A${r},-12)),"-")`,
      `=SUMIFS($M:$M,$A:$A,">="&EOMONTH(EDATE($A${r},-12),-1)+1,$A:$A,"<="&EDATE($A${r},-12))`,
      `= Q${r} / XLOOKUP(EDATE(A${r}, -12), A:A, Q:Q)`,
      `=IFERROR(SUMIFS($Q:$Q,$A:$A,">="&EOMONTH($A${r},-1)+1,$A:$A,"<="&$A${r})/SUMIFS($Q:$Q,$A:$A,">="&EOMONTH(EDATE($A${r},-12),-1)+1,$A:$A,"<="&EDATE($A${r},-12)),"-")`,
      `=SUMIFS($Q:$Q,$A:$A,">="&EOMONTH(EDATE($A${r},-12),-1)+1,$A:$A,"<="&EDATE($A${r},-12))`,
      `= U${r} / XLOOKUP(EDATE(A${r}, -12), A:A, U:U)`,
      `=IFERROR(SUMIFS($U:$U,$A:$A,">="&EOMONTH($A${r},-1)+1,$A:$A,"<="&$A${r})/SUMIFS($U:$U,$A:$A,">="&EOMONTH(EDATE($A${r},-12),-1)+1,$A:$A,"<="&EDATE($A${r},-12)),"-")`,
      `=SUMIFS($U:$U,$A:$A,">="&EOMONTH(EDATE($A${r},-12),-1)+1,$A:$A,"<="&EDATE($A${r},-12))`,
      `=M${r}+Q${r}+U${r}+Y${r}`,
      `=J${r}+N${r}+R${r}+V${r}`,
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `GM!Z${r}:AM${r}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [formulas] },
    });
    console.log(`[Sheets] GMデータを書き込みました: ${record.date} 売上合計¥${(total.revenue || 0).toLocaleString()} (行${r})`);
  } else {
    console.log(`[Sheets] GMデータを書き込みました: ${record.date} 売上合計¥${(total.revenue || 0).toLocaleString()}`);
  }
}

/**
 * 指定シートのA列から最後の日付を取得する
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @returns {Promise<string|null>} - 最後の日付文字列（'YYYY-MM-DD'形式に正規化）
 */
export async function getLastDateInSheet(spreadsheetId, sheetName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });
  const rows = res.data.values || [];

  // 最後の日付を探す（末尾から逆順で最初に見つかった日付）
  for (let i = rows.length - 1; i >= 1; i--) {
    const cell = (rows[i][0] || '').trim();
    if (!cell) continue;
    // 日付としてパース可能かチェック（YYYY/M/D or YYYY-MM-DD）
    const d = new Date(cell.replace(/\//g, '-'));
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return null;
}

/**
 * スプレッドシートのシートが存在しなければ作成する
 * @param {string} spreadsheetId
 * @param {string[]} sheetNames
 */
export async function ensureSheets(spreadsheetId, sheetNames) {
  const sheets = await getSheetsClient();

  const { data } = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = data.sheets.map(s => s.properties.title);

  const toCreate = sheetNames.filter(name => !existingSheets.includes(name));
  if (toCreate.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: toCreate.map(title => ({
        addSheet: { properties: { title } },
      })),
    },
  });

  // 日次データシートのヘッダーを設定
  if (toCreate.includes('日次データ')) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '日次データ!A1:G1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['日付', 'サイト', '注文数', '売上高（円）', 'セッション数', '広告費（円）', 'メモ']],
      },
    });
  }

  console.log(`[Sheets] シートを作成しました: ${toCreate.join(', ')}`);
}

/**
 * 楽天シートから既存の日付一覧を取得
 * @param {string} spreadsheetId
 * @returns {Promise<string[]>} - 既存データの日付リスト（'2026/3/3' 形式）
 */
export async function getRakutenExistingDates(spreadsheetId) {
  const sheets = await getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '楽天!A:A',
    });
    const rows = res.data.values || [];
    const dates = [];
    for (let i = 1; i < rows.length; i++) {
      const dateStr = (rows[i][0] || '').trim();
      if (dateStr && dateStr !== '日付' && !dateStr.includes('月')) {
        dates.push(dateStr);
      }
    }
    return dates;
  } catch {
    return [];
  }
}

/**
 * 楽天シートから指定行のデータを取得
 * @param {string} spreadsheetId
 * @param {number} rowNum - 行番号（1ベース）
 * @returns {Promise<string[]>} - その行のデータ
 */
export async function getRakutenRowData(spreadsheetId, rowNum) {
  const sheets = await getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `楽天!A${rowNum}:M${rowNum}`,
    });
    return res.data.values?.[0] || [];
  } catch {
    return [];
  }
}

/**
 * 楽天シートの空欄セルを補填（前日の値を使用）
 * @param {string} spreadsheetId
 */
export async function fillRakutenEmptyCells(spreadsheetId) {
  const sheets = await getSheetsClient();
  try {
    // 楽天シートのすべてのデータを取得
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '楽天!A:M',
    });
    const rows = res.data.values || [];
    if (rows.length < 3) return; // ヘッダー + 最低1行以上必要

    const updates = [];
    let prevRowData = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const dateStr = (row[0] || '').trim();

      // 日付がない行はスキップ
      if (!dateStr || dateStr.includes('月')) continue;

      // D～M列（インデックス3～12）をチェック
      let needsUpdate = false;
      for (let colIdx = 3; colIdx <= 12; colIdx++) {
        if (!row[colIdx] || row[colIdx] === '') {
          // 前日の値がある場合は補填
          if (prevRowData && prevRowData[colIdx]) {
            row[colIdx] = prevRowData[colIdx];
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        updates.push({
          range: `楽天!A${i + 1}:M${i + 1}`,
          values: [row],
        });
      }

      prevRowData = row;
    }

    // バッチ更新
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          data: updates,
          valueInputOption: 'USER_ENTERED',
        },
      });
      console.log(`[Sheets] 楽天シートの ${updates.length} 行を補填しました`);
    }
  } catch (err) {
    console.log(`[Sheets] 空欄補填エラー: ${err.message}`);
  }
}
