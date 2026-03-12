/**
 * generate-video-from-sheet.mjs
 * Google Sheetsの投稿スケジュールからリール/ショート形式の行を取得し、
 * 商品マスタの情報 + カテゴリ別テンプレートで動画を自動生成する
 *
 * 商品マスタの「カテゴリ」列から自動判定:
 *   印鑑 → stamp / シール・スタンプ → name_seal / 筆記具 → pen / ケース → case_accessory
 *
 * 使い方:
 *   node generate-video-from-sheet.mjs              # 未生成の動画を一括生成
 *   node generate-video-from-sheet.mjs --row 3      # 特定行のみ
 *   node generate-video-from-sheet.mjs --product SEAL001  # 特定商品のみ
 */

import { google } from 'googleapis';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env');
const TOKEN_PATH = join(__dirname, '../scripts/.cookies/google-token.json');
const SPREADSHEET_ID = '1cMygpk8PPlZKzRAnPus3TwDJmRYy9x8GSZ4Gj3_eat8';
const OUTPUT_DIR = join(__dirname, 'output');
const TEMP_DIR = join(OUTPUT_DIR, '.tmp');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

const VIDEO = { width: 1080, height: 1920, fps: 30, transitionFrames: 15, bgColor: '#1a1a2e' };
const FONT_FAMILY = "'Noto Sans JP', 'Hiragino Sans', 'HiraginoSans-W6', sans-serif";

// ===== カテゴリ別テンプレート（generate-video.mjsと同じ） =====

