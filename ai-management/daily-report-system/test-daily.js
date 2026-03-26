require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { buildDailyPrompt } = require('./src/report/prompts/daily-prompt');

// テスト用メモ（CLAUDE.mdのサンプル）
const TEST_MEMO = process.argv[2] || `広告費集計50%
平岩さんMTG
Amazon商品登録レクチャー
楽天AI自動化テスト進めた
売上集計自動化80%くらい`;

const today = new Date().toISOString().slice(0, 10);

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY が .env に設定されていません');
    console.error('   .env ファイルを作成して ANTHROPIC_API_KEY=sk-ant-xxxx を設定してください');
    process.exit(1);
  }

  console.log('='.repeat(50));
  console.log('入力メモ:');
  console.log(TEST_MEMO);
  console.log('='.repeat(50));
  console.log('Claude APIで日報生成中...\n');

  const client = new Anthropic({ apiKey });
  const prompt = buildDailyPrompt(TEST_MEMO, null, today);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  console.log(response.content[0].text);
  console.log('\n' + '='.repeat(50));
  console.log(`トークン: 入力=${response.usage.input_tokens} / 出力=${response.usage.output_tokens}`);
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
