/**
 * rakuten.js - 楽天 RMS データツール ブラウザスクレイピング
 *
 * 取得データ：売上金額・アクセス人数・転換率・客単価
 * ページ：店舗カルテ > 分析用レポート > 1-2売上分析_日次
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { launchBrowser, saveCookies, loadCookies } from '../utils/browser.js';
import { appendRakutenRecord, getRakutenExistingDates, getRakutenRowData, fillRakutenEmptyCells } from '../utils/sheets.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

const SITE = '楽天';
const GLOGIN_URL = 'https://glogin.gl.rakuten.co.jp/';
const MAINMENU_URL = 'https://mainmenu.rms.rakuten.co.jp/';
const SPREADSHEET_ID = '1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw';

/**
 * RMSメインメニューにログイン済みかチェック（URL+コンテンツ両方確認）
 */
async function checkRmsLoggedIn(page) {
  return await page.evaluate(() => {
    const url = window.location.href;
    const text = document.body.innerText;
    const isMainMenu = url.includes('mainmenu.rms.rakuten.co.jp');
    const hasError = text.includes('再度ログイン') || text.includes('認証エラー') ||
      text.includes('ご利用規制') || text.includes('R-Loginのログイン画面') ||
      text.includes('login_error') || text.includes('app_login_error');
    return isMainMenu && !hasError;
  }).catch(() => false);
}

/**
 * 指定日の楽天RMS売上データをブラウザで取得する
 */
