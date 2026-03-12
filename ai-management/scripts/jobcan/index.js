/**
 * jobcan/index.js - ジョブカン勤怠打刻スクリプト（全自動）
 *
 * 使い方:
 *   node jobcan/index.js 出勤
 *   node jobcan/index.js 退勤
 *   node jobcan/index.js 休憩開始
 *   node jobcan/index.js 休憩終了
 *
 * セッションが有効な間はブラウザが自動で開き、ボタンを押して閉じます。
 * セッション切れの場合は再ログインを案内して終了します:
 *   node ec/login-helper.js jobcan
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });

import { launchBrowser, isLoggedIn } from '../ec/utils/browser.js';
import { logger } from '../ec/utils/logger.js';
import dayjs from 'dayjs';

const SITE = 'ジョブカン';
const LOGIN_URL = 'https://id.jobcan.jp/users/sign_in?app_key=atd';
const ATTENDANCE_URL = 'https://ssl.jobcan.jp/employee';

const ACTION_ALIASES = {
  '出勤':   '出勤',
  '退勤':   '退勤',
  '休憩':   '休憩開始',
  '休憩開始': '休憩開始',
  '終了':   '休憩終了',
  '休憩終了': '休憩終了',
};

// 前回のブラウザセッションが残したロックファイルを削除する
function clearProfileLocks(siteName) {
  const profileDir = join(__dirname, '../.cookies', `profile-${siteName}`);
  for (const file of ['SingletonLock', 'SingletonCookie', 'lockfile']) {
    const lockPath = join(profileDir, file);
    if (existsSync(lockPath)) rmSync(lockPath, { force: true });
  }
}

async function clickAttendanceButton(page, action) {
  logger.info(SITE, `「${action}」ボタンを押します...`);

  const selectors = [
    `input[value="${action}"]`,
    `button:has-text("${action}")`,
    `[id*="adit"] input[value="${action}"]`,
    `.action_base input[value="${action}"]`,
  ];

  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(2000);
        logger.success(SITE, `「${action}」の打刻完了`);
        return;
      }
    } catch {
      // 次のセレクターを試す
    }
  }

  throw new Error(`「${action}」ボタンが見つかりません。ページを確認してください。`);
}

export async function runJobcan(rawAction) {
  const action = ACTION_ALIASES[rawAction];
  if (!action) {
    throw new Error(`不明なアクション: "${rawAction}"。出勤 / 退勤 / 休憩開始 / 休憩終了 のいずれかを指定してください。`);
  }

  const now = dayjs().format('HH:mm');
  console.log(`\n⏰ ${now} - ${action}打刻を開始します`);

  clearProfileLocks('jobcan');
  const { browser, context, page } = await launchBrowser({ headless: false, siteName: 'jobcan' });

  try {
    await page.goto(ATTENDANCE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);

    const loggedIn = await isLoggedIn(page, '.adit_name, [class*="employee-name"], #employee_section', 5000);

    if (!loggedIn) {
      // セッション切れ → Googleログイン画面を自動で開いて待機
      console.log('\n⚠️  セッション切れ。Googleログイン画面を開きます...');
      console.log('   mizukami@luchegroup.com でログインしてください。');
      await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});

      // ログイン完了（勤怠ページの要素が出るまで）を最大2分待つ
      console.log('   ログイン完了後、自動で打刻します...');
      await page.waitForSelector(
        '.adit_name, [class*="employee-name"], #employee_section',
        { timeout: 120000 }
      );
      await page.waitForTimeout(1000);
      console.log('   ✅ ログイン完了');
    }

    await clickAttendanceButton(page, action);

    console.log(`✅ ${action}の打刻が完了しました（${now}）`);
    await page.waitForTimeout(1500);

    return { success: true, action, time: now };
  } catch (err) {
    logger.error(SITE, `エラー: ${err.message}`);
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

// 直接実行
const rawAction = process.argv[2];
if (rawAction) {
  runJobcan(rawAction)
    .then(() => process.exit(0))
    .catch(err => { console.error(err.message); process.exit(1); });
} else {
  console.log('使い方: node jobcan/index.js [出勤|退勤|休憩開始|休憩終了]');
  process.exit(0);
}
