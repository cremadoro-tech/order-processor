/**
 * login-helper.js - 手動ログイン補助ツール
 *
 * 初回または Cookie が期限切れになった場合に使用する。
 * ブラウザを表示した状態でログインし、Cookie を保存する。
 *
 * 使い方:
 *   node ec/login-helper.js amazon
 *   node ec/login-helper.js rakuten
 *   node ec/login-helper.js all         # 全サイト順番にログイン
 *   node ec/login-helper.js --google    # Google OAuth認証
 */

import { config } from 'dotenv';
import { launchBrowser } from './utils/browser.js';
import { google } from 'googleapis';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import http from 'http';
import { exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env は ai-management/ 直下（scripts/ の2つ上）にある
config({ path: join(__dirname, '../../.env') });
const COOKIES_DIR = join(__dirname, '../.cookies');
const TOKEN_PATH = join(COOKIES_DIR, 'google-token.json');

// Shopify 管理画面URL（env から取得、なければ汎用ログインページ）
const shopifyAdminUrl = process.env.SHOPIFY_STORE_HANDLE
  ? `https://admin.shopify.com/store/${process.env.SHOPIFY_STORE_HANDLE}`
  : 'https://accounts.shopify.com/';

const SITE_URLS = {
  amazon:   'https://sellercentral.amazon.co.jp',
  rakuten:  'https://glogin.gl.rakuten.co.jp/2fa',
  yahoo:    `https://pro.store.yahoo.co.jp/${process.env.YAHOO_STORE_ID || 'pro.hankoya-store-7'}`,
  shopify:  shopifyAdminUrl,
  giftmall: 'https://board.giftmall.co.jp/mgt/home',
  aupay:    'https://manager.wowma.jp/wmshopclient/authclient/login',
  qoo10:    'https://qsm.qoo10.jp/GMKT.INC.Gsm.Web/Login.aspx',
  goq:      'https://order.goqsystem.com/goq21/form/goqsystem_new/systemlogin.php',
  nint:     'https://nint.jp/users/sign_in',
  jobcan:   'https://id.jobcan.jp/users/sign_in?app_key=atd',
};

// EC スクレイパーで使用するサイト（ec-all コマンドの対象）
const EC_SITES = ['amazon', 'rakuten', 'yahoo', 'shopify', 'goq'];

const LOGIN_COMPLETE_SELECTORS = {
  amazon:   'div[data-page-type="Dashboard"], #dashboard-container',
  rakuten:  'a[href*="norder"], #rms-global-nav',
  yahoo:    'a[href*="management"], [class*="store"]',
  shopify:  '[class*="Polaris"], #AppFrameMain',
  giftmall: '[class*="seller"], a[href*="orders"]',
  aupay:    'a[href*="orders"], [class*="dashboard"]',
  qoo10:    'a[href*="Order"], [class*="menu"]',
  goq:      'a[href*="dashboard"], [class*="menu"]',
  nint:     '[class*="dashboard"], nav',
};

/**
 * 指定サイトの手動ログインを補助する
 * 永続プロファイルを使用するため、ログイン状態は次回起動時も維持される
 */
async function loginSite(siteName) {
  const url = SITE_URLS[siteName];
  if (!url) {
    console.error(`❌ 不明なサイト: ${siteName}`);
    console.log(`  利用可能: ${Object.keys(SITE_URLS).join(', ')}`);
    return;
  }

  console.log(`\n🌐 ${siteName} のログインページを開きます...`);
  console.log(`   URL: ${url}`);
  console.log(`   ※ Googleアカウント（mizukami@luchegroup.com）でログインしてください`);

  // 永続プロファイルでブラウザを起動（前回のGoogle/サイトログイン状態が引き継がれる）
  const { browser, page } = await launchBrowser({ headless: false, siteName });

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  console.log(`\n⚠️  ブラウザでログインしてください。`);
  console.log(`   ログイン完了後、このターミナルにEnterキーを押してください。`);

  // Enterキー待機
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => rl.question('  ログイン完了後 [Enter] → ', () => { rl.close(); resolve(); }));

  console.log(`✅ ${siteName} のセッションを保存しました（プロファイルに自動保存）`);

  await browser.close();
}