const CATEGORY_TEMPLATES = {
  stamp: {
    slides: [
      { role: 'hook', duration: 3, textPosition: 'upper_third', textStyle: { mainSize: 58, subSize: 34, mainColor: '#ffffff' }, overlay: { type: 'none' } },
      { role: 'solution', duration: 3, textPosition: 'center', textStyle: { mainSize: 52, subSize: 30, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'benefit', duration: 3, textPosition: 'center', textStyle: { mainSize: 48, subSize: 28, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'social_proof', duration: 2.5, textPosition: 'lower_third', textStyle: { mainSize: 36, subSize: 24, mainColor: '#ffd700' }, overlay: { type: 'band', opacity: 0.6 } },
      { role: 'cta', duration: 3.5, textPosition: 'center', textStyle: { mainSize: 56, subSize: 32, mainColor: '#ffffff', priceColor: '#ff6b6b' }, overlay: { type: 'gradient_bottom', opacity: 0.5 } },
    ],
  },
  name_seal: {
    slides: [
      { role: 'hook', duration: 3, textPosition: 'upper_third', textStyle: { mainSize: 54, subSize: 32, mainColor: '#ffffff' }, overlay: { type: 'none' } },
      { role: 'pain', duration: 2.5, textPosition: 'center', textStyle: { mainSize: 46, subSize: 28, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.45 } },
      { role: 'solution', duration: 3, textPosition: 'center', textStyle: { mainSize: 50, subSize: 28, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'social_proof', duration: 2.5, textPosition: 'lower_third', textStyle: { mainSize: 34, subSize: 24, mainColor: '#ffd700' }, overlay: { type: 'band', opacity: 0.6 } },
      { role: 'cta', duration: 4, textPosition: 'center', textStyle: { mainSize: 54, subSize: 34, mainColor: '#ffffff', priceColor: '#ff6b6b' }, overlay: { type: 'gradient_bottom', opacity: 0.5 } },
    ],
  },
  pen: {
    slides: [
      { role: 'hook', duration: 3, textPosition: 'lower_third', textStyle: { mainSize: 48, subSize: 30, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.3 } },
      { role: 'feature', duration: 3, textPosition: 'center', textStyle: { mainSize: 44, subSize: 26, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'scene', duration: 3, textPosition: 'lower_third', textStyle: { mainSize: 40, subSize: 26, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.35 } },
      { role: 'cta', duration: 3.5, textPosition: 'center', textStyle: { mainSize: 52, subSize: 30, mainColor: '#ffffff', priceColor: '#ff6b6b' }, overlay: { type: 'gradient_bottom', opacity: 0.5 } },
    ],
  },
  case_accessory: {
    slides: [
      { role: 'hook', duration: 3, textPosition: 'lower_third', textStyle: { mainSize: 46, subSize: 28, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.25 } },
      { role: 'variation', duration: 3, textPosition: 'upper_third', textStyle: { mainSize: 42, subSize: 26, mainColor: '#ffffff' }, overlay: { type: 'none' } },
      { role: 'feature', duration: 3, textPosition: 'center', textStyle: { mainSize: 44, subSize: 28, mainColor: '#ffffff' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'cta', duration: 3.5, textPosition: 'center', textStyle: { mainSize: 52, subSize: 30, mainColor: '#ffffff', priceColor: '#ff6b6b' }, overlay: { type: 'gradient_bottom', opacity: 0.5 } },
    ],
  },
};

// ===== カテゴリ自動判定 =====

function detectCategory(categoryText) {
  const t = (categoryText || '').toLowerCase();
  if (t.includes('シール') || t.includes('スタンプ') || t.includes('おなまえ') || t.includes('名前')) return 'name_seal';
  if (t.includes('ペン') || t.includes('筆記') || t.includes('ボールペン') || t.includes('万年筆')) return 'pen';
  if (t.includes('ケース') || t.includes('アクセサリ')) return 'case_accessory';
  return 'stamp'; // 印鑑・シャチハタ系がデフォルト
}

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

// ===== メイン =====

async function main() {
  const cliArgs = parseArgs();

  const env = loadEnv();
  const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  auth.setCredentials(token);
  auth.on('tokens', (t) => writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2)));
  const sheets = google.sheets({ version: 'v4', auth });

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

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
    const [date, sns, productId, format, text, status] = rows[i];
    const rowNum = i + 2;

    if (format !== 'リール/ショート') continue;
    if (cliArgs.row && rowNum !== cliArgs.row) continue;
    if (cliArgs.product && productId !== cliArgs.product) continue;
    if (!cliArgs.row && !cliArgs.product && status && status !== '未生成') continue;

    const product = products.find(p => p.id === productId);
    if (!product) {
      console.log(`⚠️ 行${rowNum}: 商品ID「${productId}」が見つかりません。スキップ`);
      continue;
    }
    targetRows.push({ rowNum, date, sns, productId, format, product });
  }

  if (targetRows.length === 0) {
    console.log('📭 対象の行がありません（リール/ショート形式で未生成のものがない）');
    return;
  }

  console.log(`🎬 ${targetRows.length}件の動画を生成します\n`);

  for (const target of targetRows) {
    const category = detectCategory(target.product.category);
    console.log(`--- 行${target.rowNum}: ${target.product.name} [${category}] (${target.sns}) ---`);

    try {
      const images = await fetchProductImages(target.product);

      // 商品マスタの情報から動画生成パラメータを構築
      const args = {
        productId: target.productId,
        category,
        name: target.product.name,
        price: target.product.price ? Number(target.product.price) : null,
        pain: target.product.painPoint || '',
        benefit: target.product.benefit || '',
        solution: target.product.benefit || '',
        feature: '',
        scene: '',
        hook: '',
        seasonalHook: '',
        variation: '',
        variationSub: '',
        colorCount: '',
        sceneSub: '',
        proofText: '',
        proofSub: '',
        rating: '',
        reviewCount: '',
        shopName: '',
        painDetail: '',
        benefitSub: '',
        solutionSub: '',
        featureSub: '',
        cta: '▼ 商品リンクはプロフィールから',
        images,
      };

      const outputPath = await generateVideo(args);

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `投稿スケジュール!I${target.rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[`動画: ${outputPath}`]] },
      });

      console.log(`✅ 生成完了: ${outputPath}\n`);
    } catch (err) {
      console.error(`❌ 行${target.rowNum} エラー: ${err.message}\n`);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `投稿スケジュール!I${target.rowNum}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[`動画生成エラー: ${err.message}`]] },
      });
    }
  }

  cleanTemp();
  console.log('🎉 完了！');
}

// ===== 写真取得 =====

