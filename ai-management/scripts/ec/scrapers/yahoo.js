/**
 * yahoo.js - Yahoo!ショッピング 売上データ取得
 *
 * 取得方法：販売管理 > 全体分析 > 日次 > 売り上げ実績CSVダウンロード
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { launchBrowser, saveCookies, loadCookies } from '../utils/browser.js';
import { appendYahooRecord } from '../utils/sheets.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

const SITE = 'Yahoo!';
const STORE_ID = process.env.YAHOO_STORE_ID || 'pro.hankoya-store-7';
const STORE_URL = `https://pro.store.yahoo.co.jp/${STORE_ID}`;
const LOGIN_URL = 'https://login.yahoo.co.jp/config/login';
const SPREADSHEET_ID = '1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw';

/**
 * Yahoo! ストアクリエイターProにログイン済みか確認
 */
async function checkLoggedIn(page) {
  return await page.evaluate(() => {
    const url = window.location.href;
    return url.includes('pro.store.yahoo.co.jp') && !url.includes('login.yahoo.co.jp');
  }).catch(() => false);
}

/**
 * CSVテキスト（ダブルクォート対応）を行×列の配列に変換
 */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    const cells = [];
    let inQuote = false;
    let cell = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cells.push(cell); cell = ''; }
      else { cell += ch; }
    }
    cells.push(cell);
    return cells;
  });
}

/**
 * バッファをShift-JIS → UTF-8 でデコード（Node.js 組み込みTextDecoderを使用）
 */
function decodeBuffer(buffer) {
  try {
    return new TextDecoder('shift-jis').decode(buffer);
  } catch {
    return buffer.toString('utf-8');
  }
}

/**
 * CSVの行データから対象日のデータを抽出
 */
