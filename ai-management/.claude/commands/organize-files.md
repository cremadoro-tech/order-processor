# /organize-files — Downloads/Documents のファイル整理

## 概要
~/Downloads と ~/Documents 内のファイルを、業務カテゴリに基づいて自動分類・整理する。

## 実行手順

### 1. ドライラン（確認のみ）
```bash
bash scripts/organize-files.sh --dry-run
```
移動先を確認する。実際のファイル移動は行わない。

### 2. 本番実行
```bash
bash scripts/organize-files.sh
```

## 整理先フォルダ構造（~/Documents/）

| フォルダ | 内容 |
|:--------|:-----|
| `ec-data/amazon/` | Amazon BusinessReport, バリエーション設定 |
| `ec-data/rakuten/` | 楽天 日次分析レポート, RPP, SalesList, item_list |
| `ec-data/yahoo/` | Yahoo day_sales, yupurisky |
| `ec-data/shopify/` | Shopify store_overall, item_report |
| `ec-data/qoo10/` | Qoo10 ItemInfo, Transaction |
| `ec-data/nint/` | Nint ボールペン人気ショップ, 順位推移 |
| `ec-data/other/` | inflow, item_detail, 原価率分析等 |
| `contracts/` | 契約書, NDA, 見積書, 請求書 |
| `product/masters/` | 商品マスター, 印材データ |
| `product/specs/` | チラシ, 取扱説明書, リライト指示書 |
| `product/images/` | 商品写真 |
| `operations/hr/` | シフト, スキルマップ |
| `operations/expenses/` | 経費精算, 領収書 |
| `operations/logistics/` | 出荷予測, 品番リスト |
| `meetings/` | 会議録音(MP3), 議事録 |
| `partners/` | 外部パートナー提案資料, 広告実績 |
| `installers/` | DMGインストーラー |
| `unsorted/` | 自動分類できなかったファイル |

## 分類ロジック
- ファイル名のキーワード・拡張子で振り分け
- 分類済みファイルは unsorted に重複移動しない
- 移動先に同名ファイルが既に存在する場合はスキップ

## 日次自動整理（別途 cron 稼働中）
- `scripts/auto-cleanup.sh`（毎日08:00 launchd実行）
- Desktop/Downloads の30日超ファイル → `archive/` に退避
- output/logs の7日超ログ → gzip圧縮して `archive/logs/` に退避
