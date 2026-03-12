/**
 * amazon.js - Amazon セラーセントラル 売上データ取得
 *
 * 取得方法：レポート > ビジネスレポート > 売り上げトラフィック > CSVダウンロード
 * レポートID: 102:SalesTrafficTimeSeries
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { launchBrowser, saveCookies, loadCookies } from '../utils/browser.js';
import { appendAmazonRecord } from '../utils/sheets.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

const SITE = 'Amazon';
const SELLER_CENTRAL_URL = 'https://sellercentral.amazon.co.jp';
const LOGIN_URL = 'https://sellercentral.amazon.co.jp/signin';
// 売り上げトラフィック時系列レポート（ユーザー指定URL）
const REPORT_URL = 'https://sellercentral.amazon.co.jp/business-reports/ref=xx_sitemetric_dnav_xx#/report?id=102%3ASalesTrafficTimeSeries&chartCols=5%2F23&columns=0%2F1%2F2%2F3%2F4%2F5%2F6%2F7%2F8%2F9%2F10%2F11%2F12%2F23%2F24%2F27%2F28%2F31';
const SPREADSHEET_ID = '1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw';

/**
 * セラーセントラルにログイン済みか確認
 */
async function checkLoggedIn(page) {
  return await page.evaluate(() => {
    const url = window.location.href;
    const isOnSC = url.includes('sellercentral.amazon.co.jp');
    // /ap/ 以下はすべて Amazon 認証フロー（MFA・パスワード・登録など）
    const isAuthFlow = url.includes('/ap/') || url.includes('/signin');
    return isOnSC && !isAuthFlow;
  }).catch(() => false);
}

/**
 * CSVテキストを行×列の配列に変換（ダブルクォート・改行対応）
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
 * CSVの行データから対象日のデータを抽出
 * Amazon CSVの日付フォーマット候補: "Jan 15, 2024" / "2024-01-15" / "2024/01/15"
 */
function extractFromCsv(rows, date) {
  if (rows.length < 2) return null;

  const headers = rows[0];
  logger.info(SITE, `CSVヘッダー(${headers.length}列): ${headers.slice(0, 5).join(' | ')} ...`);

  // Amazon CSVの日付は "Jan 15, 2024" 形式が多い
  const d = dayjs(date);
  const targets = [
    date.replace(/-/g, '/'),                                      // 2026/03/01
    d.format('YYYY/M/D'),                                         // 2026/3/1
    date,                                                          // 2026-03-01
    d.format('MMM D, YYYY'),                                      // Mar 1, 2026
    d.format('MM/DD/YYYY'),                                       // 03/01/2026
    d.format('M/D/YYYY'),                                         // 3/1/2026
  ];

  const dateCol = headers.findIndex(h => h.includes('日付') || h.toLowerCase() === 'date');
  if (dateCol < 0) {
    logger.info(SITE, `日付列が見つかりません。ヘッダー: ${headers.join(', ')}`);
    return null;
  }

  for (const row of rows.slice(1)) {
    const dateCell = (row[dateCol] || '').trim();
    if (targets.some(t => dateCell === t || dateCell.startsWith(t))) {
      logger.info(SITE, `対象日の行を発見: ${dateCell}`);
      // ヘッダーと値をオブジェクト化して返す
      const record = { date: d.format('YYYY/M/D'), site: SITE };
      headers.forEach((h, i) => { record[h] = row[i] ?? ''; });
      return record;
    }
  }

  logger.info(SITE, `対象日 ${date} がCSVに見つかりません`);
  return null;
}

/**
 * 指定日のAmazon売上データを取得する
 */
