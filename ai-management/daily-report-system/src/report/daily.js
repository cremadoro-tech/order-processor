const Anthropic = require('@anthropic-ai/sdk');
const config = require('../utils/config');
const { today } = require('../utils/date');
const { buildDailyPrompt } = require('./prompts/daily-prompt');
const { getTodaySales } = require('../google/sheets');
const { findOrCreateMonthlyDoc, appendDailyReport, getDocUrl } = require('../google/docs');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

async function generateDailyReport(memo) {
  const dateStr = today();

  // 売上データ取得（エラー時はnull）
  let salesData = null;
  try {
    salesData = await getTodaySales(dateStr);
  } catch (error) {
    console.error('売上データ取得エラー:', error.message);
  }

  // 売上データを文字列に整形
  const salesText = formatSalesData(salesData);

  // Claude APIで日報テキスト生成
  const prompt = buildDailyPrompt(memo, salesText, dateStr);
  const response = await anthropic.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    temperature: config.anthropic.temperature,
    messages: [{ role: 'user', content: prompt }],
  });

  const reportText = response.content[0].text;

  // Google Docに保存
  let docUrl = null;
  try {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(5, 7), 10);
    const docId = await findOrCreateMonthlyDoc(year, month);
    await appendDailyReport(docId, reportText);
    docUrl = getDocUrl(docId);
  } catch (error) {
    console.error('Google Doc保存エラー:', error.message);
    console.error('詳細:', error.stack);
  }

  const message = docUrl
    ? `日報を作成しました！\n${docUrl}\n\n${reportText}`
    : `日報を作成しました（Doc保存エラー）:\n\n${reportText}`;

  return { type: 'daily', message };
}

function formatSalesData(data) {
  if (!data) return null;

  const { formatYen, formatChangeRate } = require('../utils/date');
  const lines = [];
  lines.push(`全店合計: ${formatYen(data.total)}（前日比 ${formatChangeRate(data.total, data.totalPrevDay)}）`);

  const platformNames = {
    rakuten: '楽天',
    yahoo: 'Yahoo',
    amazon: 'Amazon',
    shopify: 'Shopify',
    giftmall: 'ギフトモール',
    aupay: 'AuPay',
    qoo10: 'Qoo10',
  };

  const parts = [];
  for (const [key, name] of Object.entries(platformNames)) {
    if (data.platforms[key]) {
      parts.push(`${name}: ${formatYen(data.platforms[key].sales)}`);
    }
  }
  if (parts.length > 0) {
    lines.push(parts.join(' / '));
  }

  return lines.join('\n');
}

module.exports = { generateDailyReport };
