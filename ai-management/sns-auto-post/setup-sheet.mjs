/**
 * setup-sheet.mjs - SNS投稿管理スプレッドシートを自動作成する
 *
 * 使い方:
 *   node setup-sheet.mjs
 *
 * 前提:
 *   - 親プロジェクトの Google OAuth 認証済み
 *     (未認証の場合: cd ../scripts && node ec/login-helper.js --google)
 */

import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env');
const TOKEN_PATH = join(__dirname, '../scripts/.cookies/google-token.json');

// .env を手動パース
function loadEnv() {
  const content = readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();

  // OAuth クライアント初期化
  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  );

  let token;
  try {
    token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  } catch {
    console.error('❌ Google認証トークンがありません。');
    console.error('   先に以下を実行してください:');
    console.error('   cd ../scripts && node ec/login-helper.js --google');
    process.exit(1);
  }
  auth.setCredentials(token);
  auth.on('tokens', (t) => writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2)));

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  // ===== 1. スプレッドシート作成 =====
  console.log('📄 スプレッドシートを作成中...');
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'SNS投稿管理', locale: 'ja_JP', timeZone: 'Asia/Tokyo' },
      sheets: [
        { properties: { title: '商品マスタ', index: 0 } },
        { properties: { title: '投稿スケジュール', index: 1 } },
        { properties: { title: 'テンプレート', index: 2 } },
      ],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;
  const spreadsheetUrl = createRes.data.spreadsheetUrl;
  console.log(`✅ 作成完了: ${spreadsheetUrl}`);

  // シートIDを取得
  const sheetIds = {};
  for (const s of createRes.data.sheets) {
    sheetIds[s.properties.title] = s.properties.sheetId;
  }

  // ===== 2. ヘッダーとデータを書き込む =====
  console.log('📝 ヘッダーとテンプレートデータを書き込み中...');

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: '商品マスタ!A1:H1',
          values: [['商品ID', '商品名', 'カテゴリ', '写真URL', '商品URL', '価格', 'オファー', 'メモ']],
        },
        {
          range: '投稿スケジュール!A1:H1',
          values: [['投稿日', 'SNS', '商品ID', '形式', '生成テキスト', 'ステータス', '投稿URL', '備考']],
        },
        {
          range: 'テンプレート!A1:E1',
          values: [['SNS名', 'トーン', '文字数上限', 'ハッシュタグルール', 'CTA例']],
        },
        {
          range: 'テンプレート!A2:E6',
          values: [
            ['Instagram', 'カジュアル・親しみやすい', 2200, '最大30個。ジャンル系5 + 商品系5 + トレンド系3', 'プロフィールのリンクからチェック✨'],
            ['Facebook', 'やや丁寧・情報的', 500, '3〜5個。シンプルに', '詳しくはこちら→（URL）'],
            ['Threads', 'カジュアル・短文', 500, '5個以内', 'リンクはプロフィールから📎'],
            ['TikTok', 'テンポ良く・若者向け', 300, '3〜5個。トレンドタグ重視', 'コメントで教えて！'],
            ['YouTube Shorts', '説明的・丁寧', 100, '3〜5個', 'チャンネル登録お願いします🙏'],
          ],
        },
      ],
    },
  });

  // ===== 3. 書式設定（ヘッダー装飾・列幅・入力規則・行固定） =====
  console.log('🎨 書式を設定中...');

  const requests = [];

  // 全シートのヘッダー装飾 + 行固定
  for (const [name, id] of Object.entries(sheetIds)) {
    const colCount = name === 'テンプレート' ? 5 : 8;
    requests.push(
      // ヘッダー背景色
      {
        repeatCell: {
          range: { sheetId: id, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.26, green: 0.52, blue: 0.96 },
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      // 行固定
      { updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    );
  }

  // 商品マスタ: 列幅
  const productWidths = [100, 200, 120, 300, 300, 80, 200, 200];
  productWidths.forEach((w, i) => {
    requests.push({ updateDimensionProperties: { range: { sheetId: sheetIds['商品マスタ'], dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: w }, fields: 'pixelSize' } });
  });

  // 投稿スケジュール: 列幅
  const scheduleWidths = [120, 120, 100, 100, 400, 100, 300, 200];
  scheduleWidths.forEach((w, i) => {
    requests.push({ updateDimensionProperties: { range: { sheetId: sheetIds['投稿スケジュール'], dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: w }, fields: 'pixelSize' } });
  });

  // テンプレート: 列幅
  const templateWidths = [150, 150, 100, 300, 300];
  templateWidths.forEach((w, i) => {
    requests.push({ updateDimensionProperties: { range: { sheetId: sheetIds['テンプレート'], dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: w }, fields: 'pixelSize' } });
  });

  // 投稿スケジュール: データ入力規則
  // SNS列 (B)
  requests.push({
    setDataValidation: {
      range: { sheetId: sheetIds['投稿スケジュール'], startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 1, endColumnIndex: 2 },
      rule: { condition: { type: 'ONE_OF_LIST', values: ['Instagram', 'Facebook', 'Threads', 'TikTok', 'YouTube Shorts'].map(v => ({ userEnteredValue: v })) }, showCustomUi: true },
    },
  });
  // 形式列 (D)
  requests.push({
    setDataValidation: {
      range: { sheetId: sheetIds['投稿スケジュール'], startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 3, endColumnIndex: 4 },
      rule: { condition: { type: 'ONE_OF_LIST', values: ['画像投稿', 'リール/ショート', 'カルーセル', 'ストーリー', 'テキスト'].map(v => ({ userEnteredValue: v })) }, showCustomUi: true },
    },
  });
  // ステータス列 (F)
  requests.push({
    setDataValidation: {
      range: { sheetId: sheetIds['投稿スケジュール'], startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 },
      rule: { condition: { type: 'ONE_OF_LIST', values: ['未生成', '生成済', '承認済', '投稿済', 'スキップ'].map(v => ({ userEnteredValue: v })) }, showCustomUi: true },
    },
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  // ===== 4. 結果表示 =====
  console.log('\n🎉 セットアップ完了！');
  console.log(`   スプレッドシートID: ${spreadsheetId}`);
  console.log(`   URL: ${spreadsheetUrl}`);
  console.log('\n次のステップ:');
  console.log('  1. スプレッドシートを開いて「拡張機能 → Apps Script」で gas/Code.gs を貼り付け');
  console.log('  2. スクリプトプロパティに CLAUDE_API_KEY を設定');
  console.log('  3. 商品マスタに商品を登録して投稿文生成を開始');
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