async function fetchProductImages(product) {
  const photoUrls = (product.photoUrl || '').split(/[,\s]+/).filter(u => u.startsWith('http'));

  if (photoUrls.length === 0) {
    console.log('   📎 写真URLなし → ダミー画像を使用');
    return generateDummyImages(product);
  }

  const paths = [];
  for (let i = 0; i < Math.min(photoUrls.length, 5); i++) {
    let url = toDirectDownloadUrl(photoUrls[i]);
    console.log(`   📥 写真${i + 1}をダウンロード中...`);
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const path = join(TEMP_DIR, `photo_${i}.png`);
      await sharp(buffer).png().toFile(path);
      paths.push(path);
    } catch (err) {
      console.log(`   ⚠️ 写真${i + 1}のダウンロード失敗: ${err.message}`);
    }
  }

  return paths.length > 0 ? paths : generateDummyImages(product);
}

// ===== 動画生成（新カテゴリ対応） =====

async function generateVideo(args) {
  const category = args.category || 'stamp';
  const template = CATEGORY_TEMPLATES[category];
  const images = args.images;

  // スライド構成
  let accumulated = 0;
  const activeSlides = [];
  for (const slide of template.slides) {
    if (accumulated + slide.duration > 16) break;
    activeSlides.push(slide);
    accumulated += slide.duration;
  }

  const slideConfigs = activeSlides.map((slide, i) => {
    const imageIndex = Math.min(i, images.length - 1);
    const text = generateSlideText(slide.role, args, category);
    return {
      imagePath: images[imageIndex] || images[0],
      slideConfig: slide,
      title: text.main,
      subtitle: text.sub,
      extra: text.extra || '',
    };
  });

  // フレーム生成
  const framePaths = [];
  let frameOffset = 0;
  for (let i = 0; i < slideConfigs.length; i++) {
    const config = slideConfigs[i];
    const frames = await generateSlideFrames(config, i, frameOffset);
    framePaths.push(...frames);
    frameOffset += Math.round(VIDEO.fps * config.slideConfig.duration);
  }

  const outputPath = join(OUTPUT_DIR, `${args.productId}_${Date.now()}.mp4`);
  buildFFmpegVideo(framePaths, outputPath, findBGM());
  cleanTemp();
  return outputPath;
}

// ===== テロップ自動生成 =====

function generateSlideText(role, args, category) {
  const texts = {
    hook: () => {
      const patterns = {
        stamp: { main: args.pain || '朱肉を出すのが面倒すぎる…', sub: '' },
        name_seal: { main: args.pain || '入園準備、名前書き地獄…', sub: args.seasonalHook || '' },
        pen: { main: args.hook || '名前が入るだけで、特別になる', sub: '' },
        case_accessory: { main: args.hook || 'この色、見たことある？', sub: args.name },
      };
      return patterns[category] || { main: args.name, sub: '' };
    },
    solution: () => ({ main: args.solution || args.benefit || '', sub: args.solutionSub || '' }),
    pain: () => ({ main: args.pain || '', sub: args.painDetail || '' }),
    benefit: () => ({ main: args.benefit || '', sub: args.benefitSub || '' }),
    feature: () => ({ main: args.feature || args.benefit || '', sub: args.featureSub || '' }),
    variation: () => ({ main: args.variation || `全${args.colorCount || '5'}色`, sub: args.variationSub || 'あなたの推し色は？' }),
    scene: () => ({ main: args.scene || '仕事にも、贈り物にも', sub: args.sceneSub || '' }),
    social_proof: () => ({ main: args.proofText || `★${args.rating || '4.5'} レビュー${args.reviewCount || '500'}件超`, sub: args.proofSub || '' }),
    cta: () => {
      const priceText = args.price ? `¥${Number(args.price).toLocaleString()}` : '';
      return { main: priceText, sub: args.cta || '▼ 商品リンクはプロフィールから', extra: args.price ? '（税込・送料無料）' : '' };
    },
  };
  const gen = texts[role];
  return gen ? gen() : { main: '', sub: '' };
}

// ===== フレーム画像生成 =====

