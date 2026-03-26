const { generateDailyReport } = require('../report/daily');
const { generateWeeklyReport } = require('../report/weekly');
const { generateMonthlyReport } = require('../report/monthly');
const { parseDateRange, parseMonth, getLastMonday, getLastFriday, getLastMonth } = require('../utils/date');

async function routeCommand(text) {
  if (!text || text.trim() === '') {
    return { type: 'ignore', message: 'メッセージが空です。' };
  }

  const trimmed = text.trim();

  // 月報コマンド
  if (/月報/.test(trimmed)) {
    const parsed = parseMonth(trimmed);
    const target = parsed || getLastMonth();
    return generateMonthlyReport(target.year, target.month);
  }

  // 週報コマンド
  if (/週報/.test(trimmed)) {
    const dateRange = parseDateRange(trimmed);
    if (dateRange) {
      return generateWeeklyReport(dateRange.startDate, dateRange.endDate);
    }
    // 日付省略時は直近の月〜金
    return generateWeeklyReport(getLastMonday(), getLastFriday());
  }

  // 日報コマンド or 通常メモ → 日報生成
  // 「日報」を含むメッセージ、または何もキーワードがないメモは日報として処理
  const memo = trimmed.replace(/^日報\s*/, '');
  return generateDailyReport(memo);
}

module.exports = { routeCommand };
