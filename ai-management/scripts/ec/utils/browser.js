/**
 * browser.js - Playwright ブラウザ管理・Cookie永続化ユーティリティ
 *
 * Cookie保存により、初回ログイン後は自動的にセッションを再利用する。
 * セッション期限切れの場合は自動的にログインを促す。
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIES_DIR = join(__dirname, '../../.cookies');

/**
 * Cookie ファイルのパスを返す
 * @param {string} siteName - サイト識別子（例: 'amazon', 'rakuten'）
 */
export function getCookiePath(siteName) {
  return join(COOKIES_DIR, `${siteName}.json`);
}

/**
 * Cookie を保存する
 * @param {import('playwright').BrowserContext} context
 * @param {string} siteName
 */
export async function saveCookies(context, siteName) {
  const cookies = await context.cookies();
  if (!existsSync(COOKIES_DIR)) {
    mkdirSync(COOKIES_DIR, { recursive: true });
  }
  writeFileSync(getCookiePath(siteName), JSON.stringify(cookies, null, 2));
  console.log(`[${siteName}] Cookie を保存しました`);
}

/**
 * Cookie を読み込んで context に適用する
 * @param {import('playwright').BrowserContext} context
 * @param {string} siteName
 * @returns {boolean} - Cookieが存在したかどうか
 */
export async function loadCookies(context, siteName) {
  const cookiePath = getCookiePath(siteName);
  if (!existsSync(cookiePath)) {
    return false;
  }
  try {
    const cookies = JSON.parse(readFileSync(cookiePath, 'utf-8'));
    await context.addCookies(cookies);
    console.log(`[${siteName}] Cookie を読み込みました`);
    return true;
  } catch {
    return false;
  }
}

/**
 * ブラウザを起動してコンテキストを返す
 *
 * siteName を指定すると「永続プロファイル」を使用する。
 * プロファイルはディスクに保存されるため、Googleログインや各サイトの
 * セッションが次回起動時も維持される（「ブラウザが元に戻る」問題を解消）。
 *
 * @param {object} options
 * @param {boolean} [options.headless=false] - ヘッドレスモード
 * @param {string} [options.siteName] - サイト名（プロファイルディレクトリ名に使用）
 * @param {string} [options.userAgent] - カスタムUser-Agent
 */
export async function launchBrowser({ headless = false, siteName = null, userAgent = null } = {}) {
  if (siteName) {
    // 永続プロファイルモード：ブラウザ状態がディスクに保存される
    const profileDir = join(COOKIES_DIR, `profile-${siteName}`);
    if (!existsSync(profileDir)) {
      mkdirSync(profileDir, { recursive: true });
    }

    const contextOptions = {
      headless,
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      viewport: { width: 1280, height: 900 },
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    };
    if (userAgent) contextOptions.userAgent = userAgent;

    const context = await chromium.launchPersistentContext(profileDir, contextOptions);

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = context.pages()[0] || await context.newPage();

    // browser.close() で context が閉じるようにラップ
    const browser = { close: () => context.close() };

    return { browser, context, page };
  }

  // siteName なし：通常の一時ブラウザ（Shopify API確認など用）
  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const contextOptions = {
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1280, height: 900 },
  };
  if (userAgent) contextOptions.userAgent = userAgent;

  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * ログイン状態を確認する汎用関数
 * @param {import('playwright').Page} page
 * @param {string} loginIndicatorSelector - ログイン済みを示す要素のセレクター
 * @param {number} [timeout=5000]
 */
export async function isLoggedIn(page, loginIndicatorSelector, timeout = 5000) {
  try {
    await page.waitForSelector(loginIndicatorSelector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * ブラウザを開いてユーザーが手動でログインするのを待つ
 * @param {import('playwright').Page} page
 * @param {import('playwright').BrowserContext} context
 * @param {string} siteName - サイト識別子（Cookie保存に使用）
 * @param {string} loginUrl - 開くログインURL
 */
export async function manualLogin(page, context, siteName, loginUrl) {
  console.log(`\n🌐 [${siteName}] ブラウザでログインしてください`);
  console.log(`   URL: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve =>
    rl.question(`  [${siteName}] ログイン完了後 [Enter] → `, () => { rl.close(); resolve(); })
  );

  await saveCookies(context, siteName);
}

/**
 * ユーザーに手動操作を促して待機する（2FA等）
 * @param {import('playwright').Page} page
 * @param {string} message - ユーザーへのメッセージ
 * @param {string} waitForSelector - 完了を示すセレクター
 * @param {number} [timeout=60000] - タイムアウト（ミリ秒）
 */
export async function waitForManualAction(page, message, waitForSelector, timeout = 60000) {
  console.log(`\n⚠️  手動操作が必要です: ${message}`);
  console.log(`   セレクター "${waitForSelector}" が表示されるまで待機します（最大 ${timeout / 1000}秒）\n`);
  await page.waitForSelector(waitForSelector, { timeout });
  console.log('✅ 手動操作完了');
}