async function generateSlideFrames(config, slideIndex, frameOffset) {
  const duration = config.slideConfig.duration;
  const framesPerSlide = Math.round(VIDEO.fps * duration);
  const paths = [];

  const baseImage = await createSlideImage(config);
  const basePath = join(TEMP_DIR, `slide_${slideIndex}_base.png`);
  await sharp(baseImage).png().toFile(basePath);

  for (let frame = 0; frame < framesPerSlide; frame++) {
    let opacity = 1.0;
    if (frame < VIDEO.transitionFrames) opacity = frame / VIDEO.transitionFrames;
    else if (frame >= framesPerSlide - VIDEO.transitionFrames) opacity = (framesPerSlide - frame) / VIDEO.transitionFrames;

    if (opacity >= 0.99) {
      paths.push(basePath);
    } else {
      const framePath = join(TEMP_DIR, `frame_${String(frameOffset + frame).padStart(5, '0')}.png`);
      await sharp({ create: { width: VIDEO.width, height: VIDEO.height, channels: 4, background: hexToRGBA(VIDEO.bgColor, 1) } })
        .composite([{ input: await sharp(baseImage).ensureAlpha(opacity).toBuffer(), top: 0, left: 0 }])
        .png().toFile(framePath);
      paths.push(framePath);
    }
  }
  return paths;
}

// ===== スライド画像合成 =====

async function createSlideImage(config) {
  const { imagePath, slideConfig, title, subtitle, extra } = config;
  const { textPosition, textStyle, overlay: overlayConfig } = slideConfig;

  let baseBuffer;
  if (existsSync(imagePath)) {
    baseBuffer = await sharp(imagePath).resize(VIDEO.width, VIDEO.height, { fit: 'cover', position: 'centre' }).toBuffer();
  } else {
    baseBuffer = await sharp({ create: { width: VIDEO.width, height: VIDEO.height, channels: 4, background: hexToRGBA('#2d2d44', 1) } }).png().toBuffer();
  }

  const textSvg = buildTextSVG(title, subtitle, extra, textStyle);
  const textBuffer = Buffer.from(textSvg);

  const titleLines = wrapText(title, Math.floor((VIDEO.width - 120) / textStyle.mainSize));
  const subLines = wrapText(subtitle, Math.floor((VIDEO.width - 120) / textStyle.subSize));
  const textBlockHeight = Math.ceil(
    (titleLines.length * textStyle.mainSize * 1.4)
    + (subLines.length > 0 ? textStyle.mainSize * 0.6 + subLines.length * textStyle.subSize * 1.4 : 0)
    + (extra ? 24 * 2 : 0)
  );

  const textY = getTextY(textPosition, VIDEO.height, textBlockHeight);

  const composites = [];
  const overlayResult = await createOverlay(overlayConfig, VIDEO.width, VIDEO.height, textY, textBlockHeight);
  if (overlayResult) composites.push({ input: overlayResult.buffer, top: overlayResult.top, left: 0 });
  composites.push({ input: textBuffer, top: textY, left: 0 });

  return sharp(baseBuffer).composite(composites).png().toBuffer();
}

function getTextY(textPosition, videoHeight, textBlockHeight) {
  switch (textPosition) {
    case 'upper_third': return Math.floor(videoHeight * 0.16);
    case 'center': return Math.floor((videoHeight - textBlockHeight) / 2);
    case 'lower_third': return Math.floor(videoHeight * 0.86 - textBlockHeight);
    default: return Math.floor(videoHeight * 0.55);
  }
}

async function createOverlay(overlayConfig, width, height, textY, textBlockHeight) {
  switch (overlayConfig.type) {
    case 'none': return null;
    case 'gradient_bottom': {
      const gradH = Math.floor(height * 0.5);
      return { buffer: await sharp({ create: { width, height: gradH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: overlayConfig.opacity } } }).png().toBuffer(), top: height - gradH };
    }
    case 'band': {
      const padding = 40;
      const bandH = Math.ceil(Math.max(textBlockHeight + padding * 2, 100));
      const bandTop = Math.max(Math.floor(textY - padding), 0);
      return { buffer: await sharp({ create: { width, height: bandH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: overlayConfig.opacity } } }).png().toBuffer(), top: bandTop };
    }
    default: return null;
  }
}

// ===== SVGテキスト生成 =====

