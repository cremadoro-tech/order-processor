const Anthropic = require('@anthropic-ai/sdk');
const config = require('../utils/config');
const { formatYen } = require('../utils/date');
const { buildMonthlyPrompt } = require('./prompts/monthly-prompt');
const { getMonthlySales } = require('../google/sheets');
const { getMonthlyReports, createReportDoc, getDocUrl } = require('../google/docs');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

async function generateMonthlyReport(year, month) {
  // 日報テキスト取得
  let dailyReports = '';
  try {
    dailyReports = await getMonthlyReports(year, month);
  } catch (error) {
    console.error('日報取得エラー:', error.message);
  }

  // 売上データ取得
  let salesData = null;
  let salesText = '（売上データなし）';
  try {
    salesData = await getMonthlySales(year, month);
    if (salesData && salesData.length > 0) {
      salesText = formatMonthlySalesData(salesData);
    }
  } catch (error) {
    console.error('月間売上データ取得エラー:', error.message);
  }

  // Claude APIで月報生成
  const prompt = buildMonthlyPrompt(dailyReports, '', salesText, year, month);
  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: 4000,
    temperature: config.anthropic.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const reportText = response.content[0].text;

  // Google Docに保存
  let docUrl = null;
  try {
    const monthStr = String(month).padStart(2, '0');
    const title = `月報_${year}-${monthStr}月`;
    const docId = await createReportDoc(title, reportText, year, month);
    docUrl = getDocUrl(docId);
  } catch (error) {
    console.error('Google Doc保存エラー:', error.message);
  }

  const message = docUrl
    ? `月報を作成しました！\n${docUrl}\n\n${reportText}`
    : `月報を作成しました（Doc保存エラー）:\n\n${reportText}`;

  return { type: 'monthly', message };
}

function formatMonthlySalesData(salesData) {
  const lines = [];
  let monthTotal = 0;
  const platformTotals = {};

  for (const day of salesData) {
    monthTotal += day.total;
    for (const [key, val] of Object.entries(day.platforms)) {
      platformTotals[key] = (platformTotals[key] || 0) + val.sales;
    }
  }

  lines.push(`月合計: ${formatYen(monthTotal)}`);
  lines.push('プラットフォーム別:');

  const platformNames = {
    rakuten: '楽天',
    yahoo: 'Yahoo',
    amazon: 'Amazon',
    shopify: 'Shopify',
    giftmall: 'ギフトモール',
    aupay: 'AuPay',
    qoo10: 'Qoo10',
  };

  for (const [key, name] of Object.entries(platformNames)) {
    if (platformTotals[key]) {
      const ratio = ((platformTotals[key] / monthTotal) * 100).toFixed(1);
      lines.push(`  ${name}: ${formatYen(platformTotals[key])}（構成比 ${ratio}%）`);
    }
  }

  return lines.join('\n');
}

module.exports = { generateMonthlyReport };
