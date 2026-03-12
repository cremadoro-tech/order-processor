/**
 * ec/index.js - EC全サイト売上データ取得 メインオーケストレーター
 *
 * 使い方:
 *   node ec/index.js                         # 前日までの未取得日を全サイト取得
 *   node ec/index.js 2026-03-01              # 指定日のデータを取得
 *   node ec/index.js 2026-03-01 2026-03-05   # 範囲指定で取得
 *   node ec/index.js --sites rakuten,yahoo   # 特定サイトのみ取得
 *   node ec/index.js --no-sheets             # Sheets書き込みをスキップ（確認用）
 *
 * 休日対応:
 *   引数なしで実行すると、日次データシートの最終日付の翌日〜前日まで
 *   まとめて取得する。（土日に実行しなかった場合も自動的に補完）
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

import dayjs from 'dayjs';
import { appendMultipleDailyRecords, ensureSheets, getLastDateInSheet } from './utils/sheets.js';
import { logger } from './utils/logger.js';

// スクレイパーをインポート
import { fetchAmazonData } from './scrapers/amazon.js';
import { fetchRakutenData } from './scrapers/rakuten.js';
import { fetchYahooData } from './scrapers/yahoo.js';
import { fetchShopifyData } from './scrapers/shopify.js';
import { fetchGoQData } from './scrapers/goq.js';

const SHEET_NAMES = ['日次データ', '月次サマリー', 'Amazon', '楽天', 'Yahoo!', 'Shopify', 'ギフトモール', 'AuPay', 'Qoo10'];

// サイト別スクレイパー設定
// ※ Shopify は API 不使用・Playwright スクレイピングのみ
const SCRAPERS = {
  shopify:   { fn: fetchShopifyData,   label: 'Shopify',      requiresEnv: ['SHOPIFY_STORE_HANDLE'] },
  amazon:    { fn: fetchAmazonData,    label: 'Amazon',       requiresEnv: ['AMAZON_SELLER_EMAIL'] },
  rakuten:   { fn: fetchRakutenData,   label: '楽天' },
  yahoo:     { fn: fetchYahooData,     label: 'Yahoo!' },
  goq:       { fn: fetchGoQData,       label: 'GoQ（ギフトモール/Qoo10/auPAY）' },
};

/**
 * 引数を解析する
 */
function parseArgs(args) {
  const result = {
    dates: [],
    sites: Object.keys(SCRAPERS),
    noSheets: false,
    autoRange: true, // 引数なし → 自動で未取得日を算出
  };

  const dateArgs = [];
  args.forEach((arg, i) => {
    if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dateArgs.push(arg);
      result.autoRange = false;
    } else if (arg === '--sites' && args[i + 1]) {
      result.sites = args[i + 1].split(',').map(s => s.trim());
    } else if (arg === '--no-sheets') {
      result.noSheets = true;
    }
  });

  if (dateArgs.length === 1) {
    result.dates = [dateArgs[0]];
  } else if (dateArgs.length >= 2) {
    // 範囲指定: 開始日〜終了日
    result.dates = generateDateRange(dateArgs[0], dateArgs[1]);
  }

  return result;
}

/**
 * 開始日〜終了日の日付リストを生成
 */
function generateDateRange(startDate, endDate) {
  const dates = [];
  let current = dayjs(startDate);
  const end = dayjs(endDate);
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  return dates;
}

/**
 * 環境変数が設定されているかチェック
 */
