/**
 * shopify.js - Shopify 管理画面 売上データ取得（Playwright スクレイピング版）
 *
 * 取得方法: Shopify管理画面 > アナリティクス > ダッシュボード > 日次
 * API は使用せず、ブラウザ操作のみでデータを取得する。
 *
 * 事前準備（初回のみ）:
 *   node ec/login-helper.js shopify
 *   ↑ ブラウザが開くのでShopify管理画面にログインしてEnterを押す
 *
 * .env 設定:
 *   SHOPIFY_STORE_HANDLE=hankoya-store   # .myshopify.com の前の部分
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { launchBrowser, saveCookies, loadCookies } from '../utils/browser.js';
import { appendDailyRecord } from '../utils/sheets.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

const SITE = 'Shopify';
const STORE_HANDLE = process.env.SHOPIFY_STORE_HANDLE || '';
// 新しいShopify管理画面URL（admin.shopify.com）または旧URL（.myshopify.com/admin）に対応
const ADMIN_URL = STORE_HANDLE
  ? `https://admin.shopify.com/store/${STORE_HANDLE}`
  : 'https://accounts.shopify.com/';
const ANALYTICS_PATH = `${ADMIN_URL}/analytics/dashboards/default`;
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw';

/**
 * Shopify管理画面にログイン済みかチェック
 */
async function checkLoggedIn(page) {
  return await page.evaluate(() => {
    const url = window.location.href;
    const isAdmin = url.includes('admin.shopify.com') || url.includes('myshopify.com/admin');
    const isLoginPage = url.includes('accounts.shopify.com') || url.includes('/login');
    return isAdmin && !isLoginPage;
  }).catch(() => false);
}

/**
 * 日付を YYYY-MM-DD → MM/DD/YYYY 形式に変換（Shopify日付ピッカー用）
 */
function toShopifyDate(dateStr) {
  const d = dayjs(dateStr);
  return d.format('MM/DD/YYYY');
}

/**
 * Shopify アナリティクスダッシュボードから日次データを抽出する
 * @param {import('playwright').Page} page
 * @param {string} date - YYYY-MM-DD 形式
 */
async function extractAnalyticsData(page, date) {
  const targetDate = dayjs(date);
  const dateLabel = targetDate.format('YYYY年M月D日');
  logger.info(SITE, `ダッシュボードで ${dateLabel} のデータを取得中...`);

  // --- 日付範囲を対象日の1日に設定 ---
  // Shopifyのダッシュボードには日付ピッカーがある
  // まずページが完全に読み込まれるまで待機
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 日付ピッカーを開く（ボタンラベルは "今日" "昨日" "先週" "先月" など）
  // カスタム日付を設定するため「カスタム期間」または "Custom range" を選択
  try {
    // 日付選択ボタンをクリック
    const datePickerBtn = await page.locator('[data-component-name="DateRangePicker"], button[aria-label*="date"], button:has-text("今日"), button:has-text("yesterday"), button:has-text("Today"), .Polaris-DatePicker').first();
    if (await datePickerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await datePickerBtn.click();
      await page.waitForTimeout(1500);

      // 「カスタム」オプションを選択
      const customOption = await page.locator('li:has-text("カスタム"), li:has-text("Custom"), button:has-text("Custom"), option:has-text("Custom")').first();
      if (await customOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await customOption.click();
        await page.waitForTimeout(1000);

        // 開始日・終了日に同じ日付を入力
        const shopifyDateStr = toShopifyDate(date);
        const startInput = await page.locator('input[placeholder*="start"], input[aria-label*="start"], input[name*="start"]').first();
        const endInput   = await page.locator('input[placeholder*="end"], input[aria-label*="end"], input[name*="end"]').last();

        if (await startInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await startInput.triple_click();
          await startInput.fill(shopifyDateStr);
        }
        if (await endInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await endInput.triple_click();
          await endInput.fill(shopifyDateStr);
        }

        // 適用ボタン
        const applyBtn = await page.locator('button:has-text("適用"), button:has-text("Apply"), button[type="submit"]:has-text("適用")').first();
        if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await applyBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    }
  } catch (err) {
    logger.warn(SITE, `日付設定をスキップ（手動で確認してください）: ${err.message}`);
  }

  // --- ダッシュボードのKPI数値を取得 ---
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    /**
     * ページ内の数値テキストから売上・注文数を抽出する汎用関数
     * Shopifyダッシュボードのレイアウトは変わりやすいため、複数のパターンで試みる
     */
    let revenue = null;
    let orders  = null;

    // パターン1: Polaris KPI card の見出しと値を取得
    const cards = document.querySelectorAll('[class*="KPI"], [class*="kpi"], [class*="MetricCard"], [class*="metriccard"], [data-polaris-component]');
    cards.forEach(card => {
      const text  = card.innerText || '';
      const label = text.toLowerCase();
      // 売上
      if ((label.includes('sales') || label.includes('売上') || label.includes('収益')) && revenue === null) {
        const match = text.match(/[¥$]?([\d,]+(?:\.\d{1,2})?)/);
        if (match) revenue = parseFloat(match[1].replace(/,/g, ''));
      }
      // 注文数
      if ((label.includes('orders') || label.includes('注文')) && orders === null) {
        const match = text.match(/(\d[\d,]*)/);
        if (match) orders = parseInt(match[1].replace(/,/g, ''), 10);
      }
    });

    // パターン2: テキストをまとめてスキャン（Polarisのクラス名が変わった場合）
    if (revenue === null || orders === null) {
      const allText = Array.from(document.querySelectorAll('h3, h2, [class*="Value"], [class*="value"], [class*="amount"]'))
        .map(el => ({ text: el.innerText, parent: el.parentElement?.innerText || '' }));

      for (const { text, parent } of allText) {
        const combined = (parent + ' ' + text).toLowerCase();
        if (revenue === null && (combined.includes('total sales') || combined.includes('売上合計') || combined.includes('総売上'))) {
          const match = text.match(/[¥$]?([\d,]+)/);
          if (match) revenue = parseInt(match[1].replace(/,/g, ''), 10);
        }
        if (orders === null && (combined.includes('orders') || combined.includes('注文数') || combined.includes('受注'))) {
          const match = text.match(/^(\d[\d,]*)$/);
          if (match) orders = parseInt(match[1].replace(/,/g, ''), 10);
        }
      }
    }

    return { revenue, orders };
  });

  if (data.revenue === null && data.orders === null) {
    // スクリーンショットを撮って状況を記録
    logger.warn(SITE, 'KPI数値の自動取得に失敗しました。ページのスクリーンショットを確認してください。');
    await page.screenshot({ path: '/tmp/shopify-debug.png' });
    logger.info(SITE, 'スクリーンショット: /tmp/shopify-debug.png');
    throw new Error('ダッシュボードからデータを取得できませんでした。ページレイアウトが変更された可能性があります。');
  }

  return {
    revenue: data.revenue ?? 0,
    orders:  data.orders  ?? 0,
  };
}

