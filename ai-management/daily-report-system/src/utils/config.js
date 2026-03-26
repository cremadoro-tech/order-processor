require('dotenv').config();

const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
    channelId: process.env.SLACK_CHANNEL_ID,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1500,
    temperature: 0,
  },
  google: {
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './credentials.json',
    sheetsId: process.env.GOOGLE_SHEETS_ID,
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  },
};

module.exports = config;
