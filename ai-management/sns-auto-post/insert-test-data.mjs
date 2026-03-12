import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env');
const TOKEN_PATH = join(__dirname, '../scripts/.cookies/google-token.json');
const SPREADSHEET_ID = '1cMygpk8PPlZKzRAnPus3TwDJmRYy9x8GSZ4Gj3_eat8';

function loadEnv() {
  const content = readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
auth.setCredentials(token);
auth.on('tokens', (t) => writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2)));

const sheets = google.sheets({ version: 'v4', auth });

// 商品マスタ: テスト商品3件
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: '商品マスタ!A2:J4',
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [
      ['SEAL001', 'シャチハタ ネーム9', '印鑑', '20〜40代の社会人', '毎回朱肉を出すのが面倒、持ち歩きにくい', 'キャップを外してポンッで完了。朱肉いらずでカバンに入れっぱなしOK', 'https://item.rakuten.co.jp/hankoya/name9/', '', 1980, '送料無料・即日出荷・全姓名対応'],
      ['STONE001', 'ローズクォーツ印鑑 天然石実印', '印鑑', '20〜30代女性・初めての実印', '実印って堅苦しい、自分らしさがない', '持つたびに気分が上がる。届いた瞬間テンション爆上がり', 'https://item.rakuten.co.jp/hankoya/rose-quartz/', '', 5980, '天然ナミビア産・宝石鑑別書付き・印鑑ケース付き'],
      ['PEN001', 'パーカー IM ボールペン 名入れ', '筆記具', '就活生・新社会人・プレゼント探し中の人', '安っぽいペンだと恥ずかしい、名入れギフトの選択肢が少ない', '名前入りだから特別感がある。就活の面接でさりげなく自信が持てる', 'https://item.rakuten.co.jp/hankoya/parker-im/', '', 3980, '名入れ無料・ギフトラッピング対応・最短翌日出荷'],
    ],
  },
});
console.log('商品マスタ: 3件登録');

// 投稿スケジュール: テスト6件
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: '投稿スケジュール!A2:F7',
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [
      ['2026/03/05', 'Instagram', 'SEAL001', '画像投稿', '', '未生成'],
      ['2026/03/05', 'X', 'SEAL001', 'テキスト', '', '未生成'],
      ['2026/03/06', 'Instagram', 'STONE001', '画像投稿', '', '未生成'],
      ['2026/03/06', 'Threads', 'STONE001', 'テキスト', '', '未生成'],
      ['2026/03/07', 'Instagram', 'PEN001', '画像投稿', '', '未生成'],
      ['2026/03/07', 'X', 'PEN001', 'テキスト', '', '未生成'],
    ],
  },
});
console.log('投稿スケジュール: 6件登録');
console.log('\nスプレッドシートを開いて確認してください');
