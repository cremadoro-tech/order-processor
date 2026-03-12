/**
 * slack-daily-report.mjs
 * 各チャンネルのシートから前日データを読み込み、Slackに投稿する
 *
 * 使い方:
 *   node scripts/slack-daily-report.mjs
 *   node scripts/slack-daily-report.mjs 2026-03-01  # 日付指定
 */

import { getSheetsClient } from './ec/utils/sheets.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env');

const SPREADSHEET_ID = '1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw';

// 楽天・Yahoo・Amazon は各シートから直接取得
const INDIVIDUAL_CHANNELS = [
  { label: '楽天',   sheet: '楽天',   revenueKeys: ['売上金額', '売上'], ordersKeys: ['受注件数', '注文'] },
  { label: 'Yahoo',  sheet: 'Yahoo',  revenueKeys: ['売上合計値', '売上金額', '売上'], ordersKeys: ['注文者数合計', '受注件数', '注文'] },
  { label: 'Amazon', sheet: 'Amazon', revenueKeys: ['注文商品の売上額', '売上高', '売上'], ordersKeys: ['注文品目総数'], yoyCol: '昨対比', cumYoyCol: '累計昨対比' },
];

// Q10・Shopify・auPAY・ギフトモール は GMシートのサブ列から取得
// 昨対比・累計昨対比ともGMシートに計算済みの列がある
const GM_SUBCHANNELS = [
  {
    label: 'Q10',
    revenueCol:  'Qoo10店 売上',
    ordersCol:   'Qoo10店 受注件数',
    yoyCol:      'Qoo10 昨対比',
    cumYoyCol:   'Qoo10 累計昨対比',
  },
  {
    label: 'Shopify',
    revenueCol:  'Shopify 1号店 売上',
    ordersCol:   'Shopify 1号店 受注件数',
    yoyCol:      'Shopify 昨対比',
    cumYoyCol:   'Shopify 累計昨対比',
  },
  {
    label: 'auPAY',
    revenueCol:  'auPAYマーケット 売上',
    ordersCol:   'auPAYマーケット 受注件数',
    yoyCol:      'au PAY昨対比',
    cumYoyCol:   'au PAY累計昨対比',
  },
  {
    label: 'GM',
    revenueCol:  'ギフトモール 売上',
    ordersCol:   'ギフトモール 受注件数',
    yoyCol:      'ギフトモール 昨対比',
    cumYoyCol:   'ギフトモール 累計昨対比',
  },
];

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

function normDate(str) {
  if (!str) return '';
  const m = String(str).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return str;
  return `${m[1]}/${String(m[2]).padStart(2,'0')}/${String(m[3]).padStart(2,'0')}`;
}

