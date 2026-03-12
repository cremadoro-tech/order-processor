/**
 * logger.js - ログ出力ユーティリティ
 */

import dayjs from 'dayjs';

const PREFIX = {
  info:    '📋',
  success: '✅',
  warn:    '⚠️ ',
  error:   '❌',
  start:   '🚀',
  data:    '📊',
};

function timestamp() {
  return dayjs().format('HH:mm:ss');
}

export const logger = {
  info:    (site, msg) => console.log(`[${timestamp()}] ${PREFIX.info}  [${site}] ${msg}`),
  success: (site, msg) => console.log(`[${timestamp()}] ${PREFIX.success} [${site}] ${msg}`),
  warn:    (site, msg) => console.warn(`[${timestamp()}] ${PREFIX.warn} [${site}] ${msg}`),
  error:   (site, msg) => console.error(`[${timestamp()}] ${PREFIX.error} [${site}] ${msg}`),
  start:   (site, msg) => console.log(`[${timestamp()}] ${PREFIX.start} [${site}] ${msg}`),
  data:    (site, data) => {
    console.log(`[${timestamp()}] ${PREFIX.data} [${site}] 取得データ:`);
    console.table(data);
  },
};
