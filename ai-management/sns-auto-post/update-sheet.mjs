/**
 * update-sheet.mjs - 既存スプレッドシートの列構成を新仕様に更新する
 *
 * 変更点:
 * - 商品マスタ: ターゲット・悩み・ベネフィット列を追加
 * - 投稿スケジュール: 生成日時列追加、SNSに「X」追加、ステータスに「要修正」追加
 * - テンプレート: X追加、内容を更新
 */

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
  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);

  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  auth.setCredentials(token);
  auth.on('tokens', (t) => writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2)));

  const sheets = google.sheets({ version: 'v4', auth });

  // シートIDを取得
  const { data: spreadsheet } = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetIds = {};
  for (const s of spreadsheet.sheets) {
    sheetIds[s.properties.title] = s.properties.sheetId;
  }

  console.log('📝 シート構成を更新中...');

  // ===== 1. ヘッダーを新しい構成に更新 =====
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: '商品マスタ!A1:J1',
          values: [['商品ID', '商品名', 'カテゴリ', 'ターゲット', 'ターゲットの悩み', 'ベネフィット', '商品URL', '写真URL', '価格', '補足情報']],
        },
        {
          range: '投稿スケジュール!A1:I1',
          values: [['投稿日', 'SNS', '商品ID', '形式', '生成テキスト', 'ステータス', '生成日時', '投稿URL', '備考']],
        },
        {
          range: 'テンプレート!A1:E1',
          values: [['SNS名', 'トーン', '文字数目安', 'ハッシュタグ個数', 'CTA例']],
        },
        {
          range: 'テンプレート!A2:E7',
          values: [
            ['Instagram', 'カジュアル・体験談ベース', '300〜500文字', '10〜15個（大3+中5+小5）', 'プロフィールのリンクから'],
            ['X', '短文・インパクト重視', '140文字以内', '3個以内', 'URL直貼り'],
            ['Threads', 'ひとりごと・内省的', '100〜200文字', '3〜5個', '売り込み感排除'],
            ['Facebook', 'やや丁寧・情報的', '300〜500文字', '3〜5個', '詳しくはこちら→（URL）'],
            ['TikTok', 'テンポ良く・若者向け', '100〜300文字', '3〜5個', 'コメントで教えて'],
            ['YouTube Shorts', '説明的・丁寧', '50〜100文字', '3〜5個', 'チャンネル登録お願いします'],
          ],
        },
      ],
    },
  });

  // ===== 2. 書式更新 =====
  const requests = [];

  // 商品マスタ: 新しい列幅（10列）
  const productWidths = [100, 200, 120, 200, 250, 250, 300, 300, 80, 250];
  productWidths.forEach((w, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sheetIds['商品マスタ'], dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: w }, fields: 'pixelSize',
      },
    });
  });

  // 商品マスタ: ヘッダー装飾（10列に拡張）
  requests.push({
    repeatCell: {
      range: { sheetId: sheetIds['商品マスタ'], startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.26, green: 0.52, blue: 0.96 },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  // 投稿スケジュール: 新しい列幅（9列）
  const scheduleWidths = [120, 120, 100, 100, 500, 100, 160, 300, 200];
  scheduleWidths.forEach((w, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sheetIds['投稿スケジュール'], dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: w }, fields: 'pixelSize',
      },
    });
  });

  // 投稿スケジュール: ヘッダー装飾（9列に拡張）
  requests.push({
    repeatCell: {
      range: { sheetId: sheetIds['投稿スケジュール'], startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.26, green: 0.52, blue: 0.96 },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  // 投稿スケジュール: SNSプルダウン（X追加）
  requests.push({
    setDataValidation: {
      range: { sheetId: sheetIds['投稿スケジュール'], startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 1, endColumnIndex: 2 },
      rule: { condition: { type: 'ONE_OF_LIST', values: ['Instagram', 'X', 'Threads', 'Facebook', 'TikTok', 'YouTube Shorts'].map(v => ({ userEnteredValue: v })) }, showCustomUi: true },
    },
  });

  // 投稿スケジュール: ステータス（要修正追加）
  requests.push({
    setDataValidation: {
      range: { sheetId: sheetIds['投稿スケジュール'], startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 },
      rule: { condition: { type: 'ONE_OF_LIST', values: ['未生成', '生成済', '承認済', '投稿済', '要修正', 'スキップ'].map(v => ({ userEnteredValue: v })) }, showCustomUi: true },
    },
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });

  console.log('✅ シート構成の更新完了！');
  console.log('\n変更点:');
  console.log('  商品マスタ: ターゲット・悩み・ベネフィット列を追加（10列構成）');
  console.log('  投稿スケジュール: 生成日時列追加、SNSに「X」追加、ステータスに「要修正」追加');
  console.log('  テンプレート: X追加、内容を更新');
  console.log('\n次のステップ:');
  console.log('  1. GASのCode.gsを新版に貼り直し');
  console.log('  2. 商品マスタにターゲット・悩み・ベネフィットを入力');
  console.log('  3. 投稿文を再生成');
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
