import { chromium } from 'playwright';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = join(__dirname, 'scripts/.cookies/profile-aupay');
const SCREENSHOT_DIR = '/tmp/aupay-screenshots';
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR);

const PAGES = {
  top:    'https://manager.wowma.jp/wmshopclient/',
  point:  'https://manager.wowma.jp/wmshopclient/point',
  coupon: 'https://manager.wowma.jp/wmshopclient/coupon',
  ad:     'https://manager.wowma.jp/wmshopclient/ad',
  shop:   'https://manager.wowma.jp/wmshopclient/shop',
};

const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ['--no-sandbox'],
});

const page = await browser.newPage();

async function capture(name, url) {
  console.log(`\n[${name}] ${url} にアクセス中...`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path, fullPage: true });
    const title = await page.title();
    const h1s = await page.$$eval('h1, h2, .title, [class*="page-title"]', els => els.map(e => e.textContent?.trim()).filter(Boolean).slice(0, 5));
    const links = await page.$$eval('nav a, .menu a, .sidebar a, [class*="menu"] a', els => els.map(e => ({ text: e.textContent?.trim(), href: e.getAttribute('href') })).filter(e => e.text && e.href).slice(0, 30));
    console.log(`  タイトル: ${title}`);
    console.log(`  見出し: ${h1s.join(' / ')}`);
    console.log(`  ナビ: ${links.map(l => l.text).join(', ')}`);
    return { title, h1s, links, screenshot: path };
  } catch(e) {
    console.log(`  エラー: ${e.message}`);
    return null;
  }
}

// トップページを開いてナビ構造確認
const top = await capture('top', PAGES.top);

// ナビに広告・クーポン・ポイント関連があるか確認
const allLinks = top?.links || [];
const adLinks = allLinks.filter(l => /広告|クーポン|ポイント|AD|ad|coupon|point/i.test(l.text + (l.href||'')));
console.log('\n\n=== 広告・販促関連メニュー ===');
adLinks.forEach(l => console.log(`  ${l.text}: ${l.href}`));

// ポイント設定を試みる
await capture('point', PAGES.point);
await capture('coupon', PAGES.coupon);
await capture('ad', PAGES.ad);

console.log('\n\nスクリーンショット保存先:', SCREENSHOT_DIR);
await browser.close();