function buildTextSVG(title, subtitle, extra, textStyle) {
  const width = VIDEO.width;
  const padding = 60;
  const maxWidth = width - padding * 2;
  const titleLines = wrapText(title, Math.floor(maxWidth / textStyle.mainSize));
  const subtitleLines = wrapText(subtitle, Math.floor(maxWidth / textStyle.subSize));

  let y = 0;
  let elements = '';
  const shadowFilter = `<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.7"/></filter></defs>`;

  for (const line of titleLines) {
    y += textStyle.mainSize * 1.4;
    const color = (textStyle.priceColor && line.startsWith('¥')) ? textStyle.priceColor : textStyle.mainColor;
    elements += `<text x="${width / 2}" y="${y}" font-family="${FONT_FAMILY}" font-size="${textStyle.mainSize}" font-weight="bold" fill="${color}" text-anchor="middle" filter="url(#shadow)">${escapeXml(line)}</text>\n`;
  }

  if (subtitle) {
    y += textStyle.mainSize * 0.6;
    for (const line of subtitleLines) {
      y += textStyle.subSize * 1.4;
      elements += `<text x="${width / 2}" y="${y}" font-family="${FONT_FAMILY}" font-size="${textStyle.subSize}" fill="${textStyle.mainColor}" text-anchor="middle" filter="url(#shadow)">${escapeXml(line)}</text>\n`;
    }
  }

  if (extra) {
    y += textStyle.subSize * 0.6;
    y += 24 * 1.4;
    elements += `<text x="${width / 2}" y="${y}" font-family="${FONT_FAMILY}" font-size="24" fill="rgba(255,255,255,0.7)" text-anchor="middle" filter="url(#shadow)">${escapeXml(extra)}</text>\n`;
  }

  const svgHeight = Math.ceil(y + 40);
  return `<svg width="${width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">${shadowFilter}${elements}</svg>`;
}

// ===== FFmpeg =====

function buildFFmpegVideo(framePaths, outputPath, bgmPath) {
  const listPath = join(TEMP_DIR, 'frames.txt');
  writeFileSync(listPath, framePaths.map(p => `file '${p}'\nduration ${1 / VIDEO.fps}`).join('\n'));

  let cmd = `${FFMPEG} -y -f concat -safe 0 -i "${listPath}" -vf "fps=${VIDEO.fps},format=yuv420p" -c:v libx264 -preset medium -crf 23 -movflags +faststart`;
  if (bgmPath) cmd += ` -i "${bgmPath}" -c:a aac -b:a 128k -shortest`;
  cmd += ` "${outputPath}"`;

  execSync(cmd, { stdio: 'pipe', timeout: 180000 });
}

// ===== ヘルパー =====

function wrapText(text, charsPerLine) {
  if (!text) return [];
  if (charsPerLine <= 0) charsPerLine = 15;
  const lines = [];
  for (let i = 0; i < text.length; i += charsPerLine) lines.push(text.slice(i, i + charsPerLine));
  return lines;
}

function escapeXml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function toDirectDownloadUrl(url) {
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m1) return `https://drive.google.com/uc?export=download&id=${m1[1]}`;
  const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m2) return `https://drive.google.com/uc?export=download&id=${m2[1]}`;
  return url;
}

function hexToRGBA(hex, alpha) { return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), alpha }; }

function findBGM() {
  const bgmDir = join(__dirname, 'assets', 'bgm');
  if (!existsSync(bgmDir)) return null;
  const files = readdirSync(bgmDir).filter(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav'));
  return files.length > 0 ? join(bgmDir, files[0]) : null;
}

function generateDummyImages(product) {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12'];
  const labels = [product.name, product.benefit || 'ベネフィット', 'CTA', '証明', '特徴'];
  return Promise.all(colors.map(async (color, i) => {
    const path = join(TEMP_DIR, `dummy_${i}.png`);
    const svg = `<svg width="${VIDEO.width}" height="${VIDEO.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" font-family="sans-serif" font-size="64" fill="white" text-anchor="middle" dominant-baseline="central">${escapeXml(labels[i])}</text></svg>`;
    await sharp(Buffer.from(svg)).resize(VIDEO.width, VIDEO.height).png().toFile(path);
    return path;
  }));
}

function cleanTemp() {
  if (!existsSync(TEMP_DIR)) return;
  for (const f of readdirSync(TEMP_DIR)) unlinkSync(join(TEMP_DIR, f));
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const result = { row: null, product: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--row') result.row = Number(argv[++i]);
    if (argv[i] === '--product') result.product = argv[++i];
  }
  return result;
}

main().catch(err => { console.error('❌ エラー:', err.message); process.exit(1); });
