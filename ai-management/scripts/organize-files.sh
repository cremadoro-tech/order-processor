#!/bin/bash
# organize-files.sh — Downloads/Documents の一括整理
# ドライランモード: bash organize-files.sh --dry-run

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

DOWNLOADS="$HOME/Downloads"
DOCUMENTS="$HOME/Documents"

# 整理先ディレクトリ
EC_AMAZON="$DOCUMENTS/ec-data/amazon"
EC_RAKUTEN="$DOCUMENTS/ec-data/rakuten"
EC_YAHOO="$DOCUMENTS/ec-data/yahoo"
EC_SHOPIFY="$DOCUMENTS/ec-data/shopify"
EC_QOO10="$DOCUMENTS/ec-data/qoo10"
EC_NINT="$DOCUMENTS/ec-data/nint"
EC_OTHER="$DOCUMENTS/ec-data/other"
CONTRACTS="$DOCUMENTS/contracts"
PRODUCT_MASTERS="$DOCUMENTS/product/masters"
PRODUCT_SPECS="$DOCUMENTS/product/specs"
PRODUCT_IMAGES="$DOCUMENTS/product/images"
OPS_HR="$DOCUMENTS/operations/hr"
OPS_EXPENSES="$DOCUMENTS/operations/expenses"
OPS_LOGISTICS="$DOCUMENTS/operations/logistics"
MEETINGS="$DOCUMENTS/meetings"
PARTNERS="$DOCUMENTS/partners"
INSTALLERS="$DOCUMENTS/installers"
UNSORTED="$DOCUMENTS/unsorted"

# ディレクトリ作成
for d in "$EC_AMAZON" "$EC_RAKUTEN" "$EC_YAHOO" "$EC_SHOPIFY" "$EC_QOO10" "$EC_NINT" "$EC_OTHER" \
         "$CONTRACTS" "$PRODUCT_MASTERS" "$PRODUCT_SPECS" "$PRODUCT_IMAGES" \
         "$OPS_HR" "$OPS_EXPENSES" "$OPS_LOGISTICS" "$MEETINGS" "$PARTNERS" "$INSTALLERS" "$UNSORTED"; do
  mkdir -p "$d"
done

moved=0
skipped=0

move_file() {
  local src="$1"
  local dest_dir="$2"
  local fname
  fname=$(basename "$src")

  if [[ ! -e "$src" ]]; then
    return
  fi

  # 移動先に同名ファイルがある場合はスキップ
  if [[ -e "$dest_dir/$fname" ]]; then
    echo "  SKIP (exists): $fname"
    skipped=$((skipped + 1))
    return
  fi

  if $DRY_RUN; then
    echo "  [DRY] $fname -> $dest_dir/"
  else
    mv "$src" "$dest_dir/"
    echo "  MOVED: $fname -> $dest_dir/"
  fi
  moved=$((moved + 1))
}

echo "=== Downloads フォルダ整理開始 ==="
$DRY_RUN && echo "(ドライランモード — 実際の移動は行いません)"
echo ""

# --- Amazon ---
echo "[Amazon]"
for f in "$DOWNLOADS"/BusinessReport-*.csv "$DOWNLOADS"/Amazon_variation_mgmt*.xlsx \
         "$DOWNLOADS"/Amazonバリエーション*.xlsx "$DOWNLOADS"/a_product.csv \
         "$DOWNLOADS"/1_amzn1*.pdf "$DOWNLOADS"/QualityDelayrate*.csv; do
  [[ -e "$f" ]] && move_file "$f" "$EC_AMAZON"
done

