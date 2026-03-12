/**
 * rakuten-genre.js - 楽天市場 ジャンルID 自動取得ユーティリティ
 *
 * 認証: .env の RAKUTEN_SERVICE_SECRET + RAKUTEN_LICENSE_KEY（RMS ESA認証）を使用。
 *       別途 RAKUTEN_APP_ID の取得は不要。
 *
 * 取得方法（優先順位順）:
 *   ① RMS Items Search API v2 - 自店舗の既存商品をタイトル検索してジャンルIDを取得
 *      エンドポイント: GET /es/2.0/items/search/?title=<keyword>&hits=20
 *   ② Ichiba Item Search API - 楽天市場全体の類似商品からジャンルIDを多数決で決定
 *      （RAKUTEN_APP_ID が設定されている場合のみ）
 *   ③ キーワードマッピング - 自社取扱商品カテゴリに特化したフォールバック
 *
 * 使用方法:
 *   node ec/utils/rakuten-genre.js "スタンプ台 インク"
 *   node ec/utils/rakuten-genre.js "ボールペン 黒" --verbose
 *   npm run rakuten:genre "印鑑"
 */

import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

const SERVICE_SECRET = process.env.RAKUTEN_SERVICE_SECRET;
const LICENSE_KEY    = process.env.RAKUTEN_LICENSE_KEY;
const APP_ID         = process.env.RAKUTEN_APP_ID; // 任意: 設定済みなら市場全体検索にも使用

const RMS_ITEM_SEARCH = 'https://api.rms.rakuten.co.jp/es/2.0/items/search/';
const ICHIBA_ITEM     = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706';
const ICHIBA_GENRE    = 'https://app.rakuten.co.jp/services/api/IchibaGenre/Search/20140222';

/**
 * ESA認証ヘッダーを生成する
 * Authorization: ESA <Base64(serviceSecret:licenseKey)>
 */
function buildEsaHeader() {
  if (!SERVICE_SECRET || !LICENSE_KEY) return null;
  const token = Buffer.from(`${SERVICE_SECRET}:${LICENSE_KEY}`).toString('base64');
  return { Authorization: `ESA ${token}` };
}

/**
 * キーワードからジャンルIDを取得する（メイン関数）
 *
 * @param {string} keyword - 商品名・カテゴリキーワード
 * @param {object} options
 * @param {boolean} options.verbose - 詳細ログを出力
 * @returns {Promise<{ genreId: string|null, genreName: string|null, confidence: string }>}
 */
export async function fetchGenreId(keyword, { verbose = false } = {}) {
  const esaHeader = buildEsaHeader();

  // ① RMS Item Search API（自店舗の既存商品から探す）
  if (esaHeader) {
    try {
      const rmsResult = await searchRmsItems(keyword, esaHeader, verbose);
      if (rmsResult.genreId) return rmsResult;
    } catch (err) {
      if (verbose) console.warn('[rakuten-genre] RMS Item Search 失敗:', err.message);
    }
  } else {
    if (verbose) console.warn('[rakuten-genre] RAKUTEN_SERVICE_SECRET / LICENSE_KEY 未設定');
  }

  // ② Ichiba Item Search API（楽天市場全体から探す）
  if (APP_ID) {
    try {
      const ichibaResult = await searchIchibaItems(keyword, verbose);
      if (ichibaResult.genreId) return ichibaResult;
    } catch (err) {
      if (verbose) console.warn('[rakuten-genre] Ichiba Item Search 失敗:', err.message);
    }
  }

  // ③ フォールバック: キーワードベースのカテゴリマッピング
  return fallbackCategoryMap(keyword, verbose);
}

/**
 * ① RMS Item Search API で自店舗の商品を検索し、ジャンルIDを取得する
 * 自店の既存商品と同カテゴリの場合に高精度で取得できる
 */
