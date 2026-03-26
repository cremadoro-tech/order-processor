const { getSheets } = require('./auth');
const config = require('../utils/config');

let headerCache = null;

async function getHeaders() {
  if (headerCache) return headerCache;

  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.sheetsId,
    range: '楽天!1:1',
  });

  headerCache = res.data.values ? res.data.values[0] : [];
  return headerCache;
}

function findColumnIndex(headers, ...candidates) {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h && h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

async function getRowByDate(date) {
  const sheets = await getSheets();
  const headers = await getHeaders();

  const dateColIdx = findColumnIndex(headers, '日付', 'date', 'Date');
  if (dateColIdx === -1) {
    throw new Error('日付カラムが見つかりません');
  }

  // 全データ取得してフィルタ（小規模データ想定）
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.sheetsId,
    range: '楽天',
  });

  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    const rowDate = rows[i][dateColIdx];
    if (rowDate && normalizeDate(rowDate) === date) {
      return { headers, row: rows[i] };
    }
  }

  return null;
}

function normalizeDate(dateStr) {
  // "2026/03/08" → "2026-03-08"
  // "3/8" → "2026-03-08" (current year)
  if (!dateStr) return null;
  const cleaned = dateStr.replace(/\//g, '-');
  const parts = cleaned.split('-');
  if (parts.length === 3) {
    const y = parts[0].length === 4 ? parts[0] : `20${parts[0]}`;
    return `${y}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  if (parts.length === 2) {
    const year = new Date().getFullYear();
    return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  return dateStr;
}

function extractPlatformSales(headers, row) {
  const platforms = {};
  const platformMap = {
    rakuten: ['楽天', 'Rakuten'],
    yahoo: ['Yahoo', 'ヤフー'],
    amazon: ['Amazon', 'アマゾン'],
    shopify: ['Shopify', '自社'],
    giftmall: ['ギフトモール', 'GiftMall'],
    aupay: ['AuPay', 'au'],
    qoo10: ['Qoo10'],
  };

  for (const [key, candidates] of Object.entries(platformMap)) {
    const idx = findColumnIndex(headers, ...candidates);
    if (idx !== -1 && row[idx]) {
      const sales = parseInt(String(row[idx]).replace(/[,¥]/g, ''), 10);
      if (!isNaN(sales)) {
        platforms[key] = { sales };
      }
    }
  }

  return platforms;
}

async function getTodaySales(date) {
  const result = await getRowByDate(date);
  if (!result) return null;

  const { headers, row } = result;
  const platforms = extractPlatformSales(headers, row);

  const total = Object.values(platforms).reduce((sum, p) => sum + p.sales, 0);

  // 前日データ
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().slice(0, 10);
  const prevResult = await getRowByDate(prevDateStr);

  let totalPrevDay = 0;
  if (prevResult) {
    const prevPlatforms = extractPlatformSales(prevResult.headers, prevResult.row);
    totalPrevDay = Object.values(prevPlatforms).reduce((sum, p) => sum + p.sales, 0);

    for (const key of Object.keys(platforms)) {
      if (prevPlatforms[key]) {
        platforms[key].prevDay = prevPlatforms[key].sales;
      }
    }
  }

  return {
    date,
    total,
    totalPrevDay,
    platforms,
  };
}

async function getWeeklySales(startDate, endDate) {
  const sheets = await getSheets();
  const headers = await getHeaders();
  const dateColIdx = findColumnIndex(headers, '日付', 'date', 'Date');
  if (dateColIdx === -1) return [];

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.sheetsId,
    range: '楽天',
  });

  const rows = res.data.values || [];
  const results = [];

  for (let i = 1; i < rows.length; i++) {
    const rowDate = normalizeDate(rows[i][dateColIdx]);
    if (rowDate && rowDate >= startDate && rowDate <= endDate) {
      const platforms = extractPlatformSales(headers, rows[i]);
      const total = Object.values(platforms).reduce((sum, p) => sum + p.sales, 0);
      results.push({ date: rowDate, total, platforms });
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

async function getMonthlySales(year, month) {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  return getWeeklySales(startDate, endDate);
}

module.exports = { getTodaySales, getWeeklySales, getMonthlySales };
