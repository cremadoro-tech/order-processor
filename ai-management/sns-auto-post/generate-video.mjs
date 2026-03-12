/**
 * generate-video.mjs - 商品カテゴリ別SNS用スライドショー動画を生成する
 *
 * 処理フロー:
 *   1. カテゴリ別テンプレートでスライド構成を決定
 *   2. sharp で各スライドにテロップ + オーバーレイを合成
 *   3. FFmpeg で動画（約15秒）を生成
 *   4. BGMがあれば合成
 *
 * カテゴリ:
 *   stamp       - 印鑑・シャチハタ系（共感→解決→証明→CTA）
 *   name_seal   - おなまえシール系（季節感→悩み→解決→実績→CTA）
 *   pen         - ペン・文具系（世界観→特別感→使用シーン→CTA）
 *   case_accessory - ケース・アクセサリー系（ビジュアル→カラバリ→機能→CTA）
 *
 * 使い方:
 *   node generate-video.mjs --category stamp --name "シャチハタ ネーム9" --price 1980 \
 *     --pain "朱肉を出すのが面倒すぎる…" --solution "キャップを外してポンッ！で完了" \
 *     --benefit "朱肉いらず、カバンに入れっぱなしOK" --images img1.jpg img2.jpg img3.jpg
 */

import sharp from 'sharp';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const OUTPUT_DIR = join(__dirname, 'output');
const TEMP_DIR = join(__dirname, 'output', '.tmp');

// 動画設定
const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  transitionFrames: 15, // フェード 0.5秒
  bgColor: '#1a1a2e',
};

// SVGフォント
const FONT_FAMILY = "'Noto Sans JP', 'Hiragino Sans', 'HiraginoSans-W6', sans-serif";

// ===== カテゴリ別テンプレート =====

