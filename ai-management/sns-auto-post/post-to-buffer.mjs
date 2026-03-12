/**
 * post-to-buffer.mjs
 * Google Sheetsの投稿スケジュールを読み込み、Buffer GraphQL API経由でSNSに投稿を予約する
 *
 * 前提:
 *   1. buffer.com でアカウント作成 & SNSチャネル接続（無料枠: 3チャネル）
 *   2. Buffer設定 → API からアクセストークンを取得
 *   3. .env に BUFFER_ACCESS_TOKEN=... を追記
 *
 * 使い方:
 *   node post-to-buffer.mjs                        # 全対象行を処理
 *   node post-to-buffer.mjs --row 3                # 特定行のみ
 *   node post-to-buffer.mjs --product SEAL001      # 特定商品のみ
 *   node post-to-buffer.mjs --dry-run              # APIコールせず確認のみ
 */

import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env');
const TOKEN_PATH = join(__dirname, '../scripts/.cookies/google-token.json');
const SPREADSHEET_ID = '1cMygpk8PPlZKzRAnPus3TwDJmRYy9x8GSZ4Gj3_eat8';

const BUFFER_API = 'https://api.buffer.com';

// SNS名 → Bufferサービス名のマッピング
const SNS_TO_BUFFER_SERVICE = {
  Instagram: 'instagram',
  X: 'twitter',
  Facebook: 'facebook',
  Threads: 'threads',
};

// ===== .env読み込み =====

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

// ===== Google Drive URL変換 =====

function toDirectDownloadUrl(url) {
  // lh3.googleusercontent.com 形式はBuffer等の外部サービスから直接取得可能
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m1) return `https://lh3.googleusercontent.com/d/${m1[1]}`;
  const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}`;
  return url;
}

// ===== Buffer GraphQL API =====

async function bufferQuery(query, token) {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Buffer API: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Buffer GraphQL: ${json.errors.map(e => e.message).join(', ')}`);
  }
  return json.data;
}

// ===== 投稿日をISO 8601(UTC)に変換 =====

function toScheduledAt(dateStr) {
  // dateStr: "2026/03/05" or "2026/03/05 18:30" → UTC ISO文字列
  // 時刻はJSTとして扱い、UTCに変換（JST = UTC+9）
  // 時刻省略時はJST 09:00（= UTC 00:00）をデフォルトとする
  const str = (dateStr || '').trim();
  if (!str) return null;
  const [datePart, timePart] = str.split(/\s+/);
  const [y, m, d] = datePart.split('/');
  if (!y || !m || !d) return null;

  let jstHour = 9, jstMin = 0;
  if (timePart) {
    const [h, min] = timePart.split(':');
    // "0:00:00" はGoogle Sheetsの自動付加 → 時刻指定なしとして扱う
    if (!(Number(h) === 0 && (Number(min) || 0) === 0)) {
      jstHour = Number(h);
      jstMin = Number(min) || 0;
    }
  }
  // JST → UTC: Date.UTCでタイムゾーン非依存に変換
  const utcMs = Date.UTC(Number(y), Number(m) - 1, Number(d), jstHour - 9, jstMin);
  return new Date(utcMs).toISOString();
}

// ===== CLI引数 =====

function parseArgs() {
  const argv = process.argv.slice(2);
  const result = { row: null, product: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--row') result.row = Number(argv[++i]);
    if (argv[i] === '--product') result.product = argv[++i];
    if (argv[i] === '--dry-run') result.dryRun = true;
  }
  return result;
}

// ===== GraphQLエスケープ =====

