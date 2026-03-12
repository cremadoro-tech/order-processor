/**
 * prepare-photos.mjs
 * Google Sheetsの投稿スケジュールから画像投稿/カルーセル行を取得し、
 * 商品マスタの写真をSNSごとの仕様にリサイズして出力する
 *
 * 使い方:
 *   node prepare-photos.mjs                        # 未処理の画像投稿を一括処理
 *   node prepare-photos.mjs --row 3                # 特定行のみ
 *   node prepare-photos.mjs --product SEAL001      # 特定商品のみ
 *   node prepare-photos.mjs --dry-run              # 処理内容の確認のみ
 */

import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env');
const TOKEN_PATH = join(__dirname, '../scripts/.cookies/google-token.json');
const SPREADSHEET_ID = '1cMygpk8PPlZKzRAnPus3TwDJmRYy9x8GSZ4Gj3_eat8';
const PHOTO_OUTPUT_DIR = join(__dirname, 'output', 'photos');

// ===== SNSごとの写真仕様 =====

const SNS_PHOTO_SPECS = {
  Instagram: {
    width: 1080, height: 1350, fit: 'cover', position: 'centre',
    maxPhotos: 20, quality: 90, suffix: 'ig',
  },
  X: {
    width: 1200, height: 675, fit: 'cover', position: 'centre',
    maxPhotos: 4, quality: 90, suffix: 'x',
  },
  Facebook: {
    width: 1200, height: 630, fit: 'cover', position: 'centre',
    maxPhotos: 25, quality: 90, suffix: 'fb',
  },
  Threads: {
    width: 1080, height: 1350, fit: 'cover', position: 'centre',
    maxPhotos: 20, quality: 90, suffix: 'th',
  },
  TikTok: {
    width: 1080, height: 1920, fit: 'contain', position: 'centre',
    background: { r: 255, g: 255, b: 255 },
    maxPhotos: 35, quality: 90, suffix: 'tk',
  },
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
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m1) return `https://drive.google.com/uc?export=download&id=${m1[1]}`;
  const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m2) return `https://drive.google.com/uc?export=download&id=${m2[1]}`;
  return url;
}

// ===== 写真ダウンロード =====

async function fetchOriginalImages(product) {
  const photoUrls = (product.photoUrl || '').split(/[,\s]+/).filter(u => u.startsWith('http'));
  if (photoUrls.length === 0) return [];

  const buffers = [];
  for (let i = 0; i < photoUrls.length; i++) {
    const url = toDirectDownloadUrl(photoUrls[i]);
    try {
      console.log(`   📥 写真${i + 1}をダウンロード中...`);
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // sharp で読み込み確認（壊れた画像を除外）
      await sharp(buf).metadata();
      buffers.push(buf);
    } catch (err) {
      console.log(`   ⚠️ 写真${i + 1}のダウンロード失敗: ${err.message}`);
    }
  }
  return buffers;
}

// ===== SNS仕様でリサイズ =====

async function resizeForSNS(imageBuffer, spec) {
  const opts = {
    width: spec.width,
    height: spec.height,
    fit: spec.fit,
    position: spec.position,
  };
  if (spec.background) opts.background = spec.background;

  return sharp(imageBuffer)
    .resize(opts)
    .jpeg({ quality: spec.quality })
    .toBuffer();
}

// ===== _post.txt 生成 =====