const CATEGORY_TEMPLATES = {
  stamp: {
    slidePattern: 'pain_solve',
    slides: [
      { role: 'hook', duration: 3, textPosition: 'upper_third', textStyle: { mainSize: 58, subSize: 34, mainColor: '#ffffff', emphasis: 'scale_in' }, overlay: { type: 'none' } },
      { role: 'solution', duration: 3, textPosition: 'center', textStyle: { mainSize: 52, subSize: 30, mainColor: '#ffffff', emphasis: 'pop' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'benefit', duration: 3, textPosition: 'center', textStyle: { mainSize: 48, subSize: 28, mainColor: '#ffffff', emphasis: 'fade_in' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'social_proof', duration: 2.5, textPosition: 'lower_third', textStyle: { mainSize: 36, subSize: 24, mainColor: '#ffd700', emphasis: 'fade_in' }, overlay: { type: 'band', opacity: 0.6 } },
      { role: 'cta', duration: 3.5, textPosition: 'center', textStyle: { mainSize: 56, subSize: 32, mainColor: '#ffffff', priceColor: '#ff6b6b', emphasis: 'scale_in' }, overlay: { type: 'gradient_bottom', opacity: 0.5 } },
    ],
  },
  name_seal: {
    slidePattern: 'seasonal_urgency',
    slides: [
      { role: 'hook', duration: 3, textPosition: 'upper_third', textStyle: { mainSize: 54, subSize: 32, mainColor: '#ffffff', emphasis: 'scale_in' }, overlay: { type: 'none' } },
      { role: 'pain', duration: 2.5, textPosition: 'center', textStyle: { mainSize: 46, subSize: 28, mainColor: '#ffffff', emphasis: 'fade_in' }, overlay: { type: 'gradient_bottom', opacity: 0.45 } },
      { role: 'solution', duration: 3, textPosition: 'center', textStyle: { mainSize: 50, subSize: 28, mainColor: '#ffffff', emphasis: 'pop' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'social_proof', duration: 2.5, textPosition: 'lower_third', textStyle: { mainSize: 34, subSize: 24, mainColor: '#ffd700', emphasis: 'fade_in' }, overlay: { type: 'band', opacity: 0.6 } },
      { role: 'cta', duration: 4, textPosition: 'center', textStyle: { mainSize: 54, subSize: 34, mainColor: '#ffffff', priceColor: '#ff6b6b', emphasis: 'scale_in' }, overlay: { type: 'gradient_bottom', opacity: 0.5 } },
    ],
  },
  pen: {
    slidePattern: 'premium_gift',
    slides: [
      { role: 'hook', duration: 3, textPosition: 'lower_third', textStyle: { mainSize: 48, subSize: 30, mainColor: '#ffffff', emphasis: 'fade_in' }, overlay: { type: 'gradient_bottom', opacity: 0.3 } },
      { role: 'feature', duration: 3, textPosition: 'center', textStyle: { mainSize: 44, subSize: 26, mainColor: '#ffffff', emphasis: 'fade_in' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'scene', duration: 3, textPosition: 'lower_third', textStyle: { mainSize: 40, subSize: 26, mainColor: '#ffffff', emphasis: 'fade_in' }, overlay: { type: 'gradient_bottom', opacity: 0.35 } },
      { role: 'cta', duration: 3.5, textPosition: 'center', textStyle: { mainSize: 52, subSize: 30, mainColor: '#ffffff', priceColor: '#ff6b6b', emphasis: 'scale_in' }, overlay: { type: 'gradient_bottom', opacity: 0.5 } },
    ],
  },
  case_accessory: {
    slidePattern: 'visual_first',
    slides: [
      { role: 'hook', duration: 3, textPosition: 'lower_third', textStyle: { mainSize: 46, subSize: 28, mainColor: '#ffffff', emphasis: 'fade_in' }, overlay: { type: 'gradient_bottom', opacity: 0.25 } },
      { role: 'variation', duration: 3, textPosition: 'upper_third', textStyle: { mainSize: 42, subSize: 26, mainColor: '#ffffff', emphasis: 'fade_in' }, overlay: { type: 'none' } },
      { role: 'feature', duration: 3, textPosition: 'center', textStyle: { mainSize: 44, subSize: 28, mainColor: '#ffffff', emphasis: 'pop' }, overlay: { type: 'gradient_bottom', opacity: 0.4 } },
      { role: 'cta', duration: 3.5, textPosition: 'center', textStyle: { mainSize: 52, subSize: 30, mainColor: '#ffffff', priceColor: '#ff6b6b', emphasis: 'scale_in' }, overlay: { type: 'gradient_bottom', opacity: 0.5 } },
    ],
  },
};

// ===== メイン =====

async function main() {
  const args = parseArgs();

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

  const images = args.images.length > 0
    ? args.images
    : await generateDummyImages(args);

  const category = args.category || 'stamp';
  const template = CATEGORY_TEMPLATES[category];
  if (!template) {
    console.error(`不明なカテゴリ: ${category}`);
    console.log('使用可能: stamp, name_seal, pen, case_accessory');
    process.exit(1);
  }

  console.log(`📸 写真: ${images.length}枚`);
  console.log(`📝 商品名: ${args.name}`);
  console.log(`📂 カテゴリ: ${category} (${template.slidePattern})`);
  console.log(`💰 価格: ¥${args.price ? Number(args.price).toLocaleString() : '---'}`);

  // Step 1: スライド構成を決定
  const slideConfigs = buildSlideConfigs(args, images);
  const totalDuration = slideConfigs.reduce((sum, c) => sum + c.slideConfig.duration, 0);
  console.log(`🎞️ スライド: ${slideConfigs.length}枚 (${totalDuration}秒)`);

  // Step 2: 各スライドのフレームを生成
  const framePaths = [];
  let frameOffset = 0;

  for (let i = 0; i < slideConfigs.length; i++) {
    const config = slideConfigs[i];
    console.log(`🎨 スライド${i + 1}/${slideConfigs.length} [${config.slideConfig.role}] ${config.slideConfig.duration}秒`);

    const frames = await generateSlideFrames(config, i, frameOffset);
    framePaths.push(...frames);
    frameOffset += Math.round(VIDEO.fps * config.slideConfig.duration);
  }

  console.log(`📷 合計フレーム: ${framePaths.length}枚`);

  // Step 3: FFmpegで動画生成
  const outputPath = join(OUTPUT_DIR, `${args.productId || 'video'}_${Date.now()}.mp4`);
  const bgmPath = findBGM();

  console.log('🎬 動画を生成中...');
  buildVideo(framePaths, outputPath, bgmPath);

  cleanTemp();

  console.log(`\n✅ 動画生成完了！`);
  console.log(`   ${outputPath}`);
  console.log(`   サイズ: ${(readFileSync(outputPath).length / 1024 / 1024).toFixed(1)}MB`);

  return outputPath;
}

// ===== 引数パース =====

function parseArgs() {
  const argv = process.argv.slice(2);
  const result = {
    productId: '',
    category: 'stamp',
    name: 'サンプル商品',
    price: null,
    benefit: '',
    catchcopy: '',
    cta: '▼ 商品リンクはプロフィールから',
    images: [],
    pain: '',
    solution: '',
    solutionSub: '',
    feature: '',
    featureSub: '',
    hook: '',
    seasonalHook: '',
    variation: '',
    variationSub: '',
    colorCount: '',
    scene: '',
    sceneSub: '',
    proofText: '',
    proofSub: '',
    rating: '',
    reviewCount: '',
    shopName: '',
    painDetail: '',
    benefitSub: '',
  };

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key in result) {
      if (key === 'images') {
        while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          result.images.push(argv[++i]);
        }
      } else {
        result[key] = argv[++i];
      }
    }
  }

  return result;
}

// ===== テロップ自動生成 =====

function generateSlideText(role, args, category) {
  const texts = {
    hook: () => {
      const hookPatterns = {
        stamp: { main: args.pain || '朱肉を出すのが面倒すぎる…', sub: '' },
        name_seal: { main: args.pain || '入園準備、名前書き地獄…', sub: args.seasonalHook || '全部に名前って正気？' },
        pen: { main: args.hook || '名前が入るだけで、特別になる', sub: '' },
        case_accessory: { main: args.hook || 'この色、見たことある？', sub: args.name },
      };
      return hookPatterns[category] || { main: args.name, sub: '' };
    },
    solution: () => ({
      main: args.solution || args.benefit || '解決策',
      sub: args.solutionSub || '',
    }),
    pain: () => ({
      main: args.pain || '1つ1つ手書き…大変すぎ',
      sub: args.painDetail || '',
    }),
    benefit: () => ({
      main: args.benefit || 'ベネフィット',
      sub: args.benefitSub || '',
    }),
    feature: () => ({
      main: args.feature || args.benefit || '特徴',
      sub: args.featureSub || '',
    }),
    variation: () => ({
      main: args.variation || `全${args.colorCount || '5'}色`,
      sub: args.variationSub || 'あなたの推し色は？',
    }),
    scene: () => ({
      main: args.scene || '仕事にも、贈り物にも',
      sub: args.sceneSub || '',
    }),
    social_proof: () => ({
      main: args.proofText || `★${args.rating || '4.5'} レビュー${args.reviewCount || '500'}件超`,
      sub: args.proofSub || args.shopName || '',
    }),
    cta: () => {
      const priceText = args.price ? `¥${Number(args.price).toLocaleString()}` : '';
      const taxNote = args.price ? '（税込・送料無料）' : '';
      return { main: priceText, sub: args.cta || '▼ 商品リンクはプロフィールから', extra: taxNote };
    },
  };

  const generator = texts[role];
  if (!generator) return { main: '', sub: '' };
  return generator();
}

// ===== スライド構成（カテゴリ対応） =====

function buildSlideConfigs(args, images) {
  const category = args.category || 'stamp';
  const template = CATEGORY_TEMPLATES[category];
  const configs = [];

  // 15秒に収まるようにスライドを選択
  let accumulated = 0;
  const activeSlides = [];
  for (const slide of template.slides) {
    if (accumulated + slide.duration > 16) break;
    activeSlides.push(slide);
    accumulated += slide.duration;
  }

  for (let i = 0; i < activeSlides.length; i++) {
    const slide = activeSlides[i];
    const imageIndex = Math.min(i, images.length - 1);
    const text = generateSlideText(slide.role, args, category);

    configs.push({
      imagePath: images[imageIndex] || images[0],
      slideConfig: slide,
      title: text.main,
      subtitle: text.sub,
      extra: text.extra || '',
      slideIndex: i,
    });
  }

  return configs;
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

    if (frame < VIDEO.transitionFrames) {
      opacity = frame / VIDEO.transitionFrames;
    } else if (frame >= framesPerSlide - VIDEO.transitionFrames) {
      opacity = (framesPerSlide - frame) / VIDEO.transitionFrames;
    }

    if (opacity >= 0.99) {
      paths.push(basePath);
    } else {
      const framePath = join(TEMP_DIR, `frame_${String(frameOffset + frame).padStart(5, '0')}.png`);
      await sharp({
        create: { width: VIDEO.width, height: VIDEO.height, channels: 4, background: hexToRGBA(VIDEO.bgColor, 1) },
      })
        .composite([{
          input: await sharp(baseImage).ensureAlpha(opacity).toBuffer(),
          top: 0, left: 0,
        }])
        .png()
        .toFile(framePath);
      paths.push(framePath);
    }
  }

  return paths;
}

