const Anthropic = require('@anthropic-ai/sdk');
const config = require('../utils/config');
const { formatYen } = require('../utils/date');
const { buildWeeklyPrompt } = require('./prompts/weekly-prompt');
const { getWeeklySales } = require('../google/sheets');
const { getMonthlyReports, createReportDoc, getDocUrl } = require('../google/docs');
const { generateDailySalesChart } = require('../chart/sales-chart');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

async function generateWeeklyReport(startDate, endDate) {
  const startYear = parseInt(startDate.slice(0, 4), 10);
  const startMonth = parseInt(startDate.slice(5, 7), 10);

  // 日報テキスト取得
  let dailyReports = '';
  try {
    dailyReports = await getMonthlyReports(startYear, startMonth);
  } catch (error) {
    console.error('日報取得エラー:', error.message);
  }

  // 売上データ取得
  let salesData = null;
  let salesText = '（売上データなし）';
  try {
    salesData = await getWeeklySales(startDate, endDate);
    if (salesData && salesData.length > 0) {
      salesText = formatWeeklySalesData(salesData);
    }
  } catch (error) {
    console.error('週間売上データ取得エラー:', error.message);
  }

  // Claude APIで週報生成
  const prompt = buildWeeklyPrompt(dailyReports, salesText, startDate, endDate);
  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 3000,
    temperature: config.anthropic.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const reportText = response.content[0].text;

  // Google Docに保存
  let docUrl = null;
  try {
    const startMM = startDate.slice(5, 7);
    const startDD = startDate.slice(8, 10);
    const endMM = endDate.slice(5, 7);
    const endDD = endDate.slice(8, 10);
    const title = `週報_${startDate.slice(0, 4)}-${startMM}-${startDD}_${endMM}-${endDD}`;

    const docId = await createReportDoc(title, reportText, startYear, startMonth);
    docUrl = getDocUrl(docId);
  } catch (error) {
    console.error('Google Doc保存エラー:', error.message);
  }

  const message = docUrl
    ? `週報を作成しました！\n${docUrl}\n\n${reportText}`
    : `週報を作成しました（Doc保存エラー）:\n\n${reportText}`;

  return { type: 'weekly', message };
}

function formatWeeklySalesData(salesData) {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const lines = [];
  let weekTotal = 0;

  for (const day of salesData) {
    const d = new Date(day.date);
    const dayName = dayNames[d.getDay()];
    lines.push(`  ${dayName}（${day.date}）: ${formatYen(day.total)}`);
    weekTotal += day.total;
  }

  return `週合計: ${formatYen(weekTotal)}\n日別推移:\n${lines.join('\n')}`;
}

module.exports = { generateWeeklyReport };
