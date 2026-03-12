# /sns-auto-post — SNS自動投稿（投稿文生成 + 写真リサイズ + Buffer予約投稿）

## 概要

Google Sheetsの商品マスタ・投稿スケジュールをもとに、Claude APIで投稿文を生成し、写真をSNS別にリサイズし、Buffer GraphQL API経由でInstagram・X・Threadsに予約投稿する。

## 対象SNS

| SNS | 投稿方式 | 写真サイズ | ハッシュタグ |
|:----|:---------|:----------|:-----------|
| Instagram | Buffer（画像投稿） | 1080x1350 (4:5) | 10-15個 |
| X | Buffer（テキスト） | 1200x675 (16:9) | 3個以内 |
| Threads | Buffer（テキスト） | 1080x1350 (4:5) | 1個のみ（トピック制限） |

## 実行手順

### Step 1: 投稿文を生成（GAS）

Google Sheetsの「SNS投稿」メニュー → 「未生成の投稿文を一括生成」を実行。
Claude APIが商品情報 + テンプレートをもとにSNS別の投稿文を自動生成する。

- スプレッドシートID: `1cMygpk8PPlZKzRAnPus3TwDJmRYy9x8GSZ4Gj3_eat8`
- GASコード: `sns-auto-post/gas/Code.gs`

### Step 2: 写真をSNS別にリサイズ

```bash
cd "/Users/emizukami/My WorkSpace/ai-management/sns-auto-post" && node prepare-photos.mjs
```

- 商品マスタの写真URL（Google Drive）からダウンロード
- SNS別サイズにリサイズ・クロップして `output/photos/` に出力
- `_post.txt` に投稿テキスト + メタデータも出力

オプション:
- `--row 3` : 特定行のみ
- `--product SEAL001` : 特定商品のみ
- `--dry-run` : 確認のみ

### Step 3: Buffer経由で予約投稿

```bash
cd "/Users/emizukami/My WorkSpace/ai-management/sns-auto-post" && node post-to-buffer.mjs
```

- 投稿スケジュールのステータスが「生成済」「写真準備済」の行を処理
- Buffer GraphQL API経由でInstagram・X・Threadsに予約投稿
- 成功後、スプレッドシートのステータスを「投稿予約済」に更新

オプション:
- `--row 3` : 特定行のみ
- `--product SEAL001` : 特定商品のみ
- `--dry-run` : 確認のみ

## スケジュール確認

```bash
cd "/Users/emizukami/My WorkSpace/ai-management/sns-auto-post" && node check-products.mjs
```

## 投稿時間の指定

スプレッドシートの投稿日列に時刻を含めることで投稿時間を制御できる:
- `2026/03/10 18:30` → JST 18:30 に予約
- `2026/03/10` → デフォルト JST 09:00 に予約

## Buffer API

- API: GraphQL (`https://api.buffer.com`)
- 認証: `.env` の `BUFFER_ACCESS_TOKEN`
- Organization ID: `69a834b4189dcc779d082cde`
- チャネル: Instagram, Threads, X（全て @hankoya_store）

### SNS別メタデータ（自動付与）
- Instagram: `metadata: { instagram: { type: post, shouldShareToFeed: true } }`
- Threads: `metadata: { threads: { type: post } }`

### 画像URL
Google Drive画像は `lh3.googleusercontent.com/d/{FileID}` 形式に自動変換される。

## 注意事項

- Buffer無料枠: 3チャネル x 10件予約 = 合計30件まで
- Threadsはハッシュタグ1個のみ（プラットフォーム制限）
- 過去日の予約はキューに追加される（`addToQueue` モード）
- Google Tokenの `refresh_token` が消えやすい → `scripts/.cookies/google-token.json` を確認

## 前提条件

- `.env` に `BUFFER_ACCESS_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` が設定されていること
- `scripts/.cookies/google-token.json` に refresh_token 付きの Google 認証トークンがあること
- GASにClaude APIキーがスクリプトプロパティとして設定されていること
- `npm install` 済み（sharp, googleapis）

## ファイル構成

| ファイル | 役割 |
|:--------|:-----|
| `sns-auto-post/gas/Code.gs` | GAS: Claude APIで投稿文生成 |
| `sns-auto-post/prepare-photos.mjs` | 写真ダウンロード・SNS別リサイズ |
| `sns-auto-post/post-to-buffer.mjs` | Buffer GraphQL API経由で予約投稿 |
| `sns-auto-post/check-products.mjs` | スケジュール確認ユーティリティ |
| `sns-auto-post/output/photos/` | SNS別写真の出力先 |
