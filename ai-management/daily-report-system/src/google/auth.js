const { google } = require('googleapis');
const path = require('path');
const config = require('../utils/config');

let authClient = null;

async function getAuthClient() {
  if (authClient) return authClient;

  const keyPath = path.resolve(config.google.serviceAccountKeyPath);
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  authClient = await auth.getClient();
  return authClient;
}

async function getDocs() {
  const auth = await getAuthClient();
  return google.docs({ version: 'v1', auth });
}

async function getSheets() {
  const auth = await getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

async function getDrive() {
  const auth = await getAuthClient();
  return google.drive({ version: 'v3', auth });
}

module.exports = { getAuthClient, getDocs, getSheets, getDrive };
