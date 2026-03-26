const { App } = require('@slack/bolt');
const config = require('../utils/config');
const { routeCommand } = require('./commands');

const app = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  appToken: config.slack.appToken,
  socketMode: true,
});

app.message(async ({ message, client, say }) => {
  console.log('[DEBUG] メッセージ受信:', message.channel, '期待チャンネル:', config.slack.channelId);

  // Bot自身の投稿は無視（無限ループ防止）
  if (message.subtype === 'bot_message' || message.bot_id) return;

  // #daily-memo チャンネルのみ対象
  if (config.slack.channelId && message.channel !== config.slack.channelId) {
    console.log('[DEBUG] チャンネルIDが一致しないためスキップ');
    return;
  }

  try {
    // 処理中リアクション
    await client.reactions.add({
      channel: message.channel,
      timestamp: message.ts,
      name: 'hourglass_flowing_sand',
    });

    // コマンドルーティング
    const result = await routeCommand(message.text);

    // 完了リアクション（砂時計を外して✓に変更）
    await client.reactions.remove({
      channel: message.channel,
      timestamp: message.ts,
      name: 'hourglass_flowing_sand',
    });
    await client.reactions.add({
      channel: message.channel,
      timestamp: message.ts,
      name: 'white_check_mark',
    });

    // スレッドに結果を返信
    await say({
      text: result.message,
      thread_ts: message.ts,
    });
  } catch (error) {
    console.error('Error processing message:', error);

    // エラーリアクション
    try {
      await client.reactions.remove({
        channel: message.channel,
        timestamp: message.ts,
        name: 'hourglass_flowing_sand',
      });
    } catch (_) { /* ignore */ }

    await client.reactions.add({
      channel: message.channel,
      timestamp: message.ts,
      name: 'x',
    });

    await say({
      text: `エラーが発生しました: ${error.message}`,
      thread_ts: message.ts,
    });
  }
});

module.exports = app;
