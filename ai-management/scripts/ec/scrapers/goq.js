/**
 * goq.js - GoQシステム 売上管理データ取得
 *
 * 取得方法：売上管理（budgetmanager）> 月別日次 売上詳細 > CSVダウンロード
 * URL: https://order.goqsystem.com/goq21/budgetmanager/index.php/#
 *
 * GMシート列構成：
 *   A: 日付
 *   B-E: 合計（受注件数/新規顧客/販売点数/売上）
 *   F-I: Yahoo!ショッピング1号店
 *   J-M: Qoo10店
 *   N-Q: auPAYマーケット
 *   R-U: Shopify 1号店
 *   V-Y: ギフトモール
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { launchBrowser, saveCookies, loadCookies } from '../utils/browser.js';
import { appendGMRecord } from '../utils/sheets.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

const SITE = 'GoQ';
const DASHBOARD_URL = 'https://order.goqsystem.com/goq21/dashboard/';
const BUDGET_URL    = 'https://order.goqsystem.com/goq21/budgetmanager/index.php/';
const LOGIN_URL     = 'https://order.goqsystem.com/goq21/form/goqsystem_new/systemlogin.php';
const SPREADSHEET_ID = '1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw';

// GoQシステムCSV店舗名 → GMシート列名マッピング（CSV名と同名で対応）
// '1号店' キーワードはYahooとShopify両方に一致するため除外し、前半のストア名で区別する
// Yahoo!はストアクリエイターProから直接取得するため、GoQからは除外
const STORE_MAP = [
  { sheetName: 'Qoo10店',                 keywords: ['Qoo10'] },
  { sheetName: 'auPAYマーケット',         keywords: ['auPAY', 'au PAY'] },
  { sheetName: 'Shopify 1号店',           keywords: ['Shopify'] },
  { sheetName: 'ギフトモール',            keywords: ['ギフトモール'] },
];

/**
 * GoQシステムにログイン済みか確認
 */
async function checkLoggedIn(page) {
  return await page.evaluate(() => {
    const url = window.location.href;
    const isOnGoQ = url.includes('order.goqsystem.com/goq21');
    const isLoginPage =
      url.includes('/login') ||
      url.includes('/signin') ||
      url.includes('systemlogin') ||
      url.includes('/form/goqsystem_new/');
    return isOnGoQ && !isLoginPage;
  }).catch(() => false);
}

/**
 * 数値文字列をパース（カンマ・円記号・%除去）
 */
function parseNum(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[¥￥,%\s]/g, '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * CSVテキストを行×列の配列に変換
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cell += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === ',' && !inQuote) {
      row.push(cell.trim()); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(c => c !== '')) rows.push(row); }
  return rows;
}

/**
 * GoQシステムCSVから対象日のストア別データを抽出
 *
 * GoQのCSV構造（想定）:
 *   - ヘッダー行1: 日付, 全店舗合計_受注件数, ..., Yahoo_受注件数, ..., Qoo10_受注件数, ...
 *   - または多段ヘッダー（ストア名行 + 指標名行）
 *   - データ行: 日付, 各値...
 */