// ===== スライド画像合成 =====

async function createSlideImage(config) {
  const { imagePath, slideConfig, title, subtitle, extra } = config;
  const { textPosition, textStyle, overlay: overlayConfig } = slideConfig;

  // 1. 背景画像
  let baseBuffer;
  if (existsSync(imagePath)) {
    baseBuffer = await sharp(imagePath)
      .resize(VIDEO.width, VIDEO.height, { fit: 'cover', position: 'centre' })
      .toBuffer();
  } else {
    baseBuffer = await sharp({
      create: { width: VIDEO.width, height: VIDEO.height, channels: 4, background: hexToRGBA('#2d2d44', 1) },
    }).png().toBuffer();
  }

  // 2. テキストSVG生成
  const textSvg = buildTextSVG(title, subtitle, extra, textStyle);
  const textBuffer = Buffer.from(textSvg);

  // テキストブロック高さを推定
  const titleLines = wrapText(title, Math.floor((VIDEO.width - 120) / textStyle.mainSize));
  const subLines = wrapText(subtitle, Math.floor((VIDEO.width - 120) / textStyle.subSize));
  const textBlockHeight = Math.ceil(
    (titleLines.length * textStyle.mainSize * 1.4)
    + (subLines.length > 0 ? textStyle.mainSize * 0.6 + subLines.length * textStyle.subSize * 1.4 : 0)
    + (extra ? 24 * 2 : 0)
  );

  // 3. テキスト配置位置
  const textY = getTextY(textPosition, VIDEO.height, textBlockHeight);

  // 4. 合成レイヤー
  const composites = [];
  const overlayResult = await createOverlay(overlayConfig, VIDEO.width, VIDEO.height, textY, textBlockHeight);
  if (overlayResult) {
    composites.push({ input: overlayResult.buffer, top: overlayResult.top, left: 0 });
  }
  composites.push({ input: textBuffer, top: textY, left: 0 });

  return sharp(baseBuffer).composite(composites).png().toBuffer();
}

