import { google } from 'googleapis';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '../.env');
const TOKEN_PATH = join(__dirname, '../scripts/.cookies/google-token.json');

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

const SPREADSHEET_ID = '1cMygpk8PPlZKzRAnPus3TwDJmRYy9x8GSZ4Gj3_eat8';

const { data } = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '投稿スケジュール!A1:I10',
});

console.log('=== 投稿スケジュール ===');
const headers = data.values[0];
for (let i = 1; i < data.values.length; i++) {
  const row = data.values[i];
  console.log(`\n--- 行${i + 1} ---`);
  headers.forEach((h, j) => {
    console.log(`  ${h}: ${row[j] || '(空)'}`);
  });
}
