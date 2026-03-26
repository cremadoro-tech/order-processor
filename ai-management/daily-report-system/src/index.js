const app = require('./slack/bot');
const config = require('./utils/config');

(async () => {
  const port = process.env.PORT || 3000;

  console.log('[CONFIG] BOT_TOKEN:', config.slack.botToken ? config.slack.botToken.slice(0, 10) + '...' : '未設定');
  console.log('[CONFIG] APP_TOKEN:', config.slack.appToken ? config.slack.appToken.slice(0, 10) + '...' : '未設定');
  console.log('[CONFIG] SIGNING_SECRET:', config.slack.signingSecret ? '設定済み' : '未設定');
  console.log('[CONFIG] CHANNEL_ID:', config.slack.channelId || '未設定');

  await app.start(port);
  console.log(`⚡ Daily Report Bot is running (port: ${port})`);
})();