async function readSheet(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:AO`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return { headers: [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1) };
}

function findCol(headers, keywords) {
  for (const kw of keywords) {
    const idx = headers.findIndex(h => String(h).includes(kw));
    if (idx >= 0) return idx;
  }
  return -1;
}

// 完全一致でカラムインデックスを探す
function findColExact(headers, colName) {
  return headers.findIndex(h => String(h).trim() === colName.trim());
}

function findRowByDate(rows, dateStr) {
  const norm = normDate(dateStr);
  return rows.find(r => normDate(r[0]) === norm) ?? null;
}

function toNum(val) {
  if (val == null || val === '' || val === '#N/A' || val === '-') return null;
  const n = parseFloat(String(val).replace(/[,，¥￥]/g, ''));
  return isNaN(n) ? null : n;
}

// 昨対比の値を昨対比率（%）として返す
// 値が1.06などの比率の場合は×100、106%などは%除去してそのまま
function toYoyPct(val) {
  if (val == null || val === '' || val === '#N/A' || val === '-') return null;
  const s = String(val).trim();
  const withPct = s.endsWith('%');
  const n = parseFloat(s.replace(/[%,，¥￥]/g, ''));
  if (isNaN(n)) return null;
  // 比率（1.06など）は%換算する
  if (!withPct && n < 10) return n * 100;
  return n;
}

// 前年同日から昨対比を計算（シートに昨対比列がない場合の補完用）
function calcYoy(rows, targetDate, revenueIdx) {
  const d = new Date(normDate(targetDate).replace(/\//g, '-'));
  if (isNaN(d)) return null;
  const ly = new Date(d);
  ly.setFullYear(ly.getFullYear() - 1);
  const lyStr = `${ly.getFullYear()}/${String(ly.getMonth()+1).padStart(2,'0')}/${String(ly.getDate()).padStart(2,'0')}`;
  const lyRow = findRowByDate(rows, lyStr);
  if (!lyRow || revenueIdx < 0) return null;
  const lyRevenue = toNum(lyRow[revenueIdx]);
  return lyRevenue && lyRevenue !== 0 ? lyRevenue : null;
}

// 月初〜対象日の累計売上を集計して累計昨対比を返す
// 戻り値: { thisMonth, lastYear } （どちらも合計金額）
function calcCumulative(rows, targetDate, revenueIdx) {
  if (revenueIdx < 0) return { thisMonth: 0, lastYear: 0 };
  const d = new Date(normDate(targetDate).replace(/\//g, '-'));
  if (isNaN(d)) return { thisMonth: 0, lastYear: 0 };
  const year  = d.getFullYear();
  const month = d.getMonth();
  const day   = d.getDate();

  let thisMonth = 0;
  let lastYear  = 0;

  for (const row of rows) {
    const nd = normDate(row[0]);
    const rd = new Date(nd.replace(/\//g, '-'));
    if (isNaN(rd)) continue;
    const val = toNum(row[revenueIdx]);
    if (val == null) continue;

    // 今年: 同じ月、対象日以前
    if (rd.getFullYear() === year && rd.getMonth() === month && rd.getDate() <= day) {
      thisMonth += val;
    }
    // 前年: 同じ月、同じ日以前
    if (rd.getFullYear() === year - 1 && rd.getMonth() === month && rd.getDate() <= day) {
      lastYear += val;
    }
  }
  return { thisMonth, lastYear };
}

// 金額フォーマット
function fmtRevenue(val) {
  if (val == null) return '-';
  return '¥' + Math.round(val).toLocaleString('ja-JP');
}

// 件数フォーマット
function fmtCount(val) {
  if (val == null) return '-';
  return Math.round(val).toLocaleString('ja-JP') + '件';
}

// 昨対比フォーマット（小数点1桁 + %）
function fmtYoy(current, lastYear) {
  if (current == null || lastYear == null || lastYear === 0) return '-';
  return ((current / lastYear) * 100).toFixed(1) + '%';
}

// 昨対比フォーマット（直接%値から）
function fmtYoyPct(pct) {
  if (pct == null) return '-';
  return pct.toFixed(1) + '%';
}

async function main() {
  const env = loadEnv();

  // 引数をパース
  const args = process.argv.slice(2);
  let targetDate;
  let noPost = false;

  for (const arg of args) {
    if (arg === '--no-post') {
      noPost = true;
    } else if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
      targetDate = arg.replace(/-/g, '/');
    }
  }

  // 対象日が指定されていなければ前日を使用
  if (!targetDate) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    targetDate = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  }

  const token = env.SLACK_BOT_TOKEN;
  const channelId = env.SLACK_CHANNEL_ID;

  if (!noPost) {
    if (!token) throw new Error('SLACK_BOT_TOKENが.envに設定されていません');
    if (!channelId) throw new Error(
      'SLACK_CHANNEL_IDが.envに設定されていません\n' +
      'Slackでチャンネルを右クリック→「チャンネルの詳細を表示」→ 最下部のIDをコピーし\n' +
      '.envに SLACK_CHANNEL_ID=C... を追加してください'
    );
  }

  console.log(`対象日: ${targetDate}`);
  console.log('Google Sheetsからデータを取得中...\n');

  const sheets = await getSheetsClient();
  const results = [];
  let totalRevenue = 0;
  let totalOrders = 0;
  let totalRevenueLastYear = 0;
  let totalCumThis = 0;
  let totalCumLast = 0;

  // ── 楽天・Yahoo・Amazon: 各シートから取得 ──
  for (const ch of INDIVIDUAL_CHANNELS) {
    try {
      const { headers, rows } = await readSheet(sheets, ch.sheet);
      const revIdx = findCol(headers, ch.revenueKeys);
      const ordIdx = findCol(headers, ch.ordersKeys);
      const row = findRowByDate(rows, targetDate);

      if (!row) {
        console.log(`  ${ch.label}: ${targetDate} のデータなし`);
        results.push({ label: ch.label, revenue: null, orders: null, yoyStr: '-', cumRevenue: null, cumYoyStr: '-' });
        continue;
      }

      const revenue   = toNum(row[revIdx]);
      const orders    = toNum(row[ordIdx]);

      // 昨対比（シート計算済み列があれば優先使用）
      const yoyIdx = ch.yoyCol ? findColExact(headers, ch.yoyCol) : -1;
      const yoyPct = yoyIdx >= 0 ? toYoyPct(row[yoyIdx]) : null;
      const lyRevenue = calcYoy(rows, targetDate, revIdx);
      const yoyStr = yoyPct != null ? fmtYoyPct(yoyPct) : fmtYoy(revenue, lyRevenue);

      // 累計（シート計算済み列があれば優先使用）
      const { thisMonth, lastYear: cumLast } = calcCumulative(rows, targetDate, revIdx);
      const cumYoyIdx = ch.cumYoyCol ? findColExact(headers, ch.cumYoyCol) : -1;
      const cumPct = cumYoyIdx >= 0 ? toYoyPct(row[cumYoyIdx]) : null;
      const cumYoyStr = cumPct != null ? fmtYoyPct(cumPct) : fmtYoy(thisMonth, cumLast);

      if (revenue != null)   totalRevenue         += revenue;
      if (orders  != null)   totalOrders          += orders;
      if (lyRevenue != null) totalRevenueLastYear += lyRevenue;
      totalCumThis += thisMonth;
      totalCumLast += cumLast;

      console.log(`  ${ch.label}: ${fmtRevenue(revenue)} / 累計 ${fmtRevenue(thisMonth)} / 昨対 ${yoyStr} / 累計昨対 ${cumYoyStr}`);
      results.push({ label: ch.label, revenue, orders, yoyStr, cumRevenue: thisMonth, cumYoyStr });

    } catch (err) {
      console.error(`  ${ch.label}: エラー - ${err.message}`);
      results.push({ label: ch.label, revenue: null, orders: null, yoyStr: '-', cumRevenue: null, cumYoyStr: '-' });
    }
  }

  // ── Q10・Shopify・auPAY・GM: GMシートのサブ列から取得 ──
  try {
    const { headers, rows } = await readSheet(sheets, 'GM');
    const row = findRowByDate(rows, targetDate);

    if (!row) {
      console.log(`  GM(サブ): ${targetDate} のデータなし`);
      for (const sub of GM_SUBCHANNELS) {
        results.push({ label: sub.label, revenue: null, orders: null, yoyStr: '-', cumRevenue: null, cumYoyStr: '-' });
      }
    } else {
      for (const sub of GM_SUBCHANNELS) {
        const revIdx    = findColExact(headers, sub.revenueCol);
        const ordIdx    = findColExact(headers, sub.ordersCol);
        const yoyIdx    = findColExact(headers, sub.yoyCol);
        const cumYoyIdx = findColExact(headers, sub.cumYoyCol);

        const revenue = toNum(row[revIdx]);
        const orders  = toNum(row[ordIdx]);

        // 累計売上は常に月集計から計算
        const { thisMonth, lastYear: cumLast } = calcCumulative(rows, targetDate, revIdx);
        totalCumThis += thisMonth;
        totalCumLast += cumLast;

        // 昨対比（シート計算済み優先、なければ前年同日計算）
        const yoyPct = yoyIdx >= 0 ? toYoyPct(row[yoyIdx]) : null;
        const yoyStr = yoyPct != null
          ? fmtYoyPct(yoyPct)
          : fmtYoy(revenue, calcYoy(rows, targetDate, revIdx));

        // 累計昨対比（シート計算済み優先、なければ月集計計算）
        const cumPct = cumYoyIdx >= 0 ? toYoyPct(row[cumYoyIdx]) : null;
        const cumYoyStr = cumPct != null ? fmtYoyPct(cumPct) : fmtYoy(thisMonth, cumLast);

        if (revenue != null) totalRevenue += revenue;
        if (orders  != null) totalOrders  += orders;

        console.log(`  ${sub.label}: ${fmtRevenue(revenue)} / 累計 ${fmtRevenue(thisMonth)} / 昨対 ${yoyStr} / 累計昨対 ${cumYoyStr}`);
        results.push({ label: sub.label, revenue, orders, yoyStr, cumRevenue: thisMonth, cumYoyStr });
      }
    }
  } catch (err) {
    console.error(`  GM(サブ): エラー - ${err.message}`);
    for (const sub of GM_SUBCHANNELS) {
      results.push({ label: sub.label, revenue: null, orders: null, yoyStr: '-', cumRevenue: null, cumYoyStr: '-' });
    }
  }

  // ── 全サイトデータ揃い確認 ──
  const missingSites = results.filter(r => r.revenue == null).map(r => r.label);
  if (missingSites.length > 0) {
    console.log(`⏳ まだデータが揃っていないサイトがあります: ${missingSites.join(', ')}`);
    console.log('全サイトのデータが揃うまでSlack通知はスキップします。');
    return;
  }

  // ── メッセージ組み立て ──
  const [y, mo, dd] = targetDate.split('/');
  const dispDate    = `${y}/${parseInt(mo)}/${parseInt(dd)}`;
  const totalYoy    = fmtYoy(totalRevenue, totalRevenueLastYear);
  const totalCumYoy = fmtYoy(totalCumThis, totalCumLast);

  const totalCumRevenue = totalCumThis;

  const lines = [
    `<!channel> 📊 *EC売上日報【${dispDate}】*`,
    '',
    `━━━━━━━━━━━━━━━━━━`,
    `🏆 *全チャネル合計*`,
    `売上: ${fmtRevenue(totalRevenue)}　件数: ${fmtCount(totalOrders)}　昨対: ${totalYoy}`,
    `累計売上: ${fmtRevenue(totalCumRevenue)}　累計昨対: ${totalCumYoy}`,
    '',
    `━━━━━━━━━━━━━━━━━━`,
    `📌 *各チャネル内訳*`,
    '',
    ...results.map(r => [
      `*${r.label}*　${fmtRevenue(r.revenue)}　件数: ${fmtCount(r.orders)}　昨対: ${r.yoyStr}`,
      `　　累計: ${fmtRevenue(r.cumRevenue)}　累計昨対: ${r.cumYoyStr}`,
    ].join('\n')),
  ];

  const message = lines.join('\n');
  console.log('\n--- 投稿内容プレビュー ---');
  console.log(message);
  console.log('-------------------------\n');

  if (noPost) {
    console.log('💬 [テストモード] Slack投稿をスキップしました');
    return;
  }

  // ── Slack投稿 ──
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel: channelId, text: message, mrkdwn: true }),
  });
  const result = await res.json();

  if (result.ok) {
    console.log('✅ Slackへの投稿が完了しました');
  } else {
    throw new Error(`Slack投稿エラー: ${result.error}`);
  }
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