function extractFromCsv(rows, date) {
  if (rows.length < 2) return emptyResult(date);

  const headers = rows[0];
  logger.info(SITE, `CSVヘッダー: ${headers.join(' | ')}`);

  // より詳細なキーワードから順に検索（部分一致の優先度を制御）
  const colStrict = (keywords) => {
    for (const kw of keywords) {
      const idx = headers.findIndex(h => h.includes(kw));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const dateCol    = colStrict(['日付', '日時', '年月日']);
  const revenueCol = colStrict(['合算値売上合計値', '合算値売上', '売上合計値', '売上金額', '売上高']);
  const ordersCol  = colStrict(['注文者数合計', '注文数合計', '注文件数', '受注件数']);
  const sessionsCol = colStrict(['合算値ページビュー', '訪問者数', 'セッション合計', 'ページビュー']);
  const cvrCol     = colStrict(['平均購買率', '転換率', 'CVR']);
  const aovCol     = colStrict(['平均客単価', '客単価', '単価']);

  if (dateCol < 0) {
    logger.info(SITE, `日付列が見つかりません。ヘッダー: ${headers.join(', ')}`);
    return emptyResult(date);
  }

  // 複数の日付フォーマットに対応
  const targets = [
    date.replace(/-/g, '/'),          // 2026/03/01
    dayjs(date).format('YYYY/M/D'),   // 2026/3/1
    date,                              // 2026-03-01
  ];

  const parseNum = (v) => {
    if (!v) return null;
    const n = parseFloat(v.replace(/[¥,%\s,]/g, ''));
    return isNaN(n) ? null : n;
  };

  for (const row of rows.slice(1)) {
    const dateCell = (row[dateCol] || '').trim();
    if (targets.some(t => dateCell.startsWith(t) || dateCell === t)) {
      return {
        date: dayjs(date).format('YYYY/M/D'),
        site: SITE,
        revenue:        revenueCol  >= 0 ? parseNum(row[revenueCol])  : null,
        orders:         ordersCol   >= 0 ? parseNum(row[ordersCol])   : null,
        sessions:       sessionsCol >= 0 ? parseNum(row[sessionsCol]) : null,
        conversionRate: cvrCol      >= 0 ? parseNum(row[cvrCol])      : null,
        avgOrderValue:  aovCol      >= 0 ? parseNum(row[aovCol])      : null,
      };
    }
  }

  logger.info(SITE, `対象日 ${date} のデータがCSVに見つかりません`);
  return emptyResult(date);
}

function emptyResult(date) {
  return {
    date: dayjs(date).format('YYYY/M/D'),
    site: SITE,
    revenue: null, orders: null, sessions: null,
    conversionRate: null, avgOrderValue: null,
  };
}

/**
 * 指定日のYahoo!ショッピング売上データを取得する
 */
export async function fetchYahooData(date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'yahoo' });

  try {
    logger.start(SITE, `${date} のデータをストアクリエイターProから取得中...`);

    // 1. 保存済みクッキーを復元
    await loadCookies(context, 'yahoo');

    // 2. ログイン確認
    await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);

    let loggedIn = await checkLoggedIn(page);

    if (!loggedIn) {
      logger.info(SITE, 'セッション切れ。Yahoo! IDでログインしてください...');
      console.log('   ブラウザでYahoo! IDにログインしてください。完了後、自動で続行します。');
      await context.clearCookies();
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.bringToFront();
      const { execSync } = await import('child_process');
      execSync('osascript -e \'tell application "Google Chrome" to activate\'').toString().trim().catch?.(() => {});

      const deadline = Date.now() + 300000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(2000);
        loggedIn = await checkLoggedIn(page);
        if (loggedIn) { logger.info(SITE, `ログイン完了: ${page.url()}`); break; }
      }
      if (!loggedIn) throw new Error('ログインタイムアウト。Yahoo! IDにログインし直してください。');
      await saveCookies(context, 'yahoo');
      await page.waitForTimeout(2000);
    }

    // 3. 全体分析ページへナビゲート
    // 販売管理 > 全体分析ページへ直接遷移
    const OVERALL_URL = `${STORE_URL}/sales_manage/overall`;
    logger.info(SITE, `全体分析へアクセス: ${OVERALL_URL}`);
    await page.goto(OVERALL_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(4000);

    if (!page.url().includes('sales_manage/overall') && !page.url().includes('overall')) {
      throw new Error(`全体分析ページへの遷移に失敗しました。現在URL: ${page.url()}`);
    }

    // 4. 「日次」タブへ切り替え
    for (const sel of [
      'a:has-text("日次")',
      'button:has-text("日次")',
      '[data-tab="day"]',
      'li:has-text("日次") a',
    ]) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          await page.waitForTimeout(2000);
          logger.info(SITE, `日次タブ切替: ${sel}`);
          break;
        }
      } catch { /* 次へ */ }
    }

    // 5. 対象日を日付フィルターにセット
    const dateFormatted = dayjs(date).format('YYYY/MM/DD');
    logger.info(SITE, `日付フィルター設定: ${dateFormatted}`);

    for (const sel of [
      'input[name="from"]', 'input[name="startDate"]',
      'input.date-from', '[placeholder*="開始"]', '[placeholder*="from"]',
    ]) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1000 })) {
          await el.fill(dateFormatted);
          break;
        }
      } catch { /* 次へ */ }
    }
    for (const sel of [
      'input[name="to"]', 'input[name="endDate"]',
      'input.date-to', '[placeholder*="終了"]', '[placeholder*="to"]',
    ]) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1000 })) {
          await el.fill(dateFormatted);
          break;
        }
      } catch { /* 次へ */ }
    }

    // 検索/表示ボタン
    for (const sel of [
      'button:has-text("表示")', 'button:has-text("検索")',
      'input[type="submit"]', 'button[type="submit"]',
    ]) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1000 })) {
          await el.click();
          await page.waitForTimeout(3000);
          break;
        }
      } catch { /* 次へ */ }
    }

    // 6. 売り上げ実績CSVをダウンロード
    logger.info(SITE, '売り上げ実績CSVをダウンロード中...');
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    let downloadClicked = false;
    for (const sel of [
      'a:has-text("売り上げ実績")',
      'a:has-text("売上実績")',
      'button:has-text("売り上げ実績")',
      'a:has-text("CSVダウンロード")',
      'a:has-text("CSV")',
      'button:has-text("CSV")',
      'a[href*=".csv"]',
      'a:has-text("ダウンロード")',
    ]) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          downloadClicked = true;
          logger.info(SITE, `ダウンロードボタンクリック: ${sel}`);
          break;
        }
      } catch { /* 次へ */ }
    }

    if (!downloadClicked) {
      // フレーム内も試す
      for (const frame of page.frames()) {
        for (const sel of ['a:has-text("売り上げ実績")', 'a:has-text("CSV")', 'a:has-text("ダウンロード")']) {
          try {
            const el = frame.locator(sel).first();
            if (await el.isVisible({ timeout: 1000 })) {
              await el.click();
              downloadClicked = true;
              logger.info(SITE, `フレーム内ダウンロードボタンクリック: ${sel}`);
              break;
            }
          } catch { /* 次へ */ }
        }
        if (downloadClicked) break;
      }
    }

    if (!downloadClicked) {
      // デバッグ用：ページ上の全リンク・ボタン・inputをダンプ
      const debug = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        links: Array.from(document.querySelectorAll('a')).map(a => `"${a.innerText.trim().slice(0,50)}" -> ${a.href}`).filter(s => !s.startsWith('"" ->')).slice(0, 40),
        buttons: Array.from(document.querySelectorAll('button,input[type=submit],input[type=button]')).map(b => `[${b.tagName}] "${(b.innerText||b.value||'').trim().slice(0,50)}"`),
        inputs: Array.from(document.querySelectorAll('input,select')).map(i => `type=${i.type} name="${i.name}" id="${i.id}" placeholder="${i.placeholder}"`),
        frames: Array.from(document.querySelectorAll('iframe')).map(f => f.src),
      }));
      console.log('\n[DEBUG] URL:', debug.url);
      console.log('[DEBUG] Title:', debug.title);
      console.log('[DEBUG] Frames:', debug.frames);
      console.log('[DEBUG] Links:\n ' + debug.links.join('\n  '));
      console.log('[DEBUG] Buttons:\n  ' + debug.buttons.join('\n  '));
      console.log('[DEBUG] Inputs:\n  ' + debug.inputs.join('\n  '));
      await page.screenshot({ path: '/tmp/yahoo_debug.png', fullPage: true });
      console.log('[DEBUG] スクリーンショット: /tmp/yahoo_debug.png');
      throw new Error('CSVダウンロードボタンが見つかりません。ページURL: ' + page.url());
    }

    // 7. ダウンロード完了待ち → バッファ読み込み → デコード → パース
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const csvText = decodeBuffer(buffer);

    logger.info(SITE, `CSVダウンロード完了 (${buffer.byteLength} bytes)`);

    const rows = parseCsv(csvText);
    const data = extractFromCsv(rows, date);

    logger.success(SITE, `取得完了: 売上¥${(data.revenue || 0).toLocaleString()}, 注文${data.orders || 0}件`);

    // 8. スプレッドシートの「Yahoo」タブに追記
    await appendYahooRecord(SPREADSHEET_ID, data);

    return data;

  } catch (err) {
    logger.error(SITE, `エラー: ${err.message}`);
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

if (process.argv[1].endsWith('yahoo.js')) {
  const date = process.argv[2] || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  fetchYahooData(date)
    .then(data => { console.log('\n取得結果:', data); })
    .catch(err => { console.error(err.message); process.exit(1); });
}