function extractFromCsv(rows, date) {
  if (rows.length < 2) return null;

  const d = dayjs(date);
  const dateTargets = [
    date,                           // 2026-03-01
    date.replace(/-/g, '/'),        // 2026/03/01
    d.format('YYYY/M/D'),           // 2026/3/1
    d.format('MM/DD'),              // 03/01
    d.format('M/D'),                // 3/1
    d.format('MM/DD/YYYY'),         // 03/01/2026
  ];

  // ヘッダー行を確認（多段の可能性あり）
  logger.info(SITE, `CSV行数: ${rows.length}`);
  logger.info(SITE, `CSV行0: ${rows[0].slice(0, 10).join(' | ')}`);
  if (rows.length > 1) logger.info(SITE, `CSV行1: ${rows[1].slice(0, 10).join(' | ')}`);

  // ヘッダーが2行の場合（行0がストア名、行1が指標名）を検出
  let headerRow = 0;
  let isMultiHeader = false;
  // 行1が "受注件数" などの指標名を含み、行0がストア名ならマルチヘッダー
  if (rows.length > 2 && rows[1].some(h => h.includes('受注') || h.includes('売上') || h.includes('件数'))) {
    if (rows[0].some(h => h.includes('Yahoo') || h.includes('Qoo') || h.includes('Shop') || h.includes('au') || h.includes('店'))) {
      isMultiHeader = true;
      headerRow = 1;
    }
  }

  let headers;
  let dataStartRow;

  if (isMultiHeader) {
    // 多段ヘッダー: 行0のストア名 + 行1の指標名を組み合わせてフラットな列名を生成
    const storeHeaders = rows[0];
    const metricHeaders = rows[1];
    headers = metricHeaders.map((metric, i) => {
      const store = (storeHeaders[i] || '').trim();
      return store ? `${store}_${metric}` : metric;
    });
    dataStartRow = 2;
  } else {
    headers = rows[headerRow];
    dataStartRow = headerRow + 1;
  }

  logger.info(SITE, `CSV列数: ${headers.length}`);

  // 日付列を特定
  const dateCol = headers.findIndex(h =>
    h === '日付' || h.toLowerCase() === 'date' || h.includes('日付') || h === ''
  );
  if (dateCol < 0 && !headers[0]) {
    // 最初の列が日付（ヘッダーなし）
  }
  const actualDateCol = dateCol >= 0 ? dateCol : 0;

  // 対象日の行を探す
  for (const row of rows.slice(dataStartRow)) {
    const cell = (row[actualDateCol] || '').trim();
    if (dateTargets.some(t => cell === t || cell.startsWith(t))) {
      logger.info(SITE, `対象日行を発見: ${cell}`);

      // ヘッダーと値をオブジェクト化
      const record = {};
      headers.forEach((h, i) => { record[h] = row[i] ?? ''; });

      return { record, headers, row };
    }
  }

  logger.info(SITE, `対象日 ${date} がCSVに見つかりません`);
  logger.info(SITE, `CSVの日付サンプル: ${rows.slice(dataStartRow, dataStartRow + 5).map(r => r[actualDateCol]).join(', ')}`);
  return null;
}

/**
 * CSVレコードからストア別構造に変換
 */
function buildStoreData(csvResult) {
  if (!csvResult) return null;
  const { record, headers } = csvResult;

  const result = {
    total:  { orders: null, newCustomers: null, items: null, revenue: null },
    stores: {},
  };

  // 各ヘッダーを解析してストア・指標を特定
  for (const [key, val] of Object.entries(record)) {
    const k = key.trim();

    // 合計列
    const isTotal = k.includes('合計') || k.startsWith('全店') || k === '' ||
                    (!STORE_MAP.some(s => s.keywords.some(kw => k.includes(kw))) && k.includes('受注'));

    let targetStore = null;
    for (const s of STORE_MAP) {
      if (s.keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) {
        targetStore = s.sheetName;
        break;
      }
    }

    const metric =
      k.includes('受注件数') || k.includes('注文件数') ? 'orders' :
      k.includes('新規顧客')                            ? 'newCustomers' :
      k.includes('販売点数') || k.includes('点数')      ? 'items' :
      (k.includes('売上') && !k.includes('累計'))       ? 'revenue' : null;

    if (!metric) continue;

    if (targetStore) {
      if (!result.stores[targetStore]) {
        result.stores[targetStore] = { orders: null, newCustomers: null, items: null, revenue: null };
      }
      result.stores[targetStore][metric] = parseNum(val);
    } else if (isTotal || k.includes('合計')) {
      result.total[metric] = parseNum(val);
    }
  }

  return result;
}

/**
 * 指定日のGoQシステム売上データを取得する
 */