# --- 楽天 ---
echo "[楽天]"
for f in "$DOWNLOADS"/*Item_SalesList*.csv "$DOWNLOADS"/*分析用レポート*.csv \
         "$DOWNLOADS"/rpp_item_reports_hankoya-shop*.zip "$DOWNLOADS"/rpp_item_reports_hankoya-shop*.csv \
         "$DOWNLOADS"/dl-normal-item*.csv "$DOWNLOADS"/r_product.csv \
         "$DOWNLOADS"/normal-item*.csv "$DOWNLOADS"/sales_D_*.csv \
         "$DOWNLOADS"/202602*item_list*.csv "$DOWNLOADS"/*お名前スタンプ*.csv \
         "$DOWNLOADS"/楽天_客単価減*.md "$DOWNLOADS"/楽天市場_売上減少分析*.pdf \
         "$DOWNLOADS"/*シャーペン人気商品*.csv; do
  [[ -e "$f" ]] && move_file "$f" "$EC_RAKUTEN"
done

# --- Yahoo ---
echo "[Yahoo]"
for f in "$DOWNLOADS"/day_sales_*.csv "$DOWNLOADS"/y_product.csv \
         "$DOWNLOADS"/Yahoo!_アフィリエイト*.csv \
         "$DOWNLOADS"/data2026*.csv "$DOWNLOADS"/yupurisky*.csv; do
  [[ -e "$f" ]] && move_file "$f" "$EC_YAHOO"
done

# --- Shopify ---
echo "[Shopify]"
for f in "$DOWNLOADS"/hankoya-store-7-*.csv; do
  [[ -e "$f" ]] && move_file "$f" "$EC_SHOPIFY"
done

# --- Qoo10 ---
echo "[Qoo10]"
for f in "$DOWNLOADS"/Qoo10_*.xlsx; do
  [[ -e "$f" ]] && move_file "$f" "$EC_QOO10"
done

# --- Nint ---
echo "[Nint]"
for f in "$DOWNLOADS"/ボールペン人気ショップ*.csv "$DOWNLOADS"/onamepon-*順位推移*.csv \
         "$DOWNLOADS"/onamae_seal_analysis.png; do
  [[ -e "$f" ]] && move_file "$f" "$EC_NINT"
done

# --- EC その他 ---
echo "[EC その他]"
for f in "$DOWNLOADS"/1771403805.xlsx "$DOWNLOADS"/1771468346257.csv \
         "$DOWNLOADS"/*inflow_oname-seal*.csv "$DOWNLOADS"/*item_detail_oname-seal*.csv \
         "$DOWNLOADS"/*item_detail_k-m-tuge*.csv "$DOWNLOADS"/CSV比較レポート.xlsx \
         "$DOWNLOADS"/原価率60以上*.csv "$DOWNLOADS"/日別の注文数.csv \
         "$DOWNLOADS"/product.csv "$DOWNLOADS"/onamae-ink-top_sample.csv \
         "$DOWNLOADS"/20260219113507.csv "$DOWNLOADS"/20260219113540.csv \
         "$DOWNLOADS"/20260219150954.csv "$DOWNLOADS"/20260219151152.csv \
         "$DOWNLOADS"/20260228105717.csv "$DOWNLOADS"/20260228105752.csv \
         "$DOWNLOADS"/20260228105834.csv "$DOWNLOADS"/20260228110242.csv \
         "$DOWNLOADS"/20260228110322.csv "$DOWNLOADS"/data202603032248.csv; do
  [[ -e "$f" ]] && move_file "$f" "$EC_OTHER"
done

# --- 契約書・見積・請求 ---
echo "[契約書・見積・請求]"
for f in "$DOWNLOADS"/SNSマーケティング業務委託契約書*.docx* "$DOWNLOADS"/SNSマーケティング支援業務委託*.pdf \
         "$DOWNLOADS"/*契約書*.pdf "$DOWNLOADS"/*契約書*.docx \
         "$DOWNLOADS"/shizaiお見積書*.pdf "$DOWNLOADS"/株式会社ハンコヤストア様_2026年2月度.pdf \
         "$DOWNLOADS"/*請求書*.xlsx "$DOWNLOADS"/*秘密保持契約書*.docx; do
  [[ -e "$f" ]] && move_file "$f" "$CONTRACTS"
done

# --- 商品マスター ---
echo "[商品マスター]"
for f in "$DOWNLOADS"/商品マスター*.xlsx "$DOWNLOADS"/"商品マスター - 商品マスター.csv" \
         "$DOWNLOADS"/ローズクォーツ*.xlsx "$DOWNLOADS"/牛皮*.xlsx \
         "$DOWNLOADS"/宝石印材*.xlsx; do
  [[ -e "$f" ]] && move_file "$f" "$PRODUCT_MASTERS"
done

# --- 商品仕様・チラシ ---
echo "[商品仕様・チラシ]"
for f in "$DOWNLOADS"/おむつスタンプ*.html "$DOWNLOADS"/おむつスタンプ撮影カット.pdf \
         "$DOWNLOADS"/お名前スタンプ*.pdf "$DOWNLOADS"/お名前シール*.xlsx "$DOWNLOADS"/お名前シール*.docx \
         "$DOWNLOADS"/LAMY.pdf "$DOWNLOADS"/ジョインティ.pdf \
         "$DOWNLOADS"/ノンプレスペイントマーカー*.pdf "$DOWNLOADS"/ボルトラインフレックス*.pdf \
         "$DOWNLOADS"/上柘印鑑_リライト指示書*.docx "$DOWNLOADS"/仕様書_ol.ai \
         "$DOWNLOADS"/フォントライセンス調査*.docx "$DOWNLOADS"/お名前ボックス*.pdf \
         "$DOWNLOADS"/ShootPlanner*.pdf \
         "$DOWNLOADS"/既存商品ページに新しいバリエーション*.docx; do
  [[ -e "$f" ]] && move_file "$f" "$PRODUCT_SPECS"
done

# --- 商品画像 ---
echo "[商品画像]"
for f in "$DOWNLOADS"/onamae-seal_01_1*.jpg "$DOWNLOADS"/ピンク*.jpg \
         "$DOWNLOADS"/追加１アートボード*.jpg; do
  [[ -e "$f" ]] && move_file "$f" "$PRODUCT_IMAGES"
done

# --- 社内業務: HR ---
echo "[HR]"
for f in "$DOWNLOADS"/*シフト*.xlsx; do
  [[ -e "$f" ]] && move_file "$f" "$OPS_HR"
done

# --- 社内業務: 経費 ---
echo "[経費]"
for f in "$DOWNLOADS"/*経費精算*.pdf "$DOWNLOADS"/領収書*.pdf; do
  [[ -e "$f" ]] && move_file "$f" "$OPS_EXPENSES"
done

# --- 社内業務: 物流・品番 ---
echo "[物流・品番]"
for f in "$DOWNLOADS"/品番品名不一致リスト.xlsx "$DOWNLOADS"/品番商品名不一致リスト.csv; do
  [[ -e "$f" ]] && move_file "$f" "$OPS_LOGISTICS"
done

# --- 会議録音・議事録 ---
echo "[会議]"
for f in "$DOWNLOADS"/*.mp3 "$DOWNLOADS"/*定例会議*.docx "$DOWNLOADS"/*週次会議*.docx \
         "$DOWNLOADS"/meeting*.txt "$DOWNLOADS"/会議概要.md \
         "$DOWNLOADS"/*打ち合わせ*.pdf; do
  [[ -e "$f" ]] && move_file "$f" "$MEETINGS"
done

# --- 外部パートナー・提案資料 ---
echo "[パートナー]"
for f in "$DOWNLOADS"/*提案資料*.pdf "$DOWNLOADS"/*ORPLY*.pdf \
         "$DOWNLOADS"/*楽天市場サービス向上委員会*.pdf \
         "$DOWNLOADS"/*ヒアリングシート*.xls \
         "$DOWNLOADS"/*コマースアドマネージャー*.xlsx \
         "$DOWNLOADS"/*広告設定*.xlsx "$DOWNLOADS"/広告実績*.xlsx \
         "$DOWNLOADS"/*Nint申込書*.pdf \
         "$DOWNLOADS"/LP_工数管理*.xlsx "$DOWNLOADS"/SNS投稿管理.xlsx \
         "$DOWNLOADS"/内例フォント管理*.pptx \
         "$DOWNLOADS"/キッズ・ベビージャンル*.xlsx; do
  [[ -e "$f" ]] && move_file "$f" "$PARTNERS"
done

# --- インストーラー ---
echo "[インストーラー]"
for f in "$DOWNLOADS"/*.dmg; do
  [[ -e "$f" ]] && move_file "$f" "$INSTALLERS"
done

# --- Documents 内の既存ファイルも整理 ---
echo ""
echo "=== Documents フォルダ整理 ==="

# Nint申込書
for f in "$DOCUMENTS"/20260116_Nint申込書*.pdf; do
  [[ -e "$f" ]] && move_file "$f" "$PARTNERS"
done

# Amazon
[[ -e "$DOCUMENTS/Amazon作成内容　抜き出し優先順位.xlsx" ]] && move_file "$DOCUMENTS/Amazon作成内容　抜き出し優先順位.xlsx" "$EC_AMAZON"

# HR系
for f in "$DOCUMENTS"/1月シフト.xlsx "$DOCUMENTS"/スキルマップ数値版*.xlsm "$DOCUMENTS"/アシール_生産性マスタ_算出.xlsx; do
  [[ -e "$f" ]] && move_file "$f" "$OPS_HR"
done

# 物流
[[ -e "$DOCUMENTS/出荷予測・推定LT.xlsx" ]] && move_file "$DOCUMENTS/出荷予測・推定LT.xlsx" "$OPS_LOGISTICS"

# --- 残りのファイルを unsorted へ ---
echo ""
echo "[未分類 → unsorted]"
for f in "$DOWNLOADS"/*; do
  fname=$(basename "$f")
  [[ "$fname" == ".DS_Store" ]] && continue
  [[ -d "$f" ]] && continue  # ディレクトリはスキップ
  move_file "$f" "$UNSORTED"
done

echo ""
echo "=== 完了 ==="
echo "移動: ${moved} 件 / スキップ: ${skipped} 件"