function gqlEscape(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// ===== メイン =====

async function main() {
  const cliArgs = parseArgs();
  const env = loadEnv();

  // Buffer トークン確認
  const bufferToken = env.BUFFER_ACCESS_TOKEN;
  if (!bufferToken) {
    console.error('ERROR: .env に BUFFER_ACCESS_TOKEN が設定されていません');
    process.exit(1);
  }

  // Buffer Organization & Channels 取得
  console.log('Buffer チャネルを取得中...');
  const orgData = await bufferQuery('{ account { organizations { id name } } }', bufferToken);
  const orgs = orgData.account.organizations;
  if (!orgs.length) {
    console.error('ERROR: Buffer organizationがありません');
    process.exit(1);
  }
  const orgId = orgs[0].id;

  const channelData = await bufferQuery(
    `{ channels(input: { organizationId: "${orgId}" }) { id name service } }`,
    bufferToken
  );
  const channels = channelData.channels;

  if (!channels.length) {
    console.error('ERROR: Bufferに接続済みのSNSチャネルがありません');
    process.exit(1);
  }

  // チャネルマッピング
  const channelMap = {};
  console.log('\n接続済みチャネル:');
  for (const ch of channels) {
    console.log(`   ${ch.service} -> @${ch.name} (id: ${ch.id})`);
    channelMap[ch.service] = ch;
  }

  // Google Sheets認証
  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  auth.setCredentials(token);
  auth.on('tokens', (newTokens) => {
    const existing = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
    const merged = { ...existing, ...newTokens };
    writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 商品マスタ取得
  const { data: productData } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: '商品マスタ!A2:J',
  });
  const products = (productData.values || []).map(row => ({
    id: row[0], name: row[1], category: row[2], target: row[3],
    painPoint: row[4], benefit: row[5], url: row[6], photoUrl: row[7],
    price: row[8], notes: row[9],
  }));

  // 投稿スケジュール取得
  const { data: scheduleData } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: '投稿スケジュール!A2:I',
  });
  const rows = scheduleData.values || [];

  // 対象行をフィルタ
  const targetRows = [];
  for (let i = 0; i < rows.length; i++) {
    const [date, sns, productId, format, text, status] = rows[i] || [];
    const rowNum = i + 2;

    // テキストが必要
    if (!text) continue;

    // 画像投稿 or カルーセル or テキスト
    if (format !== '画像投稿' && format !== 'カルーセル' && format !== 'テキスト') continue;

    // Bufferで対応しているSNSのみ
    const bufferService = SNS_TO_BUFFER_SERVICE[sns];
    if (!bufferService) continue;

    // Bufferにチャネルがあるか
    if (!channelMap[bufferService]) continue;

    // CLI フィルタ
    if (cliArgs.row && rowNum !== cliArgs.row) continue;
    if (cliArgs.product && productId !== cliArgs.product) continue;

    // 指定なしの場合、生成済のみ処理
    if (!cliArgs.row && !cliArgs.product) {
      if (status !== '生成済' && status !== '写真準備済') continue;
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      console.log(`Warning: 行${rowNum}: 商品ID "${productId}" が見つかりません`);
      continue;
    }

    targetRows.push({
      rowNum, date, sns, productId, format, text, status,
      product, bufferService,
      channelId: channelMap[bufferService].id,
    });
  }

  if (targetRows.length === 0) {
    console.log('\n対象行がありません');
    return;
  }

  console.log(`\n${targetRows.length}件の投稿を予約します`);

  // dry-run
  if (cliArgs.dryRun) {
    for (const t of targetRows) {
      const scheduled = toScheduledAt(t.date);
      console.log(`  行${t.rowNum}: ${t.product.name} -> ${t.sns} (${scheduled || '日時なし'})`);
      console.log(`    テキスト: ${t.text.slice(0, 60)}...`);
      if (t.format !== 'テキスト') {
        const photoUrls = (t.product.photoUrl || '').split(/[,\s]+/).filter(u => u.startsWith('http'));
        console.log(`    写真: ${photoUrls.length}枚`);
      }
    }
    return;
  }

  // 投稿処理
  let successCount = 0;
  for (const target of targetRows) {
    console.log(`\n--- 行${target.rowNum}: ${target.product.name} -> ${target.sns} ---`);

    try {
      // 画像URLリスト構築
      let assetsFragment = '';
      if (target.format !== 'テキスト') {
        const photoUrls = (target.product.photoUrl || '').split(/[,\s]+/).filter(u => u.startsWith('http'));
        if (photoUrls.length > 0) {
          const imageInputs = photoUrls.map(u => `{ url: "${gqlEscape(toDirectDownloadUrl(u))}" }`).join(', ');
          assetsFragment = `, assets: { images: [${imageInputs}] }`;
          console.log(`   写真: ${photoUrls.length}枚`);
        }
      }

      // SNS別メタデータ
      let metadataFragment = '';
      if (target.bufferService === 'instagram') {
        metadataFragment = ', metadata: { instagram: { type: post, shouldShareToFeed: true } }';
      } else if (target.bufferService === 'threads') {
        metadataFragment = ', metadata: { threads: { type: post } }';
      }

      // スケジュール設定（過去日はキューに追加）
      const dueAt = toScheduledAt(target.date);
      let scheduleFragment = '';
      let modeValue = 'addToQueue';
      if (dueAt && new Date(dueAt) > new Date()) {
        scheduleFragment = `, dueAt: "${dueAt}"`;
        modeValue = 'customScheduled';
        console.log(`   予約: ${dueAt}`);
      } else if (dueAt) {
        console.log(`   予約日が過去のためキューに追加: ${target.date}`);
      }

      // GraphQL mutation
      const mutation = `mutation {
        createPost(input: {
          channelId: "${target.channelId}"
          text: "${gqlEscape(target.text)}"
          schedulingType: automatic
          mode: ${modeValue}
          ${scheduleFragment}
          ${assetsFragment}
          ${metadataFragment}
        }) {
          ... on PostActionSuccess {
            post { id text }
          }
          ... on MutationError {
            message
          }
        }
      }`;

      const result = await bufferQuery(mutation, bufferToken);

      if (result.createPost.post) {
        const postId = result.createPost.post.id;
        console.log(`   OK: 予約成功 (ID: ${postId})`);

        // スプレッドシート更新
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: [
              { range: `投稿スケジュール!F${target.rowNum}`, values: [['投稿予約済']] },
              { range: `投稿スケジュール!I${target.rowNum}`, values: [[`Buffer: ${postId}`]] },
            ],
          },
        });
        successCount++;
      } else {
        const errMsg = result.createPost.message || JSON.stringify(result.createPost);
        console.log(`   NG: ${errMsg}`);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `投稿スケジュール!I${target.rowNum}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[`Buffer: ${errMsg.slice(0, 100)}`]] },
        });
      }
    } catch (err) {
      console.log(`   ERROR: ${err.message}`);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `投稿スケジュール!I${target.rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[`Buffer: ${err.message.slice(0, 100)}`]] },
      });
    }
  }

  console.log(`\n完了: ${successCount}/${targetRows.length}件を予約しました`);
}

main().catch(err => { console.error('エラー:', err); process.exit(1); });