export async function fetchGoQData(date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'goq' });

  try {
    logger.start(SITE, `${date} のデータをGoQシステムから取得中...`);

    // 1. 保存済みクッキーを復元
    await loadCookies(context, 'goq');

    // 2. ログイン確認
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(4000);

    let loggedIn = await checkLoggedIn(page);

    if (!loggedIn) {
      logger.info(SITE, 'セッション切れ。GoQシステムにログイン中...');
      await context.clearCookies();
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(3000);

      // 自動ログイン（STEP1: ログインID/PW → STEP2: 会員ID/PW）
      const loginId = process.env.GOQ_LOGIN_ID;
      const loginPw = process.env.GOQ_LOGIN_PASSWORD;
      const memberId = process.env.GOQ_MEMBER_ID;
      const memberPw = process.env.GOQ_MEMBER_PASSWORD;

      if (loginId && loginPw && memberId && memberPw) {
        try {
          // STEP1: ログインID・パスワード
          logger.info(SITE, 'STEP1: ログインID・パスワードを入力中...');
          const step1IdField = page.locator('input[name="login_id"], input[name="loginid"], input[type="text"]').first();
          const step1PwField = page.locator('input[name="login_pw"], input[name="loginpw"], input[name="password"], input[type="password"]').first();
          await step1IdField.fill(loginId);
          await step1IdField.dispatchEvent('input');
          await step1IdField.dispatchEvent('change');
          await step1PwField.fill(loginPw);
          await step1PwField.dispatchEvent('input');
          await step1PwField.dispatchEvent('change');
          // ボタンが有効になるまで待機（disabled解除を待つ）
          await page.waitForTimeout(2000);
          const step1Btn = page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン"), button:has-text("次へ")').first();
          await step1Btn.waitFor({ state: 'enabled', timeout: 8000 }).catch(() => {});
          await step1Btn.click({ force: true });
          await page.waitForTimeout(4000);
          logger.info(SITE, 'STEP1完了');

          // STEP2: 会員ID・パスワード
          logger.info(SITE, 'STEP2: 会員ID・パスワードを入力中...');
          const step2IdField = page.locator('input[name="member_id"], input[name="memberid"], input[name="user_id"], input[type="text"]').first();
          const step2PwField = page.locator('input[name="member_pw"], input[name="memberpw"], input[name="password"], input[type="password"]').first();
          await step2IdField.fill(memberId);
          await step2IdField.dispatchEvent('input');
          await step2IdField.dispatchEvent('change');
          await step2PwField.fill(memberPw);
          await step2PwField.dispatchEvent('input');
          await step2PwField.dispatchEvent('change');
          await page.waitForTimeout(2000);
          const step2Btn = page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').first();
          await step2Btn.waitFor({ state: 'enabled', timeout: 8000 }).catch(() => {});
          await step2Btn.click({ force: true });
          await page.waitForTimeout(5000);

          loggedIn = await checkLoggedIn(page);
          if (loggedIn) {
            logger.info(SITE, '自動ログイン成功');
            await saveCookies(context, 'goq');
          }
        } catch (autoLoginErr) {
          logger.warn(SITE, `自動ログイン失敗: ${autoLoginErr.message}`);
        }
      }

      // 自動ログインが失敗した場合は手動ログインを待機
      if (!loggedIn) {
        logger.info(SITE, 'ブラウザでGoQシステムに手動でログインしてください。');
        await page.bringToFront();
        console.log('\n⚠️  [GoQ] ブラウザでGoQシステムにログインしてください。');
        console.log('   ログイン完了後、このターミナルでEnterキーを押してください。');
        const { createInterface } = await import('readline');
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        await new Promise(resolve => rl.question('  [GoQ] ログイン完了後 [Enter] → ', () => { rl.close(); resolve(); }));
        loggedIn = await checkLoggedIn(page);
        if (!loggedIn) throw new Error('ログインが確認できません。GoQのダッシュボードまでログインしてからEnterを押してください。');
        await saveCookies(context, 'goq');
      }
      await page.waitForTimeout(2000);
    }

    // 3. 売上管理ページへ移動
    logger.info(SITE, '売上管理ページへ移動...');
    await page.goto(BUDGET_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    // テーブル要素が描画されるまで待機
    await page.waitForTimeout(6000);

    // 4. 年月セレクターを対象日に設定
    const d = dayjs(date);
    const targetYear = String(d.year()).slice(-2); // 2桁 (例: "26")
    const targetMonth = String(d.month() + 1);    // 月（ゼロ埋めなし）

    // sel_year, sel_month をセット
    try {
      await page.selectOption('select[name="sel_year"]', { label: targetYear }).catch(() =>
        page.selectOption('select[name="sel_year"]', { value: targetYear }).catch(() =>
          page.selectOption('select[name="sel_year"]', { value: d.year().toString() }).catch(() => {})
        )
      );
      await page.selectOption('select[name="sel_month"]', { value: targetMonth }).catch(() =>
        page.selectOption('select[name="sel_month"]', { label: `${d.month() + 1}月` }).catch(() => {})
      );
      logger.info(SITE, `年月設定: ${d.year()}年${d.month() + 1}月`);
    } catch { /* セレクター操作失敗は無視 */ }

    // 「変更」ボタンをクリック
    try {
      const btn = page.locator('button:has-text("変更"), input[value="変更"]').first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(4000);
        logger.info(SITE, '変更ボタンクリック完了');
      }
    } catch { /* 変更ボタンなし */ }

    // 5. CSVダウンロード
    logger.info(SITE, 'CSVをダウンロード中...');
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    let downloadClicked = false;
    for (const sel of [
      'button:has-text("CSVダウンロード")',
      'a:has-text("CSVダウンロード")',
      'button:has-text("CSV")',
      'a:has-text("CSV")',
      'input[value*="CSV"]',
      '[title*="CSV"]',
    ]) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          downloadClicked = true;
          logger.info(SITE, `CSVダウンロードクリック: ${sel}`);
          break;
        }
      } catch { /* 次へ */ }
    }

    if (!downloadClicked) {
      // フレーム内も試す
      for (const frame of page.frames()) {
        for (const sel of ['button:has-text("CSV")', 'a:has-text("CSV")']) {
          try {
            const el = frame.locator(sel).first();
            if (await el.isVisible({ timeout: 1000 })) {
              await el.click();
              downloadClicked = true;
              break;
            }
          } catch { /* 次へ */ }
        }
        if (downloadClicked) break;
      }
    }

    if (!downloadClicked) {
      const debug = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        buttons: Array.from(document.querySelectorAll('button,input[type=submit],input[type=button]'))
          .map(b => `"${(b.textContent || b.value || '').trim().slice(0, 60)}"`),
        selects: Array.from(document.querySelectorAll('select'))
          .map(s => `name="${s.name}" id="${s.id}" options=[${Array.from(s.options).map(o => o.text).join(',')}]`),
      }));
      console.log('\n[DEBUG] URL:', debug.url);
      console.log('[DEBUG] Buttons:\n  ' + debug.buttons.join('\n  '));
      console.log('[DEBUG] Selects:\n  ' + debug.selects.join('\n  '));
      await page.screenshot({ path: '/tmp/goq_debug2.png', fullPage: true });
      throw new Error('CSVダウンロードボタンが見つかりません。ページURL: ' + debug.url);
    }

    // 6. ダウンロード処理
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // GoQのCSVはShift-JIS or UTF-8
    let csvText;
    try { csvText = new TextDecoder('shift-jis').decode(buffer); }
    catch { csvText = buffer.toString('utf-8'); }
    csvText = csvText.replace(/^\uFEFF/, '');

    logger.info(SITE, `CSVダウンロード完了 (${buffer.byteLength} bytes)`);

    // 7. CSVをパースして対象日のデータを抽出
    const rows = parseCsv(csvText);
    const csvResult = extractFromCsv(rows, date);

    if (!csvResult) {
      // 全行ダンプして確認
      console.log('[DEBUG] CSV全ヘッダー:', rows[0]?.join(' | '));
      console.log('[DEBUG] CSV日付列サンプル:', rows.slice(1, 6).map(r => r[0]).join(', '));
      throw new Error(`対象日 ${date} のデータがCSVに見つかりませんでした`);
    }

    const storeData = buildStoreData(csvResult);

    if (!storeData) throw new Error('ストアデータの抽出に失敗しました');

    logger.info(SITE, `合計: 売上¥${(storeData.total.revenue || 0).toLocaleString()}, 受注${storeData.total.orders || 0}件`);
    for (const [name, v] of Object.entries(storeData.stores)) {
      logger.info(SITE, `  ${name}: ¥${(v.revenue || 0).toLocaleString()} / ${v.orders || 0}件`);
    }

    // 8. GMシートに書き込み
    const record = {
      date: d.format('YYYY/M/D'),
      ...storeData,
    };
    await appendGMRecord(SPREADSHEET_ID, record);

    logger.success(SITE, `取得完了: 合計売上 ¥${(storeData.total.revenue || 0).toLocaleString()}`);
    return record;

  } catch (err) {
    logger.error(SITE, `エラー: ${err.message}`);
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

if (process.argv[1].endsWith('goq.js')) {
  const date = process.argv[2] || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  fetchGoQData(date)
    .then(data => { console.log('\n取得結果:', JSON.stringify(data, null, 2)); })
    .catch(err => { console.error(err.message); process.exit(1); });
}
