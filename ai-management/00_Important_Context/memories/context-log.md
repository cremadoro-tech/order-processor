# context-log — プロジェクト進捗・技術検証結果

最終更新: 2026/03/07

---

## 導入済みスキル一覧

| スキル | ステータス | 実装日 | 備考 |
|:------|:----------|:-------|:-----|
| `/daily-schedule` | 完了 | 2026/02 | Google Calendarから工程表自動生成 |
| `/issue-triage` | 完了 | 2026/02 | GitHub Issues自動作成 |
| `/agent-memory` | 完了 | 2026/02 | AIメモリ保存 |
| `/write-draft` | 完了 | 2026/02 | 記事・コンテンツ下書き生成 |
| `/trend-check` | 完了 | 2026/02 | Nintトレンドリサーチ |
| `/write-product` | 完了 | 2026/02 | 楽天HTML + 6チャネル展開コンテンツ生成 |
| `/update-ec-data` | 完了 | 2026/03/04 | Shopify + Amazon + 楽天 + Yahoo! + GoQ |
| `/slack-daily-report` | 完了 | 2026/03/04 | EC売上日報をSlackに投稿 |
| `/daily-report` | 完了 | 2026/03/04 | ECデータ取得→シート記録→Slack投稿を一括 |
| `/sns-auto-post` | 完了 | 2026/03/04 | Buffer GraphQL APIで予約投稿（Phase 3完了） |
| `/meeting-notes` | 完了 | 2026/03/06 | PLAUD AI + Whisper + Google Docs |
| `/ec-strategy` | 完了 | 2026/03/10 | EC物販向け6ステップマーケ戦略・LP構成案を自動生成（Nint + Playwright + NotebookLM連携） |
| `/aupay-ad-strategy` | 完了 | 2026/03/11 | AuPay Market向け広告・キャンペーン戦略4ステップ自動生成 |
| `/attendance` | 実装中 | - | ジョブカン自動操作 |

---

## 企画書生成ワークフロー（2026/03/11）

- スクリプト: `scripts/generate_proposal.py`
- テンプレート: `scripts/hankoya_proposal_template.xlsx`
- 実行例: `python3 scripts/generate_proposal.py input.json --strategy ec-strategy.md --lp lp.html`
- 入力JSON: `03_projects/[品番]_input.json`
- 出力: `03_projects/企画書_[品番]_[日時].xlsx`（企画書・EC戦略・LPの3タブ）
- **既知の問題**: openpyxlでテンプレートを再ロードして保存するとExcelで開けないことがある。原因調査中。

---

## EC売上データ取得パイプライン

| チャネル | 取得方法 | 状態 |
|:--------|:---------|:-----|
| Shopify | API直接 | 稼働中 |
| Amazon | セラーセントラル（Playwright） | 稼働中 |
| 楽天 | RMS データツール（Playwright） | 稼働中 |
| Yahoo! | ストアクリエイターPro（Playwright） | 稼働中（列修正済み） |
| ギフトモール | GoQ経由 | 稼働中 |
| Qoo10 | GoQ経由 | 稼働中 |
| auPAY | GoQ経由 | 稼働中 |

コマンド: `node scripts/ec/index.js`（引数なしで未取得日を自動検出・補完）

---

## SNS自動投稿システム（Phase 3完了）

- Phase 1: GAS + Claude APIで投稿文生成（`gas/Code.gs`）
- Phase 2: SNS別写真リサイズ（`prepare-photos.mjs`）
- Phase 3: Buffer GraphQL API予約投稿（`post-to-buffer.mjs`）
- テスト商品3つ登録済み: SEAL001, STONE001, PEN001
- 対応SNS: Instagram / X / Threads（Buffer経由）

---

## Meeting Notesスキル

フロー: PLAUD API録音検索 → 議事録あり→そのまま使用 / なし→Whisperで文字起こし→Claude API構造化 → Google Docs保存

技術スタック:
- PLAUD API JWT（`data/plaud-creds.json`、約1年有効）
- Whisper（ローカル実行、無料・高精度）
- Google Docs OAuth2（`.google_token.json`）

---

## 認証情報の管理状況

| 認証対象 | 保存場所 | 注意点 |
|:--------|:--------|:------|
| Google OAuth | `scripts/.cookies/google-token.json` | refresh_token消失時は `.google_token.json` から復元 |
| PLAUD JWT | `.agents/skills/meeting-notes/data/plaud-creds.json` | 約1年有効 |
| その他（Shopify, Buffer, Slack, GitHub） | `.env` | トークン文字列 |

---

## /write-product CSV生成機能（2026/03/08 実装完了）

`/write-product` スキルにCSV自動生成ステップを追加した。

### 追加・変更ファイル
- `scripts/ec/utils/rakuten-genre.js` — ジャンルID自動取得ユーティリティ（新規作成）
- `.claude/commands/write-product.md` — Step 5 CSV生成ステップを追加
- `.claude/agents/product-content-team.md` — CSV生成担当エージェント定義を追加
- `scripts/package.json` — `"rakuten:genre": "node ec/utils/rakuten-genre.js"` スクリプト追加

### ジャンルID取得の仕組み（3段階フォールバック）
1. **RMS API v2**（`GET /es/2.0/items/search/?title=<keyword>&hits=20`）
   ESA認証（RAKUTEN_SERVICE_SECRET + RAKUTEN_LICENSE_KEY）で自店舗商品をタイトル検索→genreIdを多数決で取得
2. **Ichiba Item Search API**（APP_ID設定時のみ）
3. **キーワードフォールバックマップ**（RMS APIがヒットしない場合）

### RMS API 注意事項
- `keyword` パラメータは機能しない（全件返す）→ `title` パラメータを使うこと
- `/es/1.0/item/search/` は存在しない（404）→ `/es/2.0/items/search/` が正解
- RMS実測ジャンルID: スタンプ台=111177, 印鑑=401760, ボールペン=216081, 万年筆=210246, シャープ=205824

### カタログID運用ルール
- JANコード指定あり → SKU行の「カタログID」にJANコードを入力
- JANコード指定なし → SKU行の「カタログIDなしの理由」に `3`（自社商品・オリジナル）を入力

---

## 未実装・検討中

- 不足日補填（1日と3日が存在する場合に2日を自動取得）— 次フェーズ予定
- `generate-video.mjs` — 保留中（動画→写真にピボット済み）