// ===== テキスト配置 =====

function getTextY(textPosition, videoHeight, textBlockHeight) {
  switch (textPosition) {
    case 'upper_third':
      return Math.floor(videoHeight * 0.16);
    case 'center':
      return Math.floor((videoHeight - textBlockHeight) / 2);
    case 'lower_third':
      return Math.floor(videoHeight * 0.86 - textBlockHeight);
    default:
      return Math.floor(videoHeight * 0.55);
  }
}

// ===== オーバーレイ =====

async function createOverlay(overlayConfig, width, height, textY, textBlockHeight) {
  switch (overlayConfig.type) {
    case 'none':
      return null;

    case 'gradient_bottom': {
      const gradH = Math.floor(height * 0.5);
      return {
        buffer: await sharp({
          create: { width, height: gradH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: overlayConfig.opacity } },
        }).png().toBuffer(),
        top: height - gradH,
      };
    }

    case 'band': {
      const padding = 40;
      const bandH = Math.ceil(Math.max(textBlockHeight + padding * 2, 100));
      const bandTop = Math.max(Math.floor(textY - padding), 0);
      return {
        buffer: await sharp({
          create: { width, height: bandH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: overlayConfig.opacity } },
        }).png().toBuffer(),
        top: bandTop,
      };
    }

    default:
      return null;
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

  // ドロップシャドウ
  const shadowFilter = `<defs><filter id="shadow" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.7"/></filter></defs>`;

  // タイトル
  for (const line of titleLines) {
    y += textStyle.mainSize * 1.4;
    const color = (textStyle.priceColor && line.startsWith('¥')) ? textStyle.priceColor : textStyle.mainColor;
    elements += `<text x="${width / 2}" y="${y}" font-family="${FONT_FAMILY}" font-size="${textStyle.mainSize}" font-weight="bold" fill="${color}" text-anchor="middle" filter="url(#shadow)">${escapeXml(line)}</text>\n`;
  }

  // サブタイトル
  if (subtitle) {
    y += textStyle.mainSize * 0.6;
    for (const line of subtitleLines) {
      y += textStyle.subSize * 1.4;
      elements += `<text x="${width / 2}" y="${y}" font-family="${FONT_FAMILY}" font-size="${textStyle.subSize}" fill="${textStyle.mainColor}" text-anchor="middle" filter="url(#shadow)">${escapeXml(line)}</text>\n`;
    }
  }

  // extra（税込表記など）
  if (extra) {
    y += textStyle.subSize * 0.6;
    y += 24 * 1.4;
    elements += `<text x="${width / 2}" y="${y}" font-family="${FONT_FAMILY}" font-size="24" fill="rgba(255,255,255,0.7)" text-anchor="middle" filter="url(#shadow)">${escapeXml(extra)}</text>\n`;
  }

  const svgHeight = Math.ceil(y + 40);
  return `<svg width="${width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">${shadowFilter}${elements}</svg>`;
}

