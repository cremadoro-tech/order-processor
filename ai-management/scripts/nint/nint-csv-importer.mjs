/**
 * nint-csv-importer.mjs — NintのCSVデータをBigQueryにインポートする
 *
 * 使い方:
 *   node scripts/nint/nint-csv-importer.mjs <CSVファイルパス> [オプション]
 *   node scripts/nint/nint-csv-importer.mjs <ディレクトリパス> [オプション]  ← 一括インポート
 *
 * オプション:
 *   --dry-run    書き込まずに内容を確認する
 *   --preview    CSVの先頭5行を表示して終了
 *
 * 自動検出:
 *   ファイル名パターンからデータタイプ・日付・メタ情報を自動推定する
 *   - "20260324_ショップ分析_レスタス.csv" → ショップ分析, date=2026-03-24, shop=レスタス
 *   - "202603242_業種分析_筆記具_多機能ペン.csv" → 業種分析, date=2026-03-24, category=筆記具, sub=多機能ペン
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, join, extname } from 'path';
import { config }       from 'dotenv';
import { dirname }      from 'path';
import { fileURLToPath } from 'url';
import { writeShopAnalysisToBigQuery, writeGenreRankingToBigQuery } from './nint-bigquery-writer.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });

/**
 * CSVをパースする（ダブルクォート対応）
 */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

/**
 * ファイルを読み込む（UTF-8 → Shift-JIS フォールバック）
 */
function readCSVFile(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    // BOM除去
    return content.replace(/^\uFEFF/, '');
  } catch {
    const buf = readFileSync(filepath);
    const decoder = new TextDecoder('shift-jis');
    return decoder.decode(buf);
  }
}

/**
 * ファイル名からメタ情報を抽出する
 *
 * パターン1: "20260324_ショップ分析_レスタス.csv"
 * パターン2: "202603242_業種分析_筆記具_多機能ペン.csv"
 */
function parseFilename(filepath) {
  const name = basename(filepath, extname(filepath));
  const parts = name.split('_');

  // 日付抽出（先頭の数字列から8桁を取得）
  const dateStr = parts[0]?.match(/^(\d{8})/)?.[1];
  const reportDate = dateStr
    ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    : new Date().toISOString().split('T')[0];

  // データタイプ検出
  const typeStr = parts[1] || '';

  if (typeStr.includes('ショップ分析')) {
    return {
      type: 'shop',
      reportDate,
      shopName: parts[2] || '不明',
    };
  }

  if (typeStr.includes('業種分析')) {
    return {
      type: 'genre',
      reportDate,
      category: parts[2] || '不明',
      subcategory: parts[3] || null,
    };
  }

  // ヘッダーで判断するために仮の値を返す
  return { type: 'unknown', reportDate };
}

/**
 * ヘッダーからデータタイプを推定する（ファイル名で判断できない場合のフォールバック）
 */
function detectTypeFromHeaders(headers) {
  if (headers.includes('商品Code') && headers.some(h => h.includes('最近7日'))) {
    return 'shop';
  }
  if (headers.includes('Rank') && headers.some(h => h.includes('シェア'))) {
    return 'genre';
  }
  return 'unknown';
}

/**
 * 1ファイルをインポートする
 */
async function importFile(filepath, { dryRun = false, preview = false }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📂 ${basename(filepath)}`);

  const content = readCSVFile(filepath);
  const { headers, rows } = parseCSV(content);

  console.log(`📋 ヘッダー: ${headers.slice(0, 5).join(', ')}...`);
  console.log(`📋 行数: ${rows.length}`);

  if (preview) {
    console.log('\n--- プレビュー（先頭3行） ---');
    rows.slice(0, 3).forEach((row, i) => {
      const summary = headers.slice(0, 4).map((h, j) => `${h}: ${row[j]}`).join(' | ');
      console.log(`  ${i + 1}: ${summary}`);
    });
    return { type: 'preview', count: rows.length };
  }

  // メタ情報解析
  const meta = parseFilename(filepath);
  const dataType = meta.type !== 'unknown' ? meta.type : detectTypeFromHeaders(headers);

  if (dataType === 'shop') {
    console.log(`📊 タイプ: ショップ分析`);
    console.log(`🏪 ショップ: ${meta.shopName || '不明'}`);
    console.log(`📅 レポート日: ${meta.reportDate}`);

    const result = await writeShopAnalysisToBigQuery({
      reportDate: meta.reportDate,
      shopName: meta.shopName || '不明',
      headers,
      rows,
      dryRun,
    });
    return { type: 'shop', ...result };
  }

  if (dataType === 'genre') {
    console.log(`📊 タイプ: 業種分析`);
    console.log(`📁 カテゴリ: ${meta.category || '不明'}`);
    console.log(`📁 サブカテゴリ: ${meta.subcategory || '-'}`);
    console.log(`📅 レポート日: ${meta.reportDate}`);

    const result = await writeGenreRankingToBigQuery({
      reportDate: meta.reportDate,
      category: meta.category || '不明',
      subcategory: meta.subcategory || null,
      headers,
      rows,
      dryRun,
    });
    return { type: 'genre', ...result };
  }

  console.warn('⚠️ データタイプを判別できませんでした。--preview でヘッダーを確認してください。');
  return { type: 'unknown', written: 0 };
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
使い方: node scripts/nint/nint-csv-importer.mjs <CSVファイルまたはディレクトリ> [オプション]

オプション:
  --dry-run    書き込まずに内容を確認する
  --preview    CSVの先頭行を表示して終了

ファイル名の命名規則:
  ショップ分析: YYYYMMDD_ショップ分析_ショップ名.csv
  業種分析:     YYYYMMDD_業種分析_カテゴリ_サブカテゴリ.csv

例:
  node scripts/nint/nint-csv-importer.mjs ./20260324_ショップ分析_レスタス.csv --dry-run
  node scripts/nint/nint-csv-importer.mjs ./nint-csv/ --dry-run   # ディレクトリ一括
    `);
    process.exit(0);
  }

  const targetPath = args.find(a => !a.startsWith('--'));
  const dryRun  = args.includes('--dry-run');
  const preview = args.includes('--preview');

  // ファイルかディレクトリか判定
  let files;
  try {
    const stat = statSync(targetPath);
    if (stat.isDirectory()) {
      files = readdirSync(targetPath)
        .filter(f => f.endsWith('.csv'))
        .map(f => join(targetPath, f));
      console.log(`📁 ディレクトリ: ${targetPath} (${files.length}件のCSV)`);
    } else {
      files = [targetPath];
    }
  } catch (err) {
    console.error(`❌ パスが見つかりません: ${targetPath}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('CSVファイルが見つかりません。');
    process.exit(0);
  }

  // 各ファイルをインポート
  const results = [];
  for (const file of files) {
    try {
      const result = await importFile(file, { dryRun, preview });
      results.push({ file: basename(file), ...result });
    } catch (err) {
      console.error(`❌ ${basename(file)}: ${err.message}`);
      results.push({ file: basename(file), type: 'error', error: err.message });
    }
  }

  // サマリー表示
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 インポート結果サマリー:');
  for (const r of results) {
    const status = r.type === 'error' ? `❌ ${r.error}` : `✅ ${r.written ?? r.count}件 ${dryRun ? '(dry-run)' : ''}`;
    console.log(`  ${r.file}: ${status}`);
  }
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