export async function fetchAmazonData(date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'amazon' });

  try {
    logger.start(SITE, `${date} のデータをセラーセントラルから取得中...`);

    // 1. 保存済みクッキーを復元
    await loadCookies(context, 'amazon');

    // 2. ログイン確認
    await page.goto(SELLER_CENTRAL_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(4000);

    let loggedIn = await checkLoggedIn(page);

    if (!loggedIn) {
      logger.info(SITE, 'セッション切れ。セラーセントラルにログインしてください...');
      console.log('   ブラウザでAmazonセラーセントラルにログインしてください。完了後、自動で続行します。');
      await context.clearCookies();
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.bringToFront();
      const { execSync } = await import('child_process');
      execSync('osascript -e \'tell application "Google Chrome" to activate\'').toString().trim().catch?.(() => {});

      // Enterキー確認方式でログイン完了を待つ
      console.log('\n⚠️  [Amazon] ブラウザでセラーセントラルにログインしてください。');
      console.log('   ダッシュボードが表示されたら、このターミナルでEnterキーを押してください。');
      const { createInterface } = await import('readline');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      await new Promise(resolve => rl.question('  [Amazon] ログイン完了後 [Enter] → ', () => { rl.close(); resolve(); }));
      loggedIn = await checkLoggedIn(page);
      if (!loggedIn) throw new Error('ログインが確認できません。セラーセントラルのダッシュボードまでログインしてからEnterを押してください。');
      await saveCookies(context, 'amazon');
      await page.waitForTimeout(2000);
    }

    // 3. ビジネスレポート（売り上げトラフィック）ページへ
    logger.info(SITE, `レポートページへ移動...`);

    // サーバーエラー時のリトライ（最大3回）
    let reportLoaded = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.goto(REPORT_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(8000);

      const hasError = await page.evaluate(() => {
        return document.body.innerText.includes('サーバーエラー') ||
               document.body.innerText.includes('データを読み込めませんでした');
      }).catch(() => false);

      if (hasError) {
        logger.warn(SITE, `サーバーエラー検出（${attempt}/3回目）。15秒後にリトライ...`);
        // エラーの×ボタンを閉じる
        await page.locator('button:near(:text("サーバーエラー"))').first().click().catch(() => {});
        await page.waitForTimeout(15000);
      } else {
        reportLoaded = true;
        break;
      }
    }

    if (!reportLoaded) {
      throw new Error('Amazonセラーセントラルでサーバーエラーが継続しています。時間をおいて再実行してください。');
    }

    // 4. 「日別」表示かつ「7日」範囲を選択して対象日が含まれるようにする
    logger.info(SITE, `日付フィルター設定: 直近7日 (対象日 ${date} を含む)`);

    // 「日別」タブをクリック
    for (const sel of ['button:has-text("日別")', 'a:has-text("日別")', '[data-value="DAY"]']) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          await page.waitForTimeout(1500);
          logger.info(SITE, `日別タブクリック: ${sel}`);
          break;
        }
      } catch { /* 次へ */ }
    }

    // 「7」ボタン（直近7日）をクリック
    for (const sel of ['button:has-text("7")', 'a:has-text("7")', '[data-days="7"]']) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          await page.waitForTimeout(3000);
          logger.info(SITE, `7日ボタンクリック: ${sel}`);
          break;
        }
      } catch { /* 次へ */ }
    }

    // 5. CSVダウンロード
    // SPAのレポートデータ読み込みを待つ
    await page.waitForTimeout(5000);

    // デバッグ用スクリーンショット
    await page.screenshot({ path: '/tmp/amazon_before_csv.png', fullPage: true });
    logger.info(SITE, 'スクリーンショット保存: /tmp/amazon_before_csv.png');

    logger.info(SITE, 'CSVダウンロード中...');
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    let downloadClicked = false;
    for (const sel of [
      'button:has-text("CSVダウンロード")',
      'button:has-text("CSV")',
      'a:has-text("CSV")',
      '[data-test-id*="csv"]',
      '[data-test-id*="download"]',
      '[aria-label*="CSV"]',
      'button[aria-label*="ダウンロード"]',
      'button[title*="CSV"]',
      'a[href*=".csv"]',
      'span:has-text("CSV") >> xpath=..',
      'kat-button:has-text("CSV")',
      'kat-button:has-text("ダウンロード")',
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
        for (const sel of ['button:has-text("CSV")', 'a:has-text("CSV")', 'button:has-text("ダウンロード")']) {
          try {
            const el = frame.locator(sel).first();
            if (await el.isVisible({ timeout: 1000 })) {
              await el.click();
              downloadClicked = true;
              logger.info(SITE, `フレーム内ダウンロードクリック: ${sel}`);
              break;
            }
          } catch { /* 次へ */ }
        }
        if (downloadClicked) break;
      }
    }

    if (!downloadClicked) {
      // デバッグ用ダンプ
      const debug = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        links: Array.from(document.querySelectorAll('a')).map(a => `"${a.innerText.trim().slice(0,50)}" -> ${a.href}`).filter(s => !s.startsWith('"" ->')).slice(0, 30),
        buttons: Array.from(document.querySelectorAll('button')).map(b => `"${b.innerText.trim().slice(0,50)}" aria="${b.getAttribute('aria-label')||''}" data="${b.getAttribute('data-test-id')||''}"`),
        inputs: Array.from(document.querySelectorAll('input')).map(i => `type=${i.type} name="${i.name}" placeholder="${i.placeholder}"`),
      }));
      console.log('\n[DEBUG] URL:', debug.url);
      console.log('[DEBUG] Buttons:\n  ' + debug.buttons.join('\n  '));
      console.log('[DEBUG] Links:\n  ' + debug.links.join('\n  '));
      console.log('[DEBUG] Inputs:\n  ' + debug.inputs.join('\n  '));
      await page.screenshot({ path: '/tmp/amazon_debug.png', fullPage: true });
      console.log('[DEBUG] スクリーンショット: /tmp/amazon_debug.png');
      throw new Error('CSVダウンロードボタンが見つかりません。ページURL: ' + page.url());
    }

    // 6. ダウンロード → バッファ読み込み → パース
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Amazon CSVはUTF-8（BOMあり可能性あり）
    let csvText = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    // BOMなしでも文字化けする場合はShift-JISを試みる
    if (csvText.includes('?') && buffer[0] !== 0xEF) {
      try { csvText = new TextDecoder('shift-jis').decode(buffer); } catch { /* keep utf-8 */ }
    }

    logger.info(SITE, `CSVダウンロード完了 (${buffer.byteLength} bytes)`);

    const rows = parseCsv(csvText);
    const csvRecord = extractFromCsv(rows, date);

    if (!csvRecord) {
      throw new Error(`対象日 ${date} のデータがCSVに見つかりませんでした`);
    }

    // 7. スプレッドシートへ書き込み
    await appendAmazonRecord(SPREADSHEET_ID, csvRecord);

    logger.success(SITE, `取得完了: 売上¥${Number(String(csvRecord['注文商品の売上額'] || '').replace(/[¥,]/g, '') || 0).toLocaleString()}`);

    return csvRecord;

  } catch (err) {
    logger.error(SITE, `エラー: ${err.message}`);
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

if (process.argv[1].endsWith('amazon.js')) {
  const date = process.argv[2] || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  fetchAmazonData(date)
    .then(data => { console.log('\n取得結果:', data); })
    .catch(err => { console.error(err.message); process.exit(1); });
}
