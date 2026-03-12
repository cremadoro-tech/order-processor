import { google } from 'googleapis';
import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('../.env', 'utf-8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const i = trimmed.indexOf('=');
  if (i === -1) continue;
  env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
}

const token = JSON.parse(readFileSync('.cookies/google-token.json', 'utf-8'));
const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
auth.setCredentials(token);
const sheets = google.sheets({ version: 'v4', auth });
const res = await sheets.spreadsheets.get({ spreadsheetId: '1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw', fields: 'properties.title' });
console.log('接続OK:', res.data.properties.title);