function wrapText(text, charsPerLine) {
  if (!text) return [];
  if (charsPerLine <= 0) charsPerLine = 15;
  const lines = [];
  for (let i = 0; i < text.length; i += charsPerLine) {
    lines.push(text.slice(i, i + charsPerLine));
  }
  return lines;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== FFmpegで動画生成 =====

function buildVideo(framePaths, outputPath, bgmPath) {
  const listPath = join(TEMP_DIR, 'frames.txt');
  const concatContent = framePaths.map(p => `file '${p}'\nduration ${1 / VIDEO.fps}`).join('\n');
  writeFileSync(listPath, concatContent);

  let cmd = `${FFMPEG} -y -f concat -safe 0 -i "${listPath}"`;
  cmd += ` -vf "fps=${VIDEO.fps},format=yuv420p"`;
  cmd += ` -c:v libx264 -preset medium -crf 23 -movflags +faststart`;

  if (bgmPath) {
    cmd += ` -i "${bgmPath}" -c:a aac -b:a 128k -shortest`;
  }

  cmd += ` "${outputPath}"`;

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 180000 });
  } catch (e) {
    console.error('FFmpegエラー:', e.stderr?.toString() || e.message);
    throw e;
  }
}

// ===== BGM検索 =====

function findBGM() {
  const bgmDir = join(__dirname, 'assets', 'bgm');
  if (!existsSync(bgmDir)) return null;
  const files = readdirSync(bgmDir).filter(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav'));
  return files.length > 0 ? join(bgmDir, files[0]) : null;
}

// ===== ダミー画像生成（テスト用） =====

async function generateDummyImages(args) {
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12'];
  const labels = [args.name, args.benefit || 'ベネフィット', 'CTA', '証明', '特徴'];
  const paths = [];

  for (let i = 0; i < 5; i++) {
    const path = join(TEMP_DIR, `dummy_${i}.png`);
    const svg = `<svg width="${VIDEO.width}" height="${VIDEO.height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${colors[i]}"/>
      <text x="50%" y="50%" font-family="sans-serif" font-size="64" fill="white" text-anchor="middle" dominant-baseline="central">${escapeXml(labels[i])}</text>
    </svg>`;
    await sharp(Buffer.from(svg)).resize(VIDEO.width, VIDEO.height).png().toFile(path);
    paths.push(path);
  }

  console.log('📎 テスト用ダミー画像を生成しました');
  return paths;
}

// ===== ユーティリティ =====

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b, alpha };
}

function cleanTemp() {
  if (!existsSync(TEMP_DIR)) return;
  for (const f of readdirSync(TEMP_DIR)) {
    unlinkSync(join(TEMP_DIR, f));
  }
}

// ===== 実行 =====
main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
