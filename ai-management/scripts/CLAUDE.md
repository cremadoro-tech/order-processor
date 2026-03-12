# scripts/ — 自動化スクリプト群

## ディレクトリ構成

| パス | 役割 |
|:----|:-----|
| `ec/` | ECデータ取得スクレイパー（詳細は `ec/CLAUDE.md`） |
| `jobcan/` | ジョブカン勤怠打刻 |
| `nint/` | Nintトレンドリサーチ |
| `slack-daily-report.mjs` | EC売上日報をSlackに投稿 |
| `daily-report.sh` | ECデータ取得→シート記録→Slack投稿の一括実行 |
| `check_sheets.mjs` | スプレッドシートのデータ確認ユーティリティ |
| `fix_formulas.mjs` | スプレッドシートの数式修正 |

## 技術スタック
- Node.js（ES modules: `"type": "module"`）
- Playwright（ブラウザ自動化）
- googleapis（Sheets API）

## 認証
- `.env` から環境変数を読み込み
- ブラウザセッション: `.cookies/` に永続化（Git管理外）
- Google OAuth: `.cookies/google-token.json`（refresh_token消失時は `/.google_token.json` から復元）