export async function fetchRakutenData(date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
  // 既存データをチェック（日付があってもデータが空なら再取得する）
  const targetDateSlash = date.replace(/-/g, '/');
  const targetDateNopad = dayjs(date).format('YYYY/M/D');
  try {
    const existingDates = await getRakutenExistingDates(SPREADSHEET_ID);
    const matchIdx = existingDates.findIndex(d => d === targetDateSlash || d === targetDateNopad);
    if (matchIdx >= 0) {
      // その行にデータがあるか確認（C列=売上金額が空ならデータ不完全→再取得）
      const rowData = await getRakutenRowData(SPREADSHEET_ID, matchIdx + 2); // +2: ヘッダー行 + 0-index
      if (rowData[2] && rowData[2] !== '') {
        logger.info(SITE, `${targetDateNopad} は既にデータ入りで存在するためスキップします`);
        return null;
      }
      logger.info(SITE, `${targetDateNopad} は日付のみ存在。データを再取得します`);
    }
  } catch (err) {
    logger.warn(SITE, `既存データチェックをスキップ: ${err.message}`);
  }

  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'rakuten' });

  try {
    logger.start(SITE, `${date} のデータをRMSから取得中...`);

    // 保存済みクッキーを復元してセッションを引き継ぐ
    await loadCookies(context, 'rakuten');

    // まずRMSメインメニューへアクセスしてセッション確認
    await page.goto(MAINMENU_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);

    let loggedIn = await checkRmsLoggedIn(page);

    if (!loggedIn) {
      logger.info(SITE, 'セッション切れ。楽天クッキーをクリアしてR-Loginを開きます...');
      console.log('   ブラウザでR-Login（楽天）にログインしてください。完了後、自動で続行します。');
      await context.clearCookies();
      await page.goto(GLOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      // ブラウザウィンドウを前面に表示
      await page.bringToFront();
      // macOS: Chromeをアクティブにする
      const { execSync } = await import('child_process');
      execSync('osascript -e \'tell application "Google Chrome" to activate\'').toString().trim().catch?.(() => {});

      // Enterキー確認方式でログイン完了を待つ
      console.log('\n⚠️  [楽天] ブラウザでR-Login（2FA含む）を完了してください。');
      console.log('   RMSメインメニューが表示されたら、このターミナルでEnterキーを押してください。');
      const { createInterface } = await import('readline');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      await new Promise(resolve => rl.question('  [楽天] ログイン完了後 [Enter] → ', () => { rl.close(); resolve(); }));
      loggedIn = await checkRmsLoggedIn(page);

      if (!loggedIn) {
        throw new Error('ログインが確認できません。RMSメインメニューまでログインしてからEnterを押してください。');
      }

      // ログイン成功後にクッキーを保存（次回以降のセッション復元用）
      await saveCookies(context, 'rakuten');

      // ログイン後はページを維持 - 現在のURLでデータ分析メニューを操作
      await page.waitForTimeout(2000);
    }

    // メインメニュー上の datatool URLを取得してセッション確立済みのエントリポイントを使う
    // （直接 /datatool/data/report へのアクセスは失敗するため、メインメニュー経由が必要）
    const DATATOOL_TOP = 'https://datatool.rms.rakuten.co.jp/datatool/';
    const REPORT_URL = 'https://datatool.rms.rakuten.co.jp/datatool/data/report';

    const datatoolEntryUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/datatool/?"], a[href*="/datatool/"]');
      return link?.href || null;
    });
    const entryUrl = datatoolEntryUrl || DATATOOL_TOP;

    logger.info(SITE, `datatoolへアクセス: ${entryUrl}`);

    // 新しいタブが開く可能性に備えて監視
    const newPagePromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);

    // datatool エントリポイントへ
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);

    const newPage = await newPagePromise;
    let activePage = newPage || page;
    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded').catch(() => {});
      await newPage.waitForTimeout(2000);
    }

    // datatool内でレポートページへ遷移
    if (!activePage.url().includes('datatool.rms.rakuten.co.jp')) {
      throw new Error(`datatoolへの遷移に失敗しました。現在URL: ${activePage.url()}`);
    }
    await activePage.goto(REPORT_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await activePage.waitForTimeout(3000);

    // datatoolページで「1-2売上分析_日次」レポートを操作
    logger.info(SITE, '「1-2売上分析_日次」レポートを開きます...');
    await clickReport(activePage);
    await activePage.waitForTimeout(3000);

    // 日付範囲を設定（対象日が含まれるよう月の範囲を設定）
    await setDateRange(activePage, date);
    await activePage.waitForTimeout(3000);

    const data = await extractData(activePage, date);
    logger.success(SITE, `取得完了: 売上¥${(data.revenue || 0).toLocaleString()}, アクセス${data.sessions || 0}人`);

    // スプレッドシートの「楽天」タブに追記
    await appendRakutenRecord(SPREADSHEET_ID, data);

    // 空欄補填処理を実行
    await fillRakutenEmptyCells(SPREADSHEET_ID);

    return data;

  } catch (err) {
    logger.error(SITE, `エラー: ${err.message}`);
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * 1-2売上分析_日次 レポートをクリック
 */
async function clickReport(page) {
  const patterns = [
    'text=1-2売上分析_日次',
    'text=売上分析_日次',
    'text=1-2売上分析',
    '[title*="売上分析"]',
    'a:has-text("売上分析")',
    'li:has-text("売上分析")',
    'span:has-text("1-2")',
    'a:has-text("分析用レポート")',
  ];

  for (const selector of patterns) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        logger.info(SITE, `レポート選択: ${selector}`);
        return true;
      }
    } catch {
      // 次を試す
    }
  }

  // フレーム内を試す
  for (const frame of page.frames()) {
    for (const selector of patterns) {
      try {
        const el = frame.locator(selector).first();
        if (await el.isVisible({ timeout: 1000 })) {
          await el.click();
          logger.info(SITE, `フレーム内レポート選択: ${selector}`);
          return true;
        }
      } catch {
        // 次
      }
    }
  }

  logger.info(SITE, 'レポートリンクが見つかりませんでした（現在の表示データを使用）');
  return false;
}

/**
 * 日付範囲を設定する（datepicker-here クラスのテキスト入力に対応）
 * RMS datatoolは「YYYY/MM/DD - YYYY/MM/DD」形式の日付範囲ピッカーを使用
 */
async function setDateRange(page, date) {
  const d = dayjs(date);
  // 月初から月末までの範囲を設定（月次データ表示）
  const monthStart = d.startOf('month').format('YYYY/MM/DD');
  const monthEnd = d.endOf('month').format('YYYY/MM/DD');
  const rangeValue = `${monthStart} - ${monthEnd}`;

  try {
    // datepicker-here クラスのテキスト入力を探す
    const dateInput = page.locator('input.datepicker-here').first();
    if (await dateInput.isVisible({ timeout: 3000 })) {
      const currentVal = await dateInput.inputValue();
      // 既に対象月が設定されている場合はスキップ
      if (currentVal.startsWith(monthStart.substring(0, 7))) {
        logger.info(SITE, `日付範囲は既に設定済み: ${currentVal}`);
        return;
      }
      await dateInput.fill(rangeValue);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      // レポート表示ボタンをクリック
      await page.locator('button:has-text("レポート表示"), input[value*="表示"]').first().click().catch(() => {});
      logger.info(SITE, `日付範囲設定: ${rangeValue}`);
      return;
    }
  } catch {
    // 失敗した場合はスキップ
  }

  logger.info(SITE, '日付入力が見つかりません。現在の表示データを使用します。');
}