function generatePostFile(product, sns, spec, photoCount, date, postText) {
  const lines = [
    `商品: ${product.name} (${product.id})`,
    `SNS: ${sns}`,
    `サイズ: ${spec.width}x${spec.height}`,
    `枚数: ${photoCount}枚 / 最大${spec.maxPhotos}枚`,
    `投稿日: ${date || '未定'}`,
    `商品URL: ${product.url || ''}`,
    '',
    '--- 投稿テキスト ---',
    postText || '(未生成)',
  ];
  return lines.join('\n');
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

// ===== メイン =====

async function main() {
  const cliArgs = parseArgs();

  const env = loadEnv();
  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  auth.setCredentials(token);
  auth.on('tokens', (t) => writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2)));
  const sheets = google.sheets({ version: 'v4', auth });

  if (!existsSync(PHOTO_OUTPUT_DIR)) mkdirSync(PHOTO_OUTPUT_DIR, { recursive: true });

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

    // 画像投稿 or カルーセルのみ対象
    if (format !== '画像投稿' && format !== 'カルーセル') continue;
    // YouTube Shortsは写真非対応
    if (sns === 'YouTube Shorts') continue;
    // SNS仕様が定義されていない場合スキップ
    if (!SNS_PHOTO_SPECS[sns]) continue;

    // CLI フィルタ
    if (cliArgs.row && rowNum !== cliArgs.row) continue;
    if (cliArgs.product && productId !== cliArgs.product) continue;

    // 指定なしの場合、未生成 or 生成済のみ処理
    if (!cliArgs.row && !cliArgs.product) {
      if (status && status !== '未生成' && status !== '生成済') continue;
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      console.log(`⚠️ 行${rowNum}: 商品ID "${productId}" が見つかりません`);
      continue;
    }

    targetRows.push({ rowNum, date, sns, productId, format, text, status, product });
  }

  if (targetRows.length === 0) {
    console.log('対象行がありません');
    return;
  }

  console.log(`📸 ${targetRows.length}件の写真を準備します`);

  // dry-run
  if (cliArgs.dryRun) {
    for (const t of targetRows) {
      const spec = SNS_PHOTO_SPECS[t.sns];
      console.log(`  行${t.rowNum}: ${t.product.name} → ${t.sns} (${spec.width}x${spec.height}, 最大${spec.maxPhotos}枚)`);
    }
    return;
  }

  // 写真ダウンロードキャッシュ（同一商品の再ダウンロードを回避）
  const imageCache = new Map();

  for (const target of targetRows) {
    const spec = SNS_PHOTO_SPECS[target.sns];
    console.log(`\n--- 行${target.rowNum}: ${target.product.name} → ${target.sns} ---`);

    // 写真ダウンロード（キャッシュ利用）
    if (!imageCache.has(target.productId)) {
      const images = await fetchOriginalImages(target.product);
      imageCache.set(target.productId, images);
    }
    const originalImages = imageCache.get(target.productId);

    if (originalImages.length === 0) {
      console.log('   ⚠️ 写真URLが見つかりません、スキップします');
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `投稿スケジュール!I${target.rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['写真準備エラー: 写真URLなし']] },
      });
      continue;
    }

    // 枚数制限
    const photoCount = Math.min(originalImages.length, spec.maxPhotos);

    // 出力ディレクトリ作成
    const dateStr = (target.date || 'nodate').replace(/\//g, '');
    const dirName = `${dateStr}_${target.productId}_${spec.suffix}`;
    const outputDir = join(PHOTO_OUTPUT_DIR, dirName);
    mkdirSync(outputDir, { recursive: true });

    // リサイズ＆保存
    for (let i = 0; i < photoCount; i++) {
      const resized = await resizeForSNS(originalImages[i], spec);
      const filePath = join(outputDir, `${String(i + 1).padStart(2, '0')}.jpg`);
      writeFileSync(filePath, resized);
      console.log(`   ✅ ${String(i + 1).padStart(2, '0')}.jpg (${spec.width}x${spec.height})`);
    }

    // _post.txt 生成
    const postContent = generatePostFile(target.product, target.sns, spec, photoCount, target.date, target.text);
    writeFileSync(join(outputDir, '_post.txt'), postContent, 'utf-8');

    // スプレッドシート更新（備考列）
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `投稿スケジュール!I${target.rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[`写真: ${dirName}/ (${photoCount}枚)`]] },
    });

    console.log(`   📁 ${dirName}/ (${photoCount}枚)`);
  }

  console.log('\n🎉 完了！');
}

main().catch(err => { console.error('エラー:', err); process.exit(1); });
