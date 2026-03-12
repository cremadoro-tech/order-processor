# RULES.md — 運用ルール・命名規則・禁止事項

このファイルはAI・人間の両方が守るべきルールを定義する。

---

## 1. ファイル命名規則

| 種別 | 命名パターン | 例 |
|:----|:-----------|:---|
| 議事録 | `YYYYMMDD_会議名.md` | `20260307_企画会議.md` |
| 記事・コンテンツ | `YYYY-MM-DD-商品名-channel.{html,csv,md}` | `2026-03-02-TOPスタンプ台-rakuten.html` |
| トレンドレポート | `YYYY-MM-DD-カテゴリ.md` | `2026-03-07-印鑑.md` |
| 実行ログ | `{スクリプト名}-YYYY-MM-DD.log` | `daily-report-2026-03-04.log` |
| スクリプト（Node.js） | kebab-case + `.mjs` or `.js` | `slack-daily-report.mjs` |
| ディレクトリ | snake_case or kebab-case（英数字） | `scripts/ec/`, `sns-auto-post/` |

## 2. ディレクトリ運用ルール

- **各主要ディレクトリにCLAUDE.mdを配置する**: AIが「今いる場所」の文脈を即座に理解するため
- **出力ファイルは上書きしない**: 日付で区別し、過去データを保全する
- **ログは7日で圧縮退避**: `output/logs/` の古いログは自動的にアーカイブ
- **新しいスキルは `.agents/skills/{スキル名}/` に配置**: `SKILL.md` を必ず含める

## 3. コード規約

- **Node.js**: ES modules（`"type": "module"`）で統一
- **Python**: venvを使用。`requirements.txt` を必ず含める
- **環境変数**: `.env` から読み込み。ハードコードしない
- **テストフラグ**: `--dry-run`, `--no-post`, `--no-sheets` で本番影響なしのテストを可能にする

## 4. Git運用ルール

- **コミットメッセージ**: `feat:`, `fix:`, `chore:`, `docs:` のプレフィックスを使用
- **ブランチ**: 基本 `main` で運用。大きな変更は feature ブランチ

## 5. 禁止事項

### 絶対禁止
- `.env`、`*.key`、`credentials/`、`*.json.bak` のGitコミット
- APIキー・シークレットのファイル直接書き込み
- 売上データ・顧客情報の外部共有
- `scripts/.cookies/` 内のセッションデータのGitコミット

### 原則禁止
- **推測で進めない**: 不明な点があれば必ずユーザーに確認してから作業する
- **本番データの直接削除**: 削除より退避（archive/）を優先する
- **CLAUDE.mdのない新規ディレクトリ作成**: 主要ディレクトリには文脈ファイルを配置する

## 6. 認証情報管理

| 認証対象 | 保存場所 | 注意点 |
|:--------|:--------|:------|
| 全API共通 | `.env` | Git管理対象外 |
| Google OAuth | `scripts/.cookies/google-token.json` | refresh_token消失時は `.google_token.json` から復元 |
| ブラウザセッション | `scripts/.cookies/profile-{site}/` | Git管理対象外 |
| PLAUD JWT | `.agents/skills/meeting-notes/data/plaud-creds.json` | 約1年有効 |