function checkEnvVars(scraper) {
  if (!scraper.requiresEnv) return true;
  const missing = scraper.requiresEnv.filter(key => !process.env[key]);
  if (missing.length > 0) {
    logger.warn(scraper.label, `.envに未設定の変数があります: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

/**
 * 1日分のデータを全サイトから取得
 */
async function fetchOneDay(date, sites, noSheets) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  📅 ${date} のデータ取得`);
  console.log(`${'─'.repeat(50)}`);

  const results = [];
  const errors = [];

  for (const siteKey of sites) {
    const scraper = SCRAPERS[siteKey];
    if (!scraper) { logger.warn('main', `不明なサイト: ${siteKey}`); continue; }
    if (!checkEnvVars(scraper)) { logger.warn(scraper.label, 'スキップ'); continue; }

    try {
      const data = await scraper.fn(date);
      if (data) {
        results.push(data);
        logger.data(scraper.label, data);
      }
    } catch (err) {
      logger.error(scraper.label, `取得失敗: ${err.message}`);
      errors.push({ site: scraper.label, error: err.message });
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  // Google Sheets に書き込み（日次データシート）
  if (!noSheets && results.length > 0 && process.env.GOOGLE_SPREADSHEET_ID) {
    try {
      await appendMultipleDailyRecords(process.env.GOOGLE_SPREADSHEET_ID, results);
      logger.success('Sheets', `${results.length}件を日次データに書き込みました`);
    } catch (err) {
      logger.error('Sheets', `書き込み失敗: ${err.message}`);
    }
  }

  return { date, results, errors };
}

/**
 * メイン実行
 */
async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  let { dates, sites, noSheets, autoRange } = parsed;

  // 自動範囲: 日次データシートの最終日の翌日〜前日
  if (autoRange && dates.length === 0) {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    try {
      const lastDate = await getLastDateInSheet(
        process.env.GOOGLE_SPREADSHEET_ID, '日次データ'
      );
      if (lastDate) {
        const startDate = dayjs(lastDate).add(1, 'day').format('YYYY-MM-DD');
        if (dayjs(startDate).isAfter(dayjs(yesterday))) {
          console.log(`\n  ✅ 日次データは ${lastDate} まで取得済みです。新しいデータはありません。\n`);
          return;
        }
        dates = generateDateRange(startDate, yesterday);
        console.log(`\n  📊 未取得期間を検出: ${startDate} 〜 ${yesterday}（${dates.length}日分）`);
      } else {
        dates = [yesterday];
      }
    } catch (err) {
      logger.warn('Sheets', `最終日付の取得に失敗。前日分のみ取得します: ${err.message}`);
      dates = [yesterday];
    }
  }

  if (dates.length === 0) {
    dates = [dayjs().subtract(1, 'day').format('YYYY-MM-DD')];
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  EC売上データ取得スクリプト`);
  console.log(`  対象日: ${dates.length === 1 ? dates[0] : `${dates[0]} 〜 ${dates[dates.length - 1]}（${dates.length}日分）`}`);
  console.log(`  対象サイト: ${sites.join(', ')}`);
  console.log('='.repeat(60));

  // Google Sheetsの初期化
  if (!noSheets && process.env.GOOGLE_SPREADSHEET_ID) {
    try {
      await ensureSheets(process.env.GOOGLE_SPREADSHEET_ID, SHEET_NAMES);
    } catch (err) {
      logger.warn('Sheets', `シート初期化をスキップ: ${err.message}`);
    }
  }

  // 各日付を順次処理
  const allResults = [];
  const allErrors = [];

  for (const date of dates) {
    const { results, errors } = await fetchOneDay(date, sites, noSheets);
    allResults.push(...results);
    allErrors.push(...errors);
  }

  // 最終サマリー
  console.log('\n' + '='.repeat(60));
  console.log('  実行結果サマリー');
  console.log('='.repeat(60));

  let totalOrders = 0;
  let totalRevenue = 0;

  allResults.forEach(r => {
    if (!r) return;
    totalOrders += r.orders || 0;
    totalRevenue += r.revenue || 0;
    const dateStr = r.date || '';
    console.log(`  ${dateStr.padEnd(12)} ${(r.site || '').padEnd(10)} 注文: ${String(r.orders || 0).padStart(5)}件  売上: ¥${(r.revenue || 0).toLocaleString()}`);
  });

  console.log('-'.repeat(60));
  console.log(`  ${'合計'.padEnd(22)} 注文: ${String(totalOrders).padStart(5)}件  売上: ¥${totalRevenue.toLocaleString()}`);

  if (allErrors.length > 0) {
    console.log('\n  ⚠️  エラーが発生したサイト:');
    allErrors.forEach(e => console.log(`    - ${e.site}: ${e.error}`));

    // 失敗サイトのみ再実行するコマンドを表示
    const SITE_KEY_MAP = {
      'Shopify': 'shopify', 'Amazon': 'amazon',
      '楽天': 'rakuten', 'Yahoo!': 'yahoo',
      'GoQ（ギフトモール/Qoo10/auPAY）': 'goq',
    };
    const failedKeys = [...new Set(allErrors.map(e => SITE_KEY_MAP[e.site]).filter(Boolean))];
    if (failedKeys.length > 0) {
      const dateArg = dates.length === 1 ? dates[0] : `${dates[0]} ${dates[dates.length - 1]}`;
      console.log('\n  💡 失敗したサイトだけ再実行:');
      console.log(`     node scripts/ec/index.js ${dateArg} --sites ${failedKeys.join(',')}`);
    }
  } else {
    // 全サイト成功 → Slack日報を自動送信
    console.log('\n  ✅ 全サイト取得完了。Slack日報を送信します...');
    const { execSync } = await import('child_process');
    try {
      const output = execSync('node scripts/slack-daily-report.mjs', {
        cwd: join(dirname(fileURLToPath(import.meta.url)), '../..'),
        encoding: 'utf-8',
        timeout: 60000,
      });
      console.log(output.trim());
      console.log('  ✅ Slack日報送信完了');
    } catch (err) {
      console.error(`  ❌ Slack日報送信失敗: ${err.message}`);
    }
  }

  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error('致命的なエラー:', err);
  process.exit(1);
});
