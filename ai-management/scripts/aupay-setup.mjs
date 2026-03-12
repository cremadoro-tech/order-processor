/**
 * AuPay Market 販促設定ナビゲーター
 * タイムセール・クーポン設定画面を順番に開く
 */
import { chromium } from 'playwright';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = join(__dirname, '.cookies/profile-aupay');
const SS_DIR = '/tmp/aupay-setup';
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const LOGIN_URL = 'https://manager.wowma.jp/wmshopclient/authclient/login';
const TOP_URL   = 'https://manager.wowma.jp/wmshopclient/';

const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1400, height: 900 },
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

// ─── ログイン確認 ───────────────────────────────────────
await page.goto(TOP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
if (page.url().includes('login') || (await page.title()).includes('ログイン')) {
  console.log('\n========================================');
  console.log('  ブラウザでログインしてください');
  console.log('  ログイン完了後、Enterキーを押してください');
  console.log('========================================\n');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  // ログイン完了まで最大5分待機
  await page.waitForURL(url => !url.includes('login'), { timeout: 300000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('ログイン完了 ✓\n');
}

// ─── ユーティリティ ─────────────────────────────────────
async function ss(name) {
  const path = `${SS_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function extractLinks(selector = 'a') {
  return page.$$eval(selector, els =>
    els.map(e => ({ text: e.textContent?.trim().replace(/\s+/g,' '), href: e.getAttribute('href') }))
       .filter(e => e.text && e.href && e.text.length > 0)
  );
}

// ─── メニュー構造を把握 ──────────────────────────────────
console.log('【STEP 1】管理トップを確認中...');
await page.goto(TOP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await ss('01-top');

const allLinks = await extractLinks('nav a, .menu a, .gnav a, header a, [class*="menu"] a, [class*="nav"] a, aside a');
console.log('\n=== ナビゲーションメニュー ===');
allLinks.forEach(l => console.log(`  ${l.text}  →  ${l.href}`));

// タイムセール・クーポン関連URLを抽出
const keywords = /タイムセール|time.?sale|クーポン|coupon|ポイント|point|販促|promo|キャンペーン|campaign/i;
const promoLinks = allLinks.filter(l => keywords.test((l.text||'') + (l.href||'')));

console.log('\n=== 販促関連リンク ===');
promoLinks.forEach(l => console.log(`  「${l.text}」 →  ${l.href}`));

// ─── タイムセール設定画面を探す ──────────────────────────
console.log('\n【STEP 2】タイムセール設定画面を探しています...');

const timesaleUrls = [
  'https://manager.wowma.jp/wmshopclient/timesale',
  'https://manager.wowma.jp/wmshopclient/timesale/list',
  'https://manager.wowma.jp/wmshopclient/sale/timesale',
  'https://manager.wowma.jp/wmshopclient/promotion/timesale',
  'https://manager.wowma.jp/wmshopclient/campaign/timesale',
  'https://manager.wowma.jp/wmshopclient/event/timesale',
];

let timesaleFound = null;
for (const url of timesaleUrls) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
  if (!page.url().includes('login') && !title.includes('エラー') && !title.includes('404')) {
    console.log(`  ✓ 発見: ${url}`);
    console.log(`    タイトル: ${title}`);
    console.log(`    テキスト: ${bodyText.slice(0, 200)}`);
    await ss('02-timesale');
    timesaleFound = url;
    break;
  }
}

if (!timesaleFound) {
  // promoLinksから試す
  for (const link of promoLinks.slice(0, 5)) {
    const url = link.href.startsWith('http') ? link.href : `https://manager.wowma.jp${link.href}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const title = await page.title();
    if (!page.url().includes('login')) {
      await ss(`02-${link.text.replace(/[^\w]/g,'_').slice(0,20)}`);
      console.log(`  「${link.text}」: ${title} (${url})`);
    }
  }
}

// ─── クーポン設定画面を探す ──────────────────────────────
console.log('\n【STEP 3】クーポン設定画面を探しています...');

const couponUrls = [
  'https://manager.wowma.jp/wmshopclient/coupon',
  'https://manager.wowma.jp/wmshopclient/coupon/list',
  'https://manager.wowma.jp/wmshopclient/promotion/coupon',
  'https://manager.wowma.jp/wmshopclient/campaign/coupon',
];

for (const url of couponUrls) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const title = await page.title();
  if (!page.url().includes('login') && !title.includes('404')) {
    console.log(`  ✓ 発見: ${url}  (${title})`);
    await ss('03-coupon');
    break;
  }
}

// ─── Pontaパスポイントセレクト設定画面 ──────────────────
console.log('\n【STEP 4】Pontaパス ポイントUPセレクト画面を探しています...');

const pontaUrls = [
  'https://manager.wowma.jp/wmshopclient/point',
  'https://manager.wowma.jp/wmshopclient/point/setting',
  'https://manager.wowma.jp/wmshopclient/ponta',
  'https://manager.wowma.jp/wmshopclient/select',
  'https://manager.wowma.jp/wmshopclient/promotion/point',
];

for (const url of pontaUrls) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const title = await page.title();
  if (!page.url().includes('login') && !title.includes('404')) {
    console.log(`  ✓ 発見: ${url}  (${title})`);
    await ss('04-ponta');
    break;
  }
}

// ─── 結果レポート保存 ────────────────────────────────────
const report = {
  timestamp: new Date().toISOString(),
  timesaleUrl: timesaleFound,
  screenshotDir: SS_DIR,
  promoLinks,
};
writeFileSync(`${SS_DIR}/report.json`, JSON.stringify(report, null, 2));

console.log('\n========================================');
console.log(`スクリーンショット: ${SS_DIR}/`);
console.log('ブラウザはそのまま操作できます');
console.log('========================================');

// ブラウザは閉じずに待機（手動操作のため）
// await browser.close();
