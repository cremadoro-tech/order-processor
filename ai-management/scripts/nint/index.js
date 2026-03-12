/**
 * nint/index.js - Nint EC市場分析ツール スクレイパー
 *
 * 対象ジャンル：
 *   - 印鑑・ハンコ・スタンプ
 *   - 筆記具（ボールペン・万年筆・鉛筆等）
 *   - その他文具全般
 *
 * 取得データ：売れ筋ランキング・競合情報・トレンドセクション
 * 保存先: output/trends/YYYY-MM-DD-nint-report.md
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

import { launchBrowser, saveCookies, isLoggedIn } from '../ec/utils/browser.js';
import { logger } from '../ec/utils/logger.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import dayjs from 'dayjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../../output/trends');
const SITE = 'Nint';

const LOGIN_URL = 'https://nint.jp/users/sign_in';
const DASHBOARD_URL = 'https://nint.jp/dashboard';

// 調査対象ジャンルの検索キーワード
const TARGET_GENRES = [
  {
    name: '印鑑・ハンコ・スタンプ',
    keywords: ['印鑑', 'ハンコ', 'スタンプ', 'シャチハタ', '認印', '銀行印'],
  },
  {
    name: '筆記具',
    keywords: ['ボールペン', '万年筆', '鉛筆', 'シャープペンシル', 'マーカー'],
  },
  {
    name: 'その他文具',
    keywords: ['ノート', '手帳', 'ファイル', '付箋', 'テープ'],
  },
];

/**
 * Nintにログインする
 */
async function login(page, context) {
  logger.info(SITE, 'ログイン中...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  await page.fill('input[name="user[email]"], input[type="email"]', process.env.NINT_EMAIL);
  await page.fill('input[name="user[password]"], input[type="password"]', process.env.NINT_PASSWORD);
  await page.click('input[type="submit"], button[type="submit"]');

  await page.waitForSelector('[class*="dashboard"], [class*="sidebar"], nav', { timeout: 30000 });
  await saveCookies(context, 'nint');
  logger.success(SITE, 'ログイン完了');
}

/**
 * 指定キーワードのランキングデータを取得する
 * @param {import('playwright').Page} page
 * @param {string} keyword
 */
async function fetchRanking(page, keyword) {
  logger.info(SITE, `「${keyword}」のランキングを取得中...`);

  // Nintの検索
  await page.goto(`${DASHBOARD_URL}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // キーワード検索
  const searchInput = page.locator('input[placeholder*="キーワード"], input[name*="keyword"], input[type="search"]');
  await searchInput.fill(keyword).catch(() => {});
  await searchInput.press('Enter').catch(() => {});
  await page.waitForTimeout(3000);

  // ランキングテーブルからデータを取得
  const items = await page.evaluate((kw) => {
    const rows = document.querySelectorAll(
      '[class*="ranking"] tbody tr, [class*="rankItem"], [class*="product-list"] li'
    );

    return Array.from(rows).slice(0, 10).map((row, index) => {
      const cells = row.querySelectorAll('td, [class*="cell"], [class*="col"]');
      const nameEl = row.querySelector('[class*="name"], [class*="title"], a');
      const priceEl = row.querySelector('[class*="price"], [class*="amount"]');
      const rankEl = row.querySelector('[class*="rank"]');
      const salesEl = row.querySelector('[class*="sales"], [class*="volume"]');

      return {
        rank: rankEl?.textContent?.trim() || String(index + 1),
        name: nameEl?.textContent?.trim() || '-',
        price: priceEl?.textContent?.trim() || '-',
        sales: salesEl?.textContent?.trim() || '-',
        keyword: kw,
      };
    });
  }, keyword);

  return items;
}

/**
 * トレンドセクションのデータを取得する
 * @param {import('playwright').Page} page
 */
async function fetchTrends(page) {
  logger.info(SITE, 'トレンドセクションを取得中...');

  // トレンドページへ移動
  await page.goto(`https://nint.jp/trends`, { waitUntil: 'domcontentloaded' }).catch(async () => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
  });
  await page.waitForTimeout(2000);

  const trends = await page.evaluate(() => {
    const items = [];

    // トレンドキーワードを取得
    const trendEls = document.querySelectorAll(
      '[class*="trend"] li, [class*="trending"] a, [class*="keyword"] span'
    );
    trendEls.forEach((el, i) => {
      if (i < 20) items.push(el.textContent.trim());
    });

    return items;
  });

  return trends.filter(t => t.length > 0);
}

