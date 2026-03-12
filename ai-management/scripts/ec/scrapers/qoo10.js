/**
 * qoo10.js - Qoo10 (Q-manager) 売上データ取得
 *
 * 取得データ：注文数・売上高
 * ページ：Q-manager > 注文管理
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import { launchBrowser, isLoggedIn, manualLogin } from '../utils/browser.js';
import { logger } from '../utils/logger.js';
import dayjs from 'dayjs';

const SITE = 'Qoo10';
const LOGIN_URL = 'https://qsm.qoo10.jp/GMKT.INC.Gsm.Web/Login.aspx';
const ORDER_URL = 'https://qsm.qoo10.jp/GMKT.INC.Gsm.Web/Goods/Order/NewOrderList.aspx';

async function login(page, context) {
  await manualLogin(page, context, 'qoo10', LOGIN_URL);
  logger.success(SITE, 'ログイン完了');
}

/**
 * 指定日のQoo10売上データを取得する
 */
export async function fetchQoo10Data(date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')) {
  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'qoo10' });

  try {
    await page.goto(ORDER_URL, { waitUntil: 'domcontentloaded' });
    const loggedIn = await isLoggedIn(page, 'a[href*="Order"], [class*="order"]');

    if (!loggedIn) {
      await login(page, context);
      await page.goto(ORDER_URL, { waitUntil: 'networkidle' });
    }

    logger.start(SITE, `${date} のデータを取得中...`);

    // Q-manager の日付フィルター（注文日で絞り込み）
    const d = dayjs(date);
    const dateFormatted = d.format('YYYY-MM-DD');

    // 注文日の開始・終了を同日に設定
    await page.fill('input[name="OrderStartDT"], input[id*="startDate"]', dateFormatted).catch(() => {});
    await page.fill('input[name="OrderEndDT"], input[id*="endDate"]', dateFormatted).catch(() => {});
    await page.click('input[type="submit"], button:has-text("検索"), a:has-text("検索")').catch(() => {});
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      // Q-managerの注文一覧テーブル
      const rows = document.querySelectorAll('#orderList tbody tr, table.list tbody tr');
      let orders = 0;
      let revenue = 0;

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        orders++;
        // Qoo10は通常、金額列がある
        const amountCell = cells[cells.length - 2]; // 金額は後ろから2列目が多い
        const amount = parseFloat(amountCell?.textContent?.replace(/[¥,\s円]/g, '') || '0');
        if (!isNaN(amount) && amount > 0) revenue += amount;
      });

      // 件数表示
      const countEl = document.querySelector('span.total, [class*="totalCnt"]');
      const countMatch = countEl?.textContent?.match(/(\d+)/);
      if (countMatch) orders = parseInt(countMatch[1], 10);

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

if (process.argv[1].endsWith('qoo10.js')) {
  const date = process.argv[2] || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  fetchQoo10Data(date)
    .then(data => { console.log('\n取得結果:', data); })
    .catch(err => { console.error(err); process.exit(1); });
}
