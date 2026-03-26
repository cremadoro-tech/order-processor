/**
 * sync.mjs — 楽天RMS受注データ → BigQuery 同期スクリプト
 *
 * 使用方法:
 *   node scripts/rakuten-api/sync.mjs                          # 前日分
 *   node scripts/rakuten-api/sync.mjs --start 2024-04-01       # 指定開始日〜昨日
 *   node scripts/rakuten-api/sync.mjs --start 2024-04-01 --end 2026-03-13
 *   node scripts/rakuten-api/sync.mjs --dry-run                # 書き込みなしテスト
 *
 * ※ 1日ずつクエリして大量データのページネーション問題を回避する
 */

import { fetchAllOrders }        from './rms-client.mjs';
import { writeOrdersToBigQuery } from './bigquery-writer.mjs';

// --- 引数パース ---
const args    = process.argv.slice(2);
const getArg  = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const DRY_RUN = args.includes('--dry-run');
const SKIP_DEDUP = args.includes('--skip-dedup');

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const ymd = (d) => d.toISOString().slice(0, 10);

const startDate = getArg('--start') || ymd(yesterday);
const endDate   = getArg('--end')   || ymd(yesterday);

/** YYYY-MM-DD の配列を生成 */
function dateRange(start, end) {
  const dates = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// --- メイン ---
async function main() {
  const dates = dateRange(startDate, endDate);

  console.log('='.repeat(60));
  console.log('楽天 RMS → BigQuery 同期');
  console.log(`期間: ${startDate} 〜 ${endDate}（${dates.length}日分）`);
  if (DRY_RUN) console.log('⚠️  DRY-RUN モード');
  console.log('='.repeat(60));

  const startTime = Date.now();
  let totalOrders = 0;
  let totalItems  = 0;
  const dailySummary = [];

  for (const date of dates) {
    process.stdout.write(`\n[${date}] 取得中... `);

    try {
      const { orders, items } = await fetchAllOrders(date, date);

      if (orders.length === 0) {
        process.stdout.write('0件（スキップ）\n');
        continue;
      }

      const { ordersWritten, itemsWritten } = await writeOrdersToBigQuery(orders, items, {
        dryRun:    DRY_RUN,
        skipDedup: SKIP_DEDUP,
        startDate: date,
        endDate:   date,
      });

      const validOrders = orders.filter(o => (o.order_progress ?? 0) < 700);
      const dayRevenue  = validOrders.reduce((s, o) => s + (o.total_price || 0), 0);

      process.stdout.write(`受注${ordersWritten}件 / 明細${itemsWritten}行 / ¥${dayRevenue.toLocaleString()}\n`);

      totalOrders += ordersWritten;
      totalItems  += itemsWritten;
      dailySummary.push({ date, orders: ordersWritten, revenue: dayRevenue });

    } catch (err) {
      process.stdout.write(`❌ エラー: ${err.message}\n`);
      // 1日のエラーで全体を止めない
    }

    // レート制限対策（連続クエリを少し間引く）
    if (dates.length > 1) await new Promise(r => setTimeout(r, 200));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalRevenue = dailySummary.reduce((s, d) => s + d.revenue, 0);

  console.log('\n' + '='.repeat(60));
  console.log('同期完了');
  console.log(`  受注ヘッダー合計: ${totalOrders}件`);
  console.log(`  受注明細合計:     ${totalItems}行`);
  console.log(`  売上合計:         ¥${totalRevenue.toLocaleString()}`);
  console.log(`  処理時間:         ${elapsed}秒`);
  console.log('='.repeat(60));

  // 売上TOP5商品（全期間）
  if (!DRY_RUN && dailySummary.length > 0) {
    console.log('\n期間サマリー（日別）:');
    dailySummary.slice(-7).forEach(d =>
      console.log(`  ${d.date}: ${d.orders}件 ¥${d.revenue.toLocaleString()}`)
    );
  }
}

main().catch(err => {
  console.error('\n❌ 致命的エラー:', err.message);
  process.exit(1);
});