/**
 * レポートをMarkdownファイルとして保存する
 */
function saveReport(reportData, date) {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filename = `${date}-nint-report.md`;
  const filepath = join(OUTPUT_DIR, filename);

  const lines = [
    `# Nintトレンドレポート ${dayjs(date).format('YYYY/MM/DD')}`,
    '',
    `> 生成日時: ${dayjs().format('YYYY/MM/DD HH:mm')}`,
    '',
    '## 今週のハイライト',
    '',
    ...reportData.highlights.map(h => `- ${h}`),
    '',
    '---',
    '',
  ];

  // ジャンル別ランキング
  for (const genre of reportData.genres) {
    lines.push(`## ${genre.name}`);
    lines.push('');
    lines.push('### 売れ筋ランキング TOP10');
    lines.push('');
    lines.push('| 順位 | 商品名 | 価格 | 売上推計 |');
    lines.push('|:----|:------|:----|:--------|');

    genre.rankings.forEach((item, i) => {
      lines.push(`| ${item.rank || i + 1} | ${item.name} | ${item.price} | ${item.sales} |`);
    });

    lines.push('');
  }

  // トレンドキーワード
  lines.push('## トレンドキーワード');
  lines.push('');
  if (reportData.trends.length > 0) {
    reportData.trends.forEach(t => lines.push(`- ${t}`));
  } else {
    lines.push('- （取得データなし）');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 自社への示唆・アクション');
  lines.push('');
  lines.push('- [ ] アクション候補1');
  lines.push('- [ ] アクション候補2');
  lines.push('- [ ] アクション候補3');

  writeFileSync(filepath, lines.join('\n'), 'utf-8');
  return filepath;
}

/**
 * メイン実行関数
 */
export async function runNintScraper() {
  const today = dayjs().format('YYYY-MM-DD');
  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'nint' });

  try {
    // ログイン確認
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
    const loggedIn = await isLoggedIn(page, '[class*="dashboard"], nav[class*="sidebar"]');

    if (!loggedIn) {
      await login(page, context);
    }

    const reportData = {
      date: today,
      highlights: [],
      genres: [],
      trends: [],
    };

    // 各ジャンルのランキングを取得
    for (const genre of TARGET_GENRES) {
      logger.start(SITE, `【${genre.name}】の調査開始`);
      const genreData = { name: genre.name, rankings: [] };

      // 主要キーワードでランキング取得
      const mainKeyword = genre.keywords[0];
      const rankings = await fetchRanking(page, mainKeyword);
      genreData.rankings = rankings;

      reportData.genres.push(genreData);
      logger.success(SITE, `【${genre.name}】完了: ${rankings.length}件取得`);
    }

    // トレンド情報を取得
    reportData.trends = await fetchTrends(page);

    // ハイライトを自動生成
    reportData.highlights = [
      `調査日: ${dayjs(today).format('YYYY年MM月DD日')}`,
      `対象ジャンル数: ${TARGET_GENRES.length}（印鑑・筆記具・その他文具）`,
      `トレンドキーワード: ${reportData.trends.slice(0, 3).join('、') || '取得中'}`,
    ];

    // レポートを保存
    const filepath = saveReport(reportData, today);
    logger.success(SITE, `レポートを保存しました: ${filepath}`);

    console.log('\n📊 Nintレポート生成完了');
    console.log(`保存先: ${filepath}`);

    return { success: true, filepath, data: reportData };
  } catch (err) {
    logger.error(SITE, `エラー: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

// 直接実行
if (process.argv[1].endsWith('index.js') && process.argv[1].includes('nint')) {
  runNintScraper()
    .then(result => { console.log('完了:', result.filepath); })
    .catch(err => { console.error(err); process.exit(1); });
}
