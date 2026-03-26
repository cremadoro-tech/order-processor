function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function today() {
  return formatDate(new Date());
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

function getMonday(date) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return formatDate(d);
}

function getFriday(date) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -2 : 5);
  d.setDate(diff);
  return formatDate(d);
}

function getLastMonday() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getMonday(d);
}

function getLastFriday() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return getFriday(d);
}

function getLastMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatYen(amount) {
  return `¥${Number(amount).toLocaleString('ja-JP')}`;
}

function formatChangeRate(current, previous) {
  if (!previous || previous === 0) return 'N/A';
  const rate = ((current - previous) / previous) * 100;
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}

function parseDateRange(text) {
  // "3/3〜3/7" or "03/03〜03/07" or "3/3-3/7"
  const match = text.match(/(\d{1,2})\/(\d{1,2})\s*[〜~\-]\s*(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;

  const year = new Date().getFullYear();
  const startMonth = parseInt(match[1], 10);
  const startDay = parseInt(match[2], 10);
  const endMonth = parseInt(match[3], 10);
  const endDay = parseInt(match[4], 10);

  return {
    startDate: formatDate(new Date(year, startMonth - 1, startDay)),
    endDate: formatDate(new Date(year, endMonth - 1, endDay)),
  };
}

function parseMonth(text) {
  // "3月" or "03月" or "2026年3月"
  const matchFull = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (matchFull) {
    return { year: parseInt(matchFull[1], 10), month: parseInt(matchFull[2], 10) };
  }
  const matchShort = text.match(/(\d{1,2})\s*月/);
  if (matchShort) {
    return { year: new Date().getFullYear(), month: parseInt(matchShort[1], 10) };
  }
  return null;
}

module.exports = {
  formatDate,
  today,
  yesterday,
  getMonday,
  getFriday,
  getLastMonday,
  getLastFriday,
  getLastMonth,
  formatYen,
  formatChangeRate,
  parseDateRange,
  parseMonth,
};
