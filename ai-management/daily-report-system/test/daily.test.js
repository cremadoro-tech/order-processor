const { buildDailyPrompt } = require('../src/report/prompts/daily-prompt');
const sampleMemos = require('./fixtures/sample-memos.json');

describe('buildDailyPrompt', () => {
  test('プロンプトにメモ内容が含まれる', () => {
    const memo = sampleMemos[0].memo;
    const prompt = buildDailyPrompt(memo, null, '2026-03-08');
    expect(prompt).toContain(memo);
    expect(prompt).toContain('2026-03-08');
  });

  test('売上データなしの場合、適切なフォールバック文言が入る', () => {
    const prompt = buildDailyPrompt('テスト', null, '2026-03-08');
    expect(prompt).toContain('本日の売上データなし');
  });

  test('売上データありの場合、売上テキストが含まれる', () => {
    const salesText = '全店合計: ¥150,000（前日比 +5.0%）';
    const prompt = buildDailyPrompt('テスト', salesText, '2026-03-08');
    expect(prompt).toContain(salesText);
  });

  test('プロンプトに絶対ルールが含まれる', () => {
    const prompt = buildDailyPrompt('テスト', null, '2026-03-08');
    expect(prompt).toContain('メモに書いてあることだけを書く');
    expect(prompt).toContain('課題・気づき・学びを捏造しない');
    expect(prompt).toContain('ハイライトは1行で完結させる');
  });

  test('日付からハッシュタグが正しく生成される', () => {
    const prompt = buildDailyPrompt('テスト', null, '2026-03-08');
    expect(prompt).toContain('#2026年03月');
  });
});

describe('サンプルメモのバリデーション', () => {
  test('全サンプルメモにidとmemoがある', () => {
    for (const sample of sampleMemos) {
      expect(sample.id).toBeDefined();
      expect(sample.memo).toBeDefined();
      expect(sample.memo.length).toBeGreaterThan(0);
    }
  });

  test('test-1のexpected_not_containが配列', () => {
    const t1 = sampleMemos.find(s => s.id === 'test-1');
    expect(Array.isArray(t1.expected_not_contain)).toBe(true);
    expect(t1.expected_not_contain.length).toBeGreaterThan(0);
  });

  test('test-3に課題・明日の期待値がある', () => {
    const t3 = sampleMemos.find(s => s.id === 'test-3');
    expect(t3.expected_issues_not_empty).toBe(true);
    expect(t3.expected_tomorrow).toBeDefined();
  });
});
