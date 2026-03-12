import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env');
const TOKEN_PATH = join(__dirname, '../scripts/.cookies/google-token.json');
const SPREADSHEET_ID = '1cMygpk8PPlZKzRAnPus3TwDJmRYy9x8GSZ4Gj3_eat8';

function loadEnv() {
  const content = readFileSync(ENV_PATH, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
auth.setCredentials(token);
auth.on('tokens', (t) => writeFileSync(TOKEN_PATH, JSON.stringify(t, null, 2)));
const sheets = google.sheets({ version: 'v4', auth });

// SEAL001のリール/ショートを1行追加
await sheets.spreadsheets.values.append({
  spreadsheetId: SPREADSHEET_ID,
  range: '投稿スケジュール!A:I',
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [
      ['2026/03/08', 'Instagram', 'SEAL001', 'リール/ショート', '', '未生成', '', '', ''],
    ],
  },
});

console.log('リール/ショート行を追加しました（行8）');
