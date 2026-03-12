/**
 * giftmall.js - ギフトモール 売上データ取得
 *
 * 取得データ：注文数・売上高
 * ページ：ギフトモール出品者管理画面 > 注文管理
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { launchBrowser, isLoggedIn, manualLogin } from '../utils/browser.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

const SITE = 'ギフトモール';
const LOGIN_URL = 'https://board.giftmall.co.jp/mgt/login';
const ORDER_URL = 'https://board.giftmall.co.jp/mgt/order';

async function login(page, context) {
  await manualLogin(page, context, 'giftmall', LOGIN_URL);
  logger.success(SITE, 'ログイン完了');
}

/**
 * 指定日のギフトモール売上データを取得する
 */
export async function fetchGiftmallData(date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'giftmall' });

  try {
    await page.goto(ORDER_URL, { waitUntil: 'domcontentloaded' });
    const loggedIn = await isLoggedIn(page, 'a[href*="orders"], [class*="order"]');

    if (!loggedIn) {
      await login(page, context);
      await page.goto(ORDER_URL, { waitUntil: 'networkidle' });
    }

    logger.start(SITE, `${date} のデータを取得中...`);

    // 日付フィルター
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    await page.fill('input[name*="from"], input[name*="start"]', dateStr).catch(() => {});
    await page.fill('input[name*="to"], input[name*="end"]', dateStr).catch(() => {});
    await page.click('button:has-text("検索"), button:has-text("絞り込み"), button[type="submit"]').catch(() => {});
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr, [class*="orderRow"]');
      let orders = rows.length;
      let revenue = 0;

      rows.forEach(row => {
        const amountEl = row.querySelector('[class*="amount"], [class*="price"], td:last-child');
        const amount = parseFloat(amountEl?.textContent?.replace(/[¥,\s円]/g, '') || '0');
        if (!isNaN(amount)) revenue += amount;
      });

      return { orders, revenue };
    });

    logger.success(SITE, `取得完了: 注文${data.orders}件, 売上¥${data.revenue.toLocaleString()}`);

    return {
      date: dayjs(date).format('YYYY/MM/DD'),
      site: SITE,
      orders: data.orders,
      revenue: Math.round(data.revenue),
      sessions: null,
      adCost: null,
    };
  } catch (err) {
    logger.error(SITE, `エラー: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

if (process.argv[1].endsWith('giftmall.js')) {
  const date = process.argv[2] || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  fetchGiftmallData(date)
    .then(data => { console.log('\n取得結果:', data); })
    .catch(err => { console.error(err); process.exit(1); });
}
