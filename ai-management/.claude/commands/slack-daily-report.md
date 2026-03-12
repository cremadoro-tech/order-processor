# /slack-daily-report — EC売上日報をSlackに投稿する

## 概要
Google Sheetsから前日のEC売上データを読み込み、Slack の `hs-ec運営` チャンネルに日報を投稿するスキル。
毎朝9時に launchd で自動実行される。手動実行も可能。

## 実行コマンド

```bash
# 前日データを投稿（通常）
node scripts/slack-daily-report.mjs

# 日付指定で投稿
node scripts/slack-daily-report.mjs 2026-03-01
```

## 投稿フォーマット

```
@channel 📊 *EC売上日報【YYYY/M/D】*

━━━━━━━━━━━━━━━━━━
🏆 *全チャネル合計*
売上: ¥XX,XXX,XXX　件数: X,XXX件　昨対: XXX.X%
累計売上: ¥XX,XXX,XXX　累計昨対: XXX.X%

━━━━━━━━━━━━━━━━━━
📌 *各チャネル内訳*

*楽天*　¥X,XXX,XXX　件数: X,XXX件　昨対: XXX.X%
　　累計: ¥X,XXX,XXX　累計昨対: XXX.X%
*Yahoo*　...
*Amazon*　...
*Q10*　...
*Shopify*　...
*auPAY*　...
*GM*　...
```

## データソース

| チャンネル | シート | 備考 |
|:---------|:------|:-----|
| 楽天 | `楽天` タブ | 売上金額・受注件数 |
| Yahoo | `Yahoo` タブ | 売上合計値・注文者数 |
| Amazon | `Amazon` タブ | 注文商品の売上額・注文品目総数・昨対比（計算済み列使用） |
| Q10 | `GM` タブ（Qoo10店 列） | 昨対比・累計昨対比は計算済み列使用 |
| Shopify | `GM` タブ（Shopify 1号店 列） | 同上 |
| auPAY | `GM` タブ（auPAYマーケット 列） | 同上 |
| GM | `GM` タブ（ギフトモール 列） | 同上 |

- スプレッドシートID: `1R73DTJSe5uCy4_gbCQlKwPjjSyGCcyggoB8B1hd8fDw`
- 昨対比: シートに計算済み列があれば使用、なければ前年同日データから計算
- 累計昨対比: 月初〜対象日の合計で計算

## 自動実行設定（launchd）

- 設定ファイル: `~/Library/LaunchAgents/com.hs-ec.daily-report.plist`
- 実行スクリプト: `scripts/daily-report.sh`
- 実行時刻: 毎日 9:00
- ログ: `output/logs/daily-report-YYYY-MM-DD.log`

### launchd 操作コマンド
```bash
# 登録確認
launchctl list | grep hs-ec

# 今すぐ手動実行（テスト）
bash scripts/daily-report.sh

# 停止
launchctl unload ~/Library/LaunchAgents/com.hs-ec.daily-report.plist

# 再起動
launchctl unload ~/Library/LaunchAgents/com.hs-ec.daily-report.plist
launchctl load   ~/Library/LaunchAgents/com.hs-ec.daily-report.plist
```

## 前提条件

- `.env` に以下が設定されていること
  ```
  SLACK_BOT_TOKEN=xoxb-...
  SLACK_CHANNEL_ID=C...
  GOOGLE_CLIENT_ID=...
  GOOGLE_CLIENT_SECRET=...
  ```
- `scripts/.cookies/google-token.json` にGoogle認証トークンが存在すること
  （期限切れの場合は `node scripts/ec/login-helper.js --google` で再取得）
- Slack「売上日報Bot」が `hs-ec運営` チャンネルに招待されていること

## トラブルシューティング

| エラー | 原因 | 対処 |
|:------|:-----|:----|
| `No refresh token is set.` | Google認証トークン切れ | `node scripts/ec/login-helper.js --google` を実行 |
| `channel_not_found` | BotがChannelにいない / ID間違い | Slackで `/invite @売上日報Bot` を実行 |
| `not_in_channel` | Bot未招待 | 同上 |
| データが全て `-` | スプレッドシートの日付形式の不一致 | シートの日付フォーマットを確認 |
