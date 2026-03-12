# SNS自動投稿システム

## 目的
商品ごとの写真とURLを管理し、SNS投稿を自動化する

## 対象SNS
Instagram, X, Threads（Buffer経由で自動投稿）
TikTok, Facebook, YouTube Shorts（手動 or 今後対応）

## 技術スタック
- フロントエンド: Google Sheets（運用管理画面）
- バックエンド: Google Apps Script + Node.js
- AI: Claude API（投稿文生成、claude-sonnet-4-5-20250929）
- 画像処理: sharp（Node.js）— SNS別リサイズ
- 投稿: Buffer GraphQL API（自動予約投稿）
- ストレージ: Google Drive

## Phase
1. **Phase 1（完了）**: GAS + Claude APIで投稿文生成
2. **Phase 2（完了）**: SNS別写真リサイズ・出力
3. **Phase 3（完了）**: Buffer GraphQL API連携で予約投稿

## スプレッドシートID
`1cMygpk8PPlZKzRAnPus3TwDJmRYy9x8GSZ4Gj3_eat8`

## Google Sheets構成
- 商品マスタ: 商品ID, 商品名, カテゴリ, ターゲット, ターゲットの悩み, ベネフィット, 商品URL, 写真URL, 価格, 補足情報
- 投稿スケジュール: 投稿日, SNS, 商品ID, 形式, 生成テキスト, ステータス, 生成日時, 投稿URL, 備考
- テンプレート: SNS名, トーン, 文字数目安, ハッシュタグ個数, CTA例

## ファイル構成
| ファイル | 役割 |
|:--------|:-----|
| `gas/Code.gs` | GAS本体（投稿文生成、Claude API連携） |
| `gas/appsscript.json` | GASマニフェスト |
| `setup-sheet.mjs` | スプレッドシート初期作成 |
| `update-sheet.mjs` | スプレッドシート列構成更新 |
| `insert-test-data.mjs` | テストデータ投入 |
| `prepare-photos.mjs` | SNS別写真リサイズ・出力 |
| `post-to-buffer.mjs` | Buffer GraphQL API経由で予約投稿 |
| `output/photos/` | SNS別写真の出力先 |

## Buffer API
- API: GraphQL (`https://api.buffer.com`)
- 認証: `Authorization: Bearer {BUFFER_ACCESS_TOKEN}`
- Organization ID: `69a834b4189dcc779d082cde`
- チャネル: Instagram, Threads, X（@hankoya_store）
- 画像URL: `lh3.googleusercontent.com/d/{Drive File ID}` 形式
- Instagram投稿にはmetadata必須: `{ instagram: { type: post, shouldShareToFeed: true } }`

## SNS別写真仕様
| SNS | サイズ | 比率 | 最大枚数 |
|:----|:-------|:-----|:---------|
| Instagram | 1080x1350 | 4:5 | 20 |
| X | 1200x675 | 16:9 | 4 |
| Facebook | 1200x630 | 1.91:1 | 25 |
| Threads | 1080x1350 | 4:5 | 20 |
| TikTok | 1080x1920 | 9:16 | 35 |

## 依存関係
- `sharp`: 画像処理（リサイズ・クロップ）
- `googleapis`: Google Sheets API