/**
 * 指定日の Shopify 売上データを取得する
 * @param {string} date - YYYY-MM-DD 形式（省略時は前日）
 */
export async function fetchShopifyData(date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
  logger.start(SITE, `${date} のデータをShopify管理画面から取得中...`);

  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'shopify' });

  try {
    // 保存済みクッキーを復元
    await loadCookies(context, 'shopify');

    // まず管理画面トップへアクセスしてセッションを確認
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);

    let loggedIn = await checkLoggedIn(page);

    if (!loggedIn) {
      logger.info(SITE, 'セッション切れ。Shopify管理画面へのログインが必要です。');
      console.log('\n⚠️  [Shopify] ブラウザでShopify管理画面にログインしてください。');
      console.log(`   URL: ${ADMIN_URL}`);
      console.log('   ログイン完了後（管理画面が表示されたら）、このターミナルでEnterを押してください。\n');

      await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.bringToFront();

      // macOS でウィンドウを前面に表示
      try {
        const { execSync } = await import('child_process');
        execSync('osascript -e \'tell application "Chromium" to activate\' 2>/dev/null || osascript -e \'tell application "Google Chrome" to activate\' 2>/dev/null').toString().trim();
      } catch {}

      const { createInterface } = await import('readline');
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      await new Promise(resolve => rl.question('  [Shopify] ログイン完了後 [Enter] → ', () => { rl.close(); resolve(); }));

      loggedIn = await checkLoggedIn(page);
      if (!loggedIn) {
        throw new Error('Shopifyのログインが確認できません。管理画面が表示されてからEnterを押してください。');
      }

      // ログイン成功後にクッキーを保存
      await saveCookies(context, 'shopify');
      logger.success(SITE, 'ログイン情報を保存しました（次回以降は自動ログイン）');
    } else {
      logger.info(SITE, '保存済みセッションでログイン済みです');
    }

    // アナリティクスページへ遷移
    logger.info(SITE, `アナリティクスへアクセス: ${ANALYTICS_PATH}`);
    await page.goto(ANALYTICS_PATH, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(4000);

    // セッション切れの場合は再度ログイン確認
    const stillLoggedIn = await checkLoggedIn(page);
    if (!stillLoggedIn) {
      throw new Error('アナリティクスページへのアクセス中にセッションが切れました。再実行してください。');
    }

    // データ抽出
    const { revenue, orders } = await extractAnalyticsData(page, date);

    // クッキーを最新状態で保存
    await saveCookies(context, 'shopify');

    const result = {
      date: dayjs(date).format('YYYY/M/D'),
      site: SITE,
      orders,
      revenue,
      sessions: null,
      adCost: null,
      memo: null,
    };

    logger.success(SITE, `取得完了: 注文${orders}件, 売上¥${revenue.toLocaleString()}`);

    // Google Sheetsに書き込み
    if (process.env.GOOGLE_SPREADSHEET_ID) {
      await appendDailyRecord(SPREADSHEET_ID, result);
    }

    return result;

  } catch (err) {
    logger.error(SITE, `エラー: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

// 単体実行用（node ec/scrapers/shopify.js [YYYY-MM-DD]）
if (process.argv[1]?.endsWith('shopify.js')) {
  const date = process.argv[2] || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  fetchShopifyData(date)
    .then(data => { console.log('\n取得結果:', data); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