/**
 * Google OAuth認証を行い、トークンを保存する
 * localhost:3000/callback でコードを受け取る方式（OOB廃止対応）
 *
 * 事前準備：Google Cloud Console の OAuth クライアントIDの
 * 「承認済みリダイレクト URI」に http://localhost:3000/callback を追加すること
 */
async function loginGoogle() {
  const PORT = 3000;
  const REDIRECT_URI = `http://localhost:${PORT}/callback`;

  console.log('\n🔑 Google OAuth認証を開始します...');
  console.log('');
  console.log('【前提確認】Google Cloud Console で以下が設定済みか確認してください:');
  console.log(`  承認済みリダイレクトURI: ${REDIRECT_URI}`);
  console.log('  未設定の場合: console.cloud.google.com → 認証情報 → OAuthクライアントID → リダイレクトURIに追加');
  console.log('');

  if (!existsSync(COOKIES_DIR)) {
    mkdirSync(COOKIES_DIR, { recursive: true });
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    prompt: 'consent',
  });

  // ローカルサーバーを立ててコールバックを待つ
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>認証エラー: ${error}</h1><p>ターミナルを確認してください。</p>`);
        server.close();
        reject(new Error(`Google認証エラー: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>✅ 認証完了！</h1><p>このタブを閉じてターミナルに戻ってください。</p>');
        server.close();
        resolve(code);
      }
    });

    server.listen(PORT, () => {
      console.log(`📡 ローカルサーバーを起動しました (port ${PORT})`);
      console.log('🌐 ブラウザでGoogleアカウントにログインしてください...\n');
      // macOS でブラウザを自動で開く
      exec(`open "${authUrl}"`, (err) => {
        if (err) {
          console.log('ブラウザを自動で開けませんでした。以下のURLを手動でブラウザに貼り付けてください:');
          console.log('\n' + authUrl + '\n');
        }
      });
    });

    server.on('error', (err) => {
      reject(new Error(`ポート${PORT}が使用中です: ${err.message}`));
    });

    // タイムアウト（3分）
    setTimeout(() => {
      server.close();
      reject(new Error('認証タイムアウト（3分）。再度実行してください。'));
    }, 180000);
  });

  console.log('\n🔄 トークンを取得中...');
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);

  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`✅ Google認証トークンを保存しました: ${TOKEN_PATH}`);
  console.log('   次回以降は自動的に認証されます。');
}

// メイン
const target = process.argv[2];

if (!target) {
  console.log('使い方: node ec/login-helper.js [サイト名 | ec-all | all | --google]');
  console.log('');
  console.log('  コマンド:');
  console.log('    ec-all   EC サイト（Amazon・楽天・Yahoo・Shopify・GoQ）を順番にログイン');
  console.log('    all      全サイト（nint・jobcan含む）を順番にログイン');
  console.log('    --google Google Sheets 認証');
  console.log('');
  console.log(`  個別サイト: ${Object.keys(SITE_URLS).join(', ')}`);
  process.exit(0);
}

if (target === '--google') {
  await loginGoogle();
} else if (target === 'ec-all') {
  console.log('\n📋 ECサイト一括ログイン開始');
  console.log('   各サイトのブラウザが順番に開きます。ログイン後 [Enter] で次のサイトへ進みます。\n');
  for (const site of EC_SITES) {
    await loginSite(site);
  }
  console.log('\n✅ 全ECサイトのログイン完了！次回以降は自動ログインされます。');
} else if (target === 'all') {
  for (const site of Object.keys(SITE_URLS)) {
    await loginSite(site);
  }
} else {
  await loginSite(target);
}