/**
 * datatoolの日次売上テーブルから特定日付のデータを抽出する
 * テーブル構造: ヘッダー行（日付,曜日,売上金額（すべて）,アクセス人数（すべて）,転換率（すべて）,客単価（すべて））
 *              + データ行（2026/03/01, 日, 5794197, 42384, 5.99, 2282）
 */
async function extractData(page, date) {
  const d = dayjs(date);
  // 複数フォーマットで照合（ゼロ埋めあり/なし両方）
  const dateVariants = [
    date.replace(/-/g, '/'),        // '2026/03/05'
    d.format('YYYY/M/D'),           // '2026/3/5'
    d.format('M/D'),                // '3/5'
    d.format('MM/DD'),              // '03/05'
  ];

  const result = await page.evaluate(({ dateVariants, dateForSheet }) => {
    function parseNum(text) {
      if (!text) return null;
      const cleaned = text.replace(/[¥,\s%]/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }

    const result = {
      date: dateForSheet,
      site: '楽天',
      revenue: null, sessions: null, conversionRate: null,
      avgOrderValue: null, orders: null, adCost: null,
    };

    // karte-table-data クラスのテーブルを探す
    const tables = document.querySelectorAll('table.karte-table-data, table');
    for (const table of tables) {
      const allRows = Array.from(table.querySelectorAll('tr'));
      if (allRows.length < 2) continue;

      // ヘッダー行を探す（「日付」列を含む行）
      let headerRow = null;
      let headerCells = [];
      for (const row of allRows) {
        const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.innerText.trim());
        if (cells.includes('日付') || cells.some(c => c.includes('売上金額'))) {
          headerRow = row;
          headerCells = cells;
          break;
        }
      }
      if (!headerRow || headerCells.length === 0) continue;

      // 列インデックスを特定
      const dateCol = headerCells.findIndex(h => h === '日付');
      const revenueCol = headerCells.findIndex(h => h.includes('売上金額'));
      const sessionsCol = headerCells.findIndex(h => h.includes('アクセス人数'));
      const cvrCol = headerCells.findIndex(h => h.includes('転換率'));
      const aovCol = headerCells.findIndex(h => h.includes('客単価'));
      const ordersCol = headerCells.findIndex(h => h.includes('売上件数') || h.includes('注文件数'));

      if (dateCol < 0 || revenueCol < 0) continue;

      // 対象日付の行を探す（複数フォーマットで照合）
      for (const row of allRows) {
        if (row === headerRow) continue;
        const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.innerText.trim());
        const dateCell = cells[dateCol] || '';
        const matches = dateVariants.some(v => dateCell === v || dateCell.startsWith(v));
        if (matches) {
          result.revenue = parseNum(cells[revenueCol]);
          if (sessionsCol >= 0) result.sessions = parseNum(cells[sessionsCol]);
          if (cvrCol >= 0) result.conversionRate = parseNum(cells[cvrCol]);
          if (aovCol >= 0) result.avgOrderValue = parseNum(cells[aovCol]);
          if (ordersCol >= 0) result.orders = parseNum(cells[ordersCol]);
          return result;
        }
      }
    }

    return result;
  }, { dateVariants, dateForSheet: date.replace(/-/g, '/') }).catch(() => null);

  return result || {
    date: targetDateSlash, site: '楽天',
    revenue: null, sessions: null, conversionRate: null,
    avgOrderValue: null, orders: null, adCost: null,
  };
}

if (process.argv[1].endsWith('rakuten.js')) {
  const date = process.argv[2] || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  fetchRakutenData(date)
    .then(data => { console.log('\n取得結果:', data); })
    .catch(err => { console.error(err.message); process.exit(1); });
}