async function searchRmsItems(keyword, esaHeader, verbose) {
  // v2 API: title パラメータでタイトル絞り込み検索
  const params = new URLSearchParams({
    title: keyword,
    hits: '20',
  });

  const url = `${RMS_ITEM_SEARCH}?${params}`;
  if (verbose) console.log('[rakuten-genre] RMS Items Search URL:', url);

  const res = await fetch(url, { headers: esaHeader });

  // 401/403は認証失敗またはエンドポイント非対応
  if (res.status === 401 || res.status === 403) {
    throw new Error(`認証失敗 HTTP ${res.status} - ESA認証が拒否されました`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (verbose) console.log('[rakuten-genre] RMS numFound:', data.numFound);

  // v2 APIのレスポンス形式: results[].item.genreId
  const results = data.results || [];

  if (results.length === 0) {
    if (verbose) console.log('[rakuten-genre] RMS 検索結果: 0件');
    return { genreId: null, genreName: null, confidence: 'no_results' };
  }

  // ジャンルIDの出現回数を集計（最多を採用）
  const genreCount = {};
  for (const entry of results) {
    const id = String(entry.item?.genreId || '');
    if (id && id !== 'undefined' && id !== 'null') {
      genreCount[id] = (genreCount[id] || 0) + 1;
    }
  }

  if (Object.keys(genreCount).length === 0) {
    return { genreId: null, genreName: null, confidence: 'no_genre_in_results' };
  }

  const [topGenreId] = Object.entries(genreCount).sort(([, a], [, b]) => b - a)[0];
  if (verbose) {
    console.log('[rakuten-genre] RMS ジャンルID 集計:', genreCount);
    console.log('[rakuten-genre] 採用:', topGenreId);
  }

  return { genreId: topGenreId, genreName: null, confidence: 'rms_item_search' };
}

/**
 * ② Ichiba Item Search API で楽天市場全体を検索し、ジャンルIDを多数決で取得する
 */
async function searchIchibaItems(keyword, verbose) {
  const params = new URLSearchParams({
    applicationId: APP_ID,
    keyword,
    hits: '30',
    sort: '+reviewCount',
    availability: '1',
  });

  const url = `${ICHIBA_ITEM}?${params}`;
  if (verbose) console.log('[rakuten-genre] Ichiba Item Search URL:', url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!data.Items || data.Items.length === 0) {
    if (verbose) console.log('[rakuten-genre] Ichiba 検索結果: 0件');
    return { genreId: null, genreName: null, confidence: 'no_results' };
  }

  const genreCount = {};
  for (const { Item: item } of data.Items) {
    const id = String(item.genreId);
    genreCount[id] = (genreCount[id] || 0) + 1;
  }

  const [topGenreId] = Object.entries(genreCount).sort(([, a], [, b]) => b - a)[0];
  if (verbose) {
    console.log('[rakuten-genre] Ichiba ジャンルID 集計:', genreCount);
    console.log('[rakuten-genre] 採用:', topGenreId);
  }

  // ジャンル名をIchiba Genre APIで取得
  const genreName = await fetchIchibaGenreName(topGenreId, verbose);

  return { genreId: topGenreId, genreName, confidence: 'ichiba_item_search' };
}

/**
 * Ichiba Genre API でジャンル名を取得する
 */
async function fetchIchibaGenreName(genreId, verbose) {
  if (!APP_ID) return null;
  try {
    const params = new URLSearchParams({ applicationId: APP_ID, genreId });
    const res = await fetch(`${ICHIBA_GENRE}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.current?.genreName || null;
  } catch {
    return null;
  }
}

/**
 * ③ フォールバック: キーワードベースのカテゴリマッピング
 * 自社取扱商品（印鑑・筆記具・文具）に特化
 */
function fallbackCategoryMap(keyword, verbose) {
  const kw = keyword.toLowerCase();

  // ジャンルIDはRMS APIの実測値（2026/03時点）。
  // RMS APIで一致商品が見つからない新カテゴリのみここを使用。
  const categoryMap = [
    // スタンプ・ゴム印カテゴリ（RMS実測: 111177）
    { patterns: ['スタンプ台', 'インクパッド', 'stamp pad'],          genreId: '111177', genreName: 'スタンプ台・インク' },
    { patterns: ['ゴム印', 'シャチハタ', 'スタンプ', 'stamp'],         genreId: '111177', genreName: 'スタンプ・ゴム印' },
    // 印鑑カテゴリ（RMS実測: 401760）
    { patterns: ['認印', '銀行印', '実印', '印鑑', 'はんこ', 'ハンコ'],  genreId: '401760', genreName: '印鑑・はんこ' },
    { patterns: ['印鑑ケース', '印鑑入れ', '朱肉'],                    genreId: '401760', genreName: '印鑑ケース・朱肉' },
    // 筆記具カテゴリ（RMS実測値）
    { patterns: ['ボールペン', 'ballpen'],                            genreId: '216081', genreName: 'ボールペン' },
    { patterns: ['万年筆', 'fountain pen'],                          genreId: '210246', genreName: '万年筆' },
    { patterns: ['シャープ', 'シャーペン', 'mechanical pencil'],       genreId: '205824', genreName: 'シャープペンシル' },
    { patterns: ['鉛筆', 'pencil'],                                  genreId: '216081', genreName: '鉛筆' },
    { patterns: ['マーカー', '蛍光ペン', 'marker'],                   genreId: '216081', genreName: 'マーカー・蛍光ペン' },
    // 文具カテゴリ
    { patterns: ['ノート', 'notebook'],                              genreId: '111177', genreName: 'ノート・メモ帳' },
    { patterns: ['付箋', 'ふせん', 'sticky note'],                   genreId: '111177', genreName: '付箋・メモ' },
    { patterns: ['テープ', 'tape'],                                  genreId: '111177', genreName: 'テープ・のり' },
    { patterns: ['ファイル', 'binder'],                              genreId: '111177', genreName: 'ファイル・バインダー' },
  ];

  for (const cat of categoryMap) {
    if (cat.patterns.some(p => kw.includes(p))) {
      if (verbose) console.log(`[rakuten-genre] フォールバックマッチ: "${cat.genreName}" (${cat.genreId})`);
      return { genreId: cat.genreId, genreName: cat.genreName, confidence: 'fallback_map' };
    }
  }

  if (verbose) console.log('[rakuten-genre] マッチするカテゴリなし');
  return { genreId: null, genreName: null, confidence: 'not_found' };
}

// --- CLI 実行 ---
if (process.argv[1].endsWith('rakuten-genre.js')) {
  const args = process.argv.slice(2);
  const keyword = args.filter(a => !a.startsWith('--')).join(' ');
  const verbose = args.includes('--verbose');

  if (!keyword) {
    console.error('使用方法: node ec/utils/rakuten-genre.js "キーワード" [--verbose]');
    process.exit(1);
  }

  fetchGenreId(keyword, { verbose })
    .then(result => {
      if (result.genreId) {
        console.log(JSON.stringify(result));
      } else {
        console.error(JSON.stringify({ error: 'ジャンルIDを取得できませんでした', keyword, ...result }));
        process.exit(1);
      }
    })
    .catch(err => {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    });
}
