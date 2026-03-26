const QuickChart = require('quickchart-js');

const platformColors = {
  rakuten: '#BF0000',
  yahoo: '#FF0033',
  amazon: '#FF9900',
  shopify: '#96BF48',
  giftmall: '#E91E63',
  aupay: '#FF6F00',
  qoo10: '#00BCD4',
};

const platformNames = {
  rakuten: '楽天',
  yahoo: 'Yahoo',
  amazon: 'Amazon',
  shopify: 'Shopify',
  giftmall: 'ギフトモール',
  aupay: 'AuPay',
  qoo10: 'Qoo10',
};

function createChart(config) {
  const chart = new QuickChart();
  chart.setWidth(800);
  chart.setHeight(400);
  chart.setBackgroundColor('white');
  chart.setConfig(config);
  return chart;
}

async function generateDailySalesChart(salesData) {
  const labels = salesData.map(d => d.date.slice(5));
  const totalData = salesData.map(d => d.total);

  const datasets = [
    {
      label: '全店合計',
      data: totalData,
      borderColor: '#333333',
      borderWidth: 3,
      fill: false,
    },
  ];

  const allPlatforms = new Set();
  for (const day of salesData) {
    for (const key of Object.keys(day.platforms)) {
      allPlatforms.add(key);
    }
  }

  for (const platform of allPlatforms) {
    datasets.push({
      label: platformNames[platform] || platform,
      data: salesData.map(d => d.platforms[platform]?.sales || 0),
      borderColor: platformColors[platform] || '#999999',
      borderWidth: 1.5,
      fill: false,
    });
  }

  const chart = createChart({
    type: 'line',
    data: { labels, datasets },
    options: {
      title: { display: true, text: '売上推移' },
      legend: { position: 'bottom' },
    },
  });

  // URLを返す（Google Docsに画像として挿入可能）
  return chart.getUrl();
}

async function generatePlatformPieChart(platformTotals) {
  const labels = [];
  const data = [];
  const colors = [];

  for (const [key, total] of Object.entries(platformTotals)) {
    labels.push(platformNames[key] || key);
    data.push(total);
    colors.push(platformColors[key] || '#999999');
  }

  const chart = createChart({
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors }],
    },
    options: {
      title: { display: true, text: 'プラットフォーム別構成比' },
      legend: { position: 'bottom' },
    },
  });

  return chart.getUrl();
}

async function generateMonthCompareChart(thisMonth, lastMonth) {
  const allPlatforms = new Set([
    ...Object.keys(thisMonth),
    ...Object.keys(lastMonth),
  ]);

  const labels = [];
  const thisData = [];
  const lastData = [];

  for (const key of allPlatforms) {
    labels.push(platformNames[key] || key);
    thisData.push(thisMonth[key] || 0);
    lastData.push(lastMonth[key] || 0);
  }

  const chart = createChart({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '先月', data: lastData, backgroundColor: 'rgba(156,163,175,0.7)' },
        { label: '今月', data: thisData, backgroundColor: 'rgba(59,130,246,0.7)' },
      ],
    },
    options: {
      title: { display: true, text: '前月比較' },
      legend: { position: 'bottom' },
    },
  });

  return chart.getUrl();
}

module.exports = {
  generateDailySalesChart,
  generatePlatformPieChart,
  generateMonthCompareChart,
};
