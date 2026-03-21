"""受注処理システム — Streamlit アプリ"""

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from processor.reader import read_csv, detect_platform
from processor.normalizer import normalize
from processor.cleanser import cleanse
from processor.classifier import classify_all, split_by_category
from processor.seal_checker import check_seal_confirmation
from processor.caution_extractor import extract_cautions
from processor.attribute_parser import parse_attributes
from processor.name_extractor import extract_names
from processor.excel_generator import generate_workbook
from processor.jointy_checker import check_jointy
from processor.quantity_checker import check_quantity_advanced
from processor.exporter import to_csv_bytes, to_zip_bytes, generate_filename
from config.product_lookup import get_all_db_stats
from config.cleansing_patterns import (
    get_remove_patterns,
    add_pattern,
    remove_pattern,
    save_patterns,
    load_patterns,
)
from config.categories import (
    load_categories,
    save_categories,
    add_keyword,
    remove_keyword,
    move_keyword,
)
from config.settings_io import load_json, save_json, is_writable
from processor.transfer_engine import (
    load_transfer_rules, get_headers_for_sheet, get_sheet_names,
    apply_transfer_rules, ConsumedLineTracker, _dispatch_rule
)

st.set_page_config(
    page_title="受注処理システム",
    page_icon="📦",
    layout="wide",
)


def main():
    st.title("📦 受注処理システム")
    st.caption("CSVアップロード → クレンジング → カテゴリ別振り分け → ダウンロード")

    # 読み取り専用警告
    if not is_writable():
        st.sidebar.warning("読み取り専用モード（設定変更はGitHub経由）")

    # サイドバー: ページ切り替え
    page = st.sidebar.radio(
        "ページ",
        ["処理", "使い方", "機能対照表", "パターン管理", "カテゴリ管理", "印鑑設定", "属性設定", "作成名設定", "商品DB", "シートレイアウト", "転送ルール"],
        index=0,
    )

    pages = {
        "処理": render_processing_page,
        "使い方": render_manual_page,
        "機能対照表": render_feature_matrix_page,
        "パターン管理": render_patterns_page,
        "カテゴリ管理": render_categories_page,
        "印鑑設定": render_seal_settings_page,
        "属性設定": render_attribute_settings_page,
        "作成名設定": render_name_settings_page,
        "商品DB": render_product_db_page,
        "シートレイアウト": render_sheet_layout_page,
        "転送ルール": render_transfer_rules_page,
    }
    pages[page]()


def render_manual_page():
    """使い方マニュアル"""
    st.header("使い方マニュアル")

    st.subheader("基本の流れ")
    st.markdown("""
```
CSVアップロード → 自動処理 → 結果確認 → ダウンロード
```

**1クリックで、受注CSVが作業指示書Excelになります。**
""")

    st.divider()
    st.subheader("STEP 1: CSVをアップロード")
    st.markdown("""
- サイドバーの「処理」ページを選択
- 「CSVアップロード」エリアにファイルをドラッグ＆ドロップ（複数同時OK）
- **対応フォーマット:**
  - 楽天分元データ.csv（楽天RMSエクスポート）
  - 楽天Amazon以外元データ.csv（Qoo10等のGoQエクスポート）
- Shift-JIS / UTF-8 どちらも自動判定
- 楽天 / 楽天Amazon以外もヘッダー名で自動判定
""")

    st.divider()
    st.subheader("STEP 2: 自動処理")
    st.markdown("""
アップロード後、以下の処理が自動で実行されます:

| 処理 | 内容 |
|------|------|
| カラム正規化 | 楽天/非楽天のカラム順の違いを統一 |
| クレンジング | 備考欄から136種の不要文字列を削除、改行記号を変換 |
| カテゴリ判定 | ひとことメモからジョインティ・ゴム・おなまえ等14カテゴリに振り分け |
| 商品コード照合 | SKUから製品カテゴリ（Normal/titan/swaro等）を自動判定 |
| 単品/複数判定 | 注文番号ごとに商品種類数を計算して振り分け |
| JP行/フロンティア行 | 配送区分を自動判定 |
| 印影確認判定 | キーワード検出→同一注文番号の全行に波及 |
| 注意事項抽出 | 旧字・備考から「注意事項」を生成 |
| 属性解析 | 商品名/選択肢から印材・サイズ・書体・文字の向きを抽出 |
| 書体変換 | 楷書体→泰楷書太 等のフォント名に変換 |
| 作成名抽出 | 正規表現で名前を抽出し、ひらがな/漢字/ローマ字を判別 |
| ジョインティチェック | 文字数×配置の整合性を警告 |
""")

    st.divider()
    st.subheader("STEP 3: 結果を確認")
    st.markdown("""
- **カテゴリ別件数**: 各カテゴリに何件振り分けられたかを一覧表示
- **データプレビュー**: カテゴリタブで絞り込んで中身を確認
- **警告表示**: ジョインティの整合性エラー等があれば赤字で表示
""")

    st.divider()
    st.subheader("STEP 4: ダウンロード")
    st.markdown("""
3種類のダウンロードが可能です:

| ボタン | 内容 |
|--------|------|
| **全件CSV** | 全データをBOM付きUTF-8のCSVで出力 |
| **カテゴリ別ZIP** | カテゴリごとのCSVをZIPにまとめて出力 |
| **Excel作業指示書** | カテゴリ×単品複数でシート分割されたExcelファイル |

**Excel作業指示書の特徴:**
- カテゴリごとにシートが分かれる（ジョインティ_単品、ジョインティ_複数 等）
- 100行ごとにPart分割（印刷用）
- Summaryシート（全シートの件数・数量を集計）
- バーコード生成（CODE39形式）
- フロンティア行は赤背景、個数2以上はピンク色
""")

    st.divider()
    st.subheader("設定の変更方法")

    writable = is_writable()
    if writable:
        st.success("このアプリは書き込み可能です。各設定ページから直接編集できます。")
    else:
        st.warning("Streamlit Cloud上のため読み取り専用です。設定変更はGitHub経由で行います。")

    st.markdown("""
| 設定ページ | できること |
|-----------|----------|
| **パターン管理** | クレンジング用の削除文字列を追加・編集・削除 |
| **カテゴリ管理** | カテゴリのキーワード追加・優先順位変更 |
| **印鑑設定** | 印影確認キーワード・旧字パターンの編集 |
| **属性設定** | 印材・サイズ・書体・文字の向きのキーワード編集 |
| **作成名設定** | 作成名抽出キーワード・停止キーワードの編集 |
| **商品DB** | 商品コード→カテゴリ対応表の閲覧・CSVアップロード登録 |
| **シートレイアウト** | Excel出力時のカテゴリ別カラム定義の編集 |
""")

    if not writable:
        st.subheader("GitHub経由での設定変更手順")
        st.markdown("""
1. [GitHubリポジトリ](https://github.com/cremadoro-tech/order-processor) を開く
2. `config/` フォルダ内の該当JSONファイルを選択
3. 鉛筆アイコン（Edit）をクリック
4. 内容を編集して「Commit changes」
5. 数分後にStreamlit Cloudが自動で再デプロイ

**主な設定ファイル:**
| ファイル | 内容 |
|---------|------|
| `cleansing_patterns.json` | 削除パターン136件 |
| `categories.json` | カテゴリキーワード |
| `product_db.json` | 楽天印鑑DB（11,386件） |
| `outsource_db.json` | 外注品DB（2,505件） |
| `amazon_db.json` | Amazon DB（297件） |
| `seal_settings.json` | 印影確認設定 |
| `attribute_settings.json` | 属性設定 |
| `name_settings.json` | 作成名設定 |
| `sheet_layouts.json` | Excelシートレイアウト |
""")

    st.divider()
    st.subheader("商品DBの更新方法")
    st.markdown("""
商品DBページからCSVアップロードで一括登録できます。

**CSVフォーマット（2列）:**
```
商品コード,カテゴリ
SKN-S6025,gomu
JOINTYJ9-10-PYE,jyoin
TS-105,normal
```

- 1列目: 商品コード（SKU）
- 2列目: 製品カテゴリ（normal/titan/swaro/houseki/houjin/naire/gomu/jyoin 等）
- 既存のコードは上書き、新規コードは追加
""")

    st.divider()
    st.subheader("トラブルシューティング")
    st.markdown("""
| 症状 | 原因 | 対処法 |
|------|------|--------|
| CSVが読み込めない | 文字コードが対応外 | Shift-JISまたはUTF-8で保存し直す |
| カテゴリが「その他」になる | ひとことメモにキーワードがない | カテゴリ管理でキーワードを追加 |
| 商品コードが照合されない | DBに未登録 | 商品DBページでCSVアップロード |
| Excelのシートが空 | シートレイアウトの列定義が未設定 | シートレイアウトページで設定 |
| 「読み取り専用モード」表示 | Streamlit Cloud上で実行中 | 正常。設定変更はGitHub経由で |
""")


def render_feature_matrix_page():
    """機能対照表ページ"""
    st.header("機能対照表: 元マクロ vs アプリ")
    st.caption("元のExcelマクロ4つの全機能と、このアプリでの対応状況")

    st.subheader("元のExcelマクロ（4ファイル）")
    st.markdown("""
| # | ファイル | 対象モール | 対象商品 |
|---|---------|----------|---------|
| 1 | 振り分け用テンプレート 新Ver3.xls | 楽天 | 印鑑 |
| 2 | Amazon印鑑テンプレート 新2.xlsm | Amazon | 印鑑 |
| 3 | 外注マクロテンプレートNEW.xlsm | 楽天 | おなまえ・ゴム印・ジョインティ |
| 4 | アシールamazonテンプレートNEW.xlsm | Amazon | アシール専用 |
""")

    st.divider()
    st.subheader("実装済み機能")
    implemented = [
        ("CSV読み込み（Shift-JIS/UTF-8）", "reader.py"),
        ("楽天/楽天Amazon以外の自動判定", "detect_platform()"),
        ("カラム正規化（列順の違い吸収）", "normalizer.py"),
        ("不要文字列削除（136パターン）", "cleanser.py"),
        ("改行記号変換（##/###/●●●/<br>）", "改行変換マップ"),
        ("連続改行・先頭末尾空白の除去", "cleanser.py"),
        ("商品コード照合（完全→前方→部分一致）", "product_lookup.py"),
        ("印影確認キーワード検出", "seal_checker.py"),
        ("印影確認の同一注文番号への波及", "_propagate_by_order()"),
        ("販売課判定", "seal_checker.py"),
        ("単品/複数/単品+判定（辞書方式）", "quantity_checker.py"),
        ("JP行/フロンティア行判定", "_check_delivery_type()"),
        ("ヤフー備考欄確認（「備考=」抽出）", "caution_extractor.py"),
        ("楽天旧字確認（「注意」生成）", "_extract_kyuji()"),
        ("印材判別（商品名→キーワードマッチ）", "attribute_parser.py"),
        ("サイズ判別（【xxmm】抽出）", "attribute_parser.py"),
        ("書体判別（作成内容→キーワード）", "attribute_parser.py"),
        ("文字の向き判別（タテ/ヨコ/フルネーム）", "attribute_parser.py"),
        ("書体変換（楷書体→泰楷書太 等6種）", "attribute_parser.py"),
        ("作成名抽出（正規表現）", "name_extractor.py"),
        ("ひらがな/漢字/ローマ字/カタカナ判別", "_detect_char_type()"),
        ("カテゴリ別シート振り分け", "excel_generator.py"),
        ("100行Part分割（印刷用）", "excel_generator.py"),
        ("Summaryシート（件数・数量集計）", "excel_generator.py"),
        ("バーコード生成（CODE39形式）", "excel_generator.py"),
        ("個数2以上にピンク色", "excel_generator.py"),
        ("フロンティア行に赤背景", "excel_generator.py"),
        ("ジョインティ文字数×配置チェック", "jointy_checker.py"),
        ("全設定のUI管理（8ページ）", "app.py"),
        ("商品DBのCSVアップロード登録", "app.py"),
        ("外注マクロ設定シート駆動（39商品×1,219ルール）", "transfer_engine.py"),
        ("消費型ロジック（ConsumedLineTracker）", "transfer_engine.py"),
        ("転送ルール管理UI + テスト実行パネル", "app.py"),
    ]

    df_impl = pd.DataFrame(implemented, columns=["機能", "実装箇所"])
    df_impl.index = range(1, len(df_impl) + 1)
    st.dataframe(df_impl, use_container_width=True, height=min(len(df_impl) * 35 + 40, 600))
    st.success(f"実装済み: {len(implemented)}機能")

    st.divider()
    st.subheader("未実装機能")
    not_implemented = [
        ("Amazon専用CSV処理", "高",
         "Amazon（GoQ）のCSVフォーマットが異なる。「23:59:59」以降の作成内容抽出等が必要"),
        ("外注マクロの「設定シート駆動」11パターン転送", "済",
         "39商品×1,219ルールをJSON化し、消費型ロジック（ConsumedLineTracker）を実装済み"),
        ("法人3本セット分割", "中",
         "1行→3シートに分割して統合する法人特有の処理"),
        ("PDF出力・印刷レイアウト", "中",
         "Amazon印鑑テンプレのフォントサイズ80-100pt、行高さ250等・改ページ挿入"),
        ("アシール正規表現抽出（高度版）", "中",
         "氏名印のフルネーム対応・先読み付きパターン（VBScript.RegExp相当）"),
        ("ジョインティのイラスト名プレフィックス付与", "低",
         "すまいるばん→「すまいる」、わんこばん→「わんこ」等の自動付与"),
        ("ジョインティの2行区切りフラグ", "低",
         "M列に赤字「2行区切り必要」表示"),
        ("ジョインティ配置番号の正規化", "低",
         "「配置16」含む長い文字列→「配置16」に統一"),
        ("文字の向き変換（印刷用表記）", "低",
         "タテ→「姓（タテ彫）」、ヨコ→「名（ヨコ彫）右から左」への変換"),
    ]

    df_not = pd.DataFrame(not_implemented, columns=["機能", "重要度", "備考"])
    df_not.index = range(1, len(df_not) + 1)

    # 重要度で色分け
    def highlight_priority(row):
        if row["重要度"] == "高":
            return ["background-color: #ffcccc"] * len(row)
        elif row["重要度"] == "中":
            return ["background-color: #fff3cd"] * len(row)
        return [""] * len(row)

    st.dataframe(
        df_not.style.apply(highlight_priority, axis=1),
        use_container_width=True,
        height=min(len(df_not) * 35 + 40, 400),
    )
    st.warning(f"未実装: {len(not_implemented)}機能（高: {sum(1 for x in not_implemented if x[1] == '高')}, 中: {sum(1 for x in not_implemented if x[1] == '中')}, 低: {sum(1 for x in not_implemented if x[1] == '低')}）")

    st.divider()
    st.subheader("準備物の不足リスト")
    missing = [
        ("Amazon（GoQ）のサンプルCSV", "高",
         "Amazon専用処理の実装・テストに必要",
         "GoQシステムからエクスポートして用意"),
        ("外注マクロの「設定シート」の中身", "高",
         "11パターン転送ルールの再現に必要",
         "外注マクロテンプレートNEW.xlsmの「設定」シートをCSVエクスポート"),
        ("データベースシート（商品コード→カテゴリ）", "中",
         "商品コード照合ヒット率を88.4%→100%に改善",
         "各マクロの「データベース」シートをCSVエクスポートして商品DBに登録"),
        ("法人3本セットの完成サンプル", "低",
         "法人分割ロジックの検証に必要",
         "法人3本分割1/2/3のサンプルExcel"),
    ]

    df_missing = pd.DataFrame(missing, columns=["不足物", "重要度", "用途", "対応方法"])
    df_missing.index = range(1, len(df_missing) + 1)

    st.dataframe(
        df_missing.style.apply(highlight_priority, axis=1),
        use_container_width=True,
    )

    st.divider()
    st.subheader("全体フロー図")
    st.markdown("""
```
【入口】
  楽天分元データ.csv          ← 楽天RMSからエクスポート
  楽天Amazon以外元データ.csv  ← Qoo10等のGoQエクスポート
  (Amazon GoQ CSV)            ← 未対応
            │
            ▼
【STEP 1: 読み込み・正規化】
  ファイル読み込み → 文字コード自動判定 → プラットフォーム判定 → カラム統一
            │
            ▼
【STEP 2: クレンジング】
  不要文字列136種削除 → 改行記号変換 → 連続改行圧縮 → 空白除去
            │
            ▼
【STEP 3: 分類・判定】
  カテゴリ判定（14種） → 商品コード照合 → 単品/複数判定
  → 印影確認判定 → 販売課判定 → JP行/フロンティア行
            │
            ▼
【STEP 4: 属性抽出】
  注意事項抽出 → 印材/サイズ/書体/向き解析 → 書体変換
  → 作成名抽出 → 文字種判別 → ジョインティ整合性チェック
            │
            ▼
【STEP 5: 出力】
  全件CSV / カテゴリ別ZIP / Excel作業指示書（カテゴリ×単品複数シート分割）
            │
            ▼
【出口】
  各外注先・製造担当へ配布
```
""")

    st.subheader("次のステップ（優先順位）")
    st.markdown("""
```
最優先: Amazon CSV対応 + AmazonサンプルCSVの準備
   ↓   これがないと全受注の半分が処理できない
次点:  設定シート駆動転送 + 設定シートの中身の準備
   ↓   外注品の精密な列配置に必要
その次: データベースシートのCSVエクスポート → 商品DB登録
   ↓   ヒット率88.4% → 95%+に改善
```
""")


def render_processing_page():
    """メイン処理ページ"""

    # CSV アップロード
    st.header("1. CSVアップロード")
    uploaded_files = st.file_uploader(
        "楽天分 / 楽天Amazon以外のCSVをアップロード",
        type=["csv"],
        accept_multiple_files=True,
        help="複数ファイル同時アップロード可。Shift-JIS / UTF-8 自動判定。",
    )

    if not uploaded_files:
        st.info("CSVファイルをドラッグ&ドロップ、またはクリックして選択してください。")
        return

    # ファイル情報表示
    for f in uploaded_files:
        st.write(f"- **{f.name}** ({f.size:,} bytes)")

    # 処理実行
    if st.button("処理を実行", type="primary", use_container_width=True):
        with st.spinner("処理中..."):
            df = process_files(uploaded_files)

        if df is not None:
            st.session_state["result_df"] = df

    # 結果表示
    if "result_df" in st.session_state:
        df = st.session_state["result_df"]
        render_results(df)


def process_files(uploaded_files) -> pd.DataFrame:
    """アップロードされたCSVを処理して統合DataFrameを返す。"""
    dfs = []
    progress = st.progress(0, text="CSV読み込み中...")
    total_steps = len(uploaded_files) + 5  # ファイル数 + 後処理5ステップ
    step = 0

    for i, file in enumerate(uploaded_files):
        raw_df = read_csv(file)
        platform = detect_platform(raw_df)
        st.write(f"✅ **{file.name}** → {_platform_label(platform)} ({len(raw_df):,}件)")
        norm_df = normalize(raw_df, platform)
        clean_df = cleanse(norm_df)
        dfs.append(clean_df)
        step += 1
        progress.progress(step / total_steps, text=f"CSV読み込み ({i+1}/{len(uploaded_files)})")

    if not dfs:
        return None

    merged = pd.concat(dfs, ignore_index=True)

    # Phase 1: カテゴリ・単品複数判定
    step += 1
    progress.progress(step / total_steps, text="カテゴリ判定...")
    result = classify_all(merged)

    # Phase 2: 商品コード照合 + 高度な複数判定 + JP行/フロンティア行
    step += 1
    progress.progress(step / total_steps, text="商品コード照合 + 複数判定...")
    result = check_quantity_advanced(result)

    # Phase 2: 印影確認判定
    step += 1
    progress.progress(step / total_steps, text="印影確認判定...")
    result = check_seal_confirmation(result)

    # Phase 2: 注意事項抽出 + 属性解析 + 作成名抽出
    step += 1
    progress.progress(step / total_steps, text="属性解析 + 作成名抽出...")
    result = extract_cautions(result)
    result = parse_attributes(result)
    result = extract_names(result)
    result = check_jointy(result)

    step += 1
    progress.progress(1.0, text="処理完了")

    st.success(f"処理完了: 合計 **{len(result):,}件**")
    return result


def render_results(df: pd.DataFrame):
    """処理結果の表示とダウンロード。"""

    # 統計サマリー
    st.header("2. 処理結果")

    categories = split_by_category(df)

    # カテゴリ別件数
    col1, col2 = st.columns([1, 2])
    with col1:
        st.subheader("カテゴリ別件数")
        summary_data = {cat: len(cat_df) for cat, cat_df in categories.items()}
        summary_df = pd.DataFrame(
            list(summary_data.items()), columns=["カテゴリ", "件数"]
        )
        st.dataframe(summary_df, use_container_width=True, hide_index=True)

    with col2:
        st.subheader("内訳")
        sub_col1, sub_col2 = st.columns(2)
        with sub_col1:
            st.write("**単品/複数**")
            if "単品複数" in df.columns:
                qty_summary = df["単品複数"].value_counts().reset_index()
                qty_summary.columns = ["種別", "件数"]
                st.dataframe(qty_summary, use_container_width=True, hide_index=True)
        with sub_col2:
            st.write("**特殊分類**")
            if "特殊分類" in df.columns:
                special = df[df["特殊分類"] != ""]["特殊分類"].value_counts().reset_index()
                special.columns = ["分類", "件数"]
                if len(special) > 0:
                    st.dataframe(special, use_container_width=True, hide_index=True)
                else:
                    st.write("なし")

        # 配送区分
        if "配送区分" in df.columns:
            delivery = df[df["配送区分"] != ""]["配送区分"].value_counts().reset_index()
            delivery.columns = ["配送区分", "件数"]
            if len(delivery) > 0:
                st.write("**配送区分**")
                st.dataframe(delivery, use_container_width=True, hide_index=True)

    # ダウンロード
    st.header("3. ダウンロード")

    # Excel作業指示書（メイン）
    st.subheader("作業指示書Excel")
    if st.button("📊 作業指示書を生成", type="primary", use_container_width=True):
        with st.spinner("Excel生成中..."):
            excel_bytes = generate_workbook(df)
            st.session_state["excel_bytes"] = excel_bytes
        st.success("生成完了")

    if "excel_bytes" in st.session_state:
        st.download_button(
            label="📥 作業指示書Excel（全カテゴリ・シート分割済み）",
            data=st.session_state["excel_bytes"],
            file_name=generate_filename("作業指示書", "xlsx"),
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True,
        )

    st.divider()

    # CSV
    st.subheader("CSV")
    dl_col1, dl_col2 = st.columns(2)

    with dl_col1:
        zip_bytes = to_zip_bytes(categories)
        st.download_button(
            label="📥 全カテゴリ一括（ZIP）",
            data=zip_bytes,
            file_name=generate_filename("全カテゴリ", "zip"),
            mime="application/zip",
            use_container_width=True,
        )

    with dl_col2:
        all_csv = to_csv_bytes(df)
        st.download_button(
            label="📥 全件CSV",
            data=all_csv,
            file_name=generate_filename("全件"),
            mime="text/csv",
            use_container_width=True,
        )

    # カテゴリ別タブ
    st.header("4. カテゴリ別データ")

    tab_names = list(categories.keys())
    if tab_names:
        tabs = st.tabs(tab_names)
        for tab, (cat, cat_df) in zip(tabs, categories.items()):
            with tab:
                st.write(f"**{cat}**: {len(cat_df):,}件")

                # 個別DL
                csv_bytes = to_csv_bytes(cat_df)
                st.download_button(
                    label=f"📥 {cat} をダウンロード",
                    data=csv_bytes,
                    file_name=generate_filename(cat),
                    mime="text/csv",
                    key=f"dl_{cat}",
                )

                # データプレビュー
                st.dataframe(cat_df, use_container_width=True, height=400)


def render_patterns_page():
    """クレンジングパターン管理ページ"""
    st.header("🔧 クレンジングパターン管理")
    st.caption("備考欄・項目選択肢から削除する文字列パターンを管理します。")

    patterns = get_remove_patterns()
    st.write(f"現在 **{len(patterns)}件** のパターンが登録されています。")

    # パターン追加
    st.subheader("パターンを追加")
    new_pattern = st.text_input("削除したい文字列を入力")
    if st.button("追加", type="primary") and new_pattern:
        add_pattern(new_pattern)
        st.success(f"追加しました: {new_pattern}")
        st.rerun()

    # 一括追加（テキストエリア）
    st.subheader("一括追加")
    bulk_text = st.text_area(
        "1行に1パターンずつ入力",
        height=150,
        placeholder="パターン1\nパターン2\nパターン3",
    )
    if st.button("一括追加") and bulk_text:
        new_items = [line.strip() for line in bulk_text.split("\n") if line.strip()]
        data = load_patterns()
        added = 0
        for item in new_items:
            if item not in data["remove_patterns"]:
                data["remove_patterns"].append(item)
                added += 1
        save_patterns(data)
        st.success(f"{added}件追加しました（重複{len(new_items) - added}件スキップ）")
        st.rerun()

    # パターン一覧（検索・編集・削除）
    st.subheader("登録済みパターン一覧")
    search = st.text_input("🔍 フィルター", placeholder="キーワードで絞り込み")

    filtered = [p for p in patterns if search.lower() in p.lower()] if search else patterns

    st.write(f"表示: {len(filtered)}件 / {len(patterns)}件")

    data = load_patterns()
    changed = False
    for i, pattern in enumerate(filtered):
        col1, col2, col3 = st.columns([7, 1, 1])
        with col1:
            edited = st.text_input(
                f"パターン{i+1}", value=pattern, key=f"pat_{i}", label_visibility="collapsed"
            )
            if edited != pattern:
                idx = data["remove_patterns"].index(pattern)
                data["remove_patterns"][idx] = edited
                changed = True
        with col2:
            if st.button("✅", key=f"save_{i}", help="保存"):
                save_patterns(data)
                st.success("保存しました")
                st.rerun()
        with col3:
            if st.button("🗑️", key=f"del_{i}", help="削除"):
                remove_pattern(pattern)
                st.rerun()

    if changed:
        st.info("変更があります。✅ボタンで保存してください。")


def render_categories_page():
    """カテゴリ振り分け管理ページ"""
    st.header("🏷️ カテゴリ振り分け管理")
    st.caption(
        "ひとことメモに含まれるキーワードでカテゴリを判定します。"
        "上にあるキーワードが優先されます（最初にマッチしたものを採用）。"
    )

    data = load_categories()
    keywords = data.get("keywords", [])

    st.write(f"現在 **{len(keywords)}件** のキーワードが登録されています。")

    # キーワード追加
    st.subheader("キーワードを追加")
    add_col1, add_col2 = st.columns(2)
    with add_col1:
        new_keyword = st.text_input("検索キーワード", placeholder="例: ジェットストリーム")
    with add_col2:
        # 既存カテゴリ名をサジェスト
        existing_cats = sorted(set(item["category"] for item in keywords))
        new_category = st.text_input(
            "分類先カテゴリ名",
            placeholder="例: ジェットストリーム",
            help=f"既存カテゴリ: {', '.join(existing_cats)}" if existing_cats else "",
        )
    if st.button("追加", type="primary", key="cat_add") and new_keyword and new_category:
        add_keyword(new_keyword, new_category)
        st.success(f"追加しました: 「{new_keyword}」→「{new_category}」")
        st.rerun()

    # デフォルトカテゴリ
    st.subheader("デフォルトカテゴリ")
    default_cat = st.text_input(
        "どのキーワードにもマッチしない場合のカテゴリ",
        value=data.get("default_category", "その他"),
    )
    if default_cat != data.get("default_category"):
        data["default_category"] = default_cat
        save_categories(data)
        st.success(f"デフォルトカテゴリを「{default_cat}」に変更しました")

    # キーワード一覧（編集・並び替え・削除）
    st.subheader("登録済みキーワード一覧（上が優先）")
    st.caption("「ひとことメモ」に検索キーワードが含まれていたら、その行を分類先カテゴリに振り分けます。")

    # ヘッダー行
    header_cols = st.columns([1, 3, 3, 1, 1, 1, 1])
    with header_cols[0]:
        st.markdown("**#**")
    with header_cols[1]:
        st.markdown("**検索キーワード**")
    with header_cols[2]:
        st.markdown("**→ 分類先カテゴリ**")
    with header_cols[3]:
        st.markdown("**保存**")
    with header_cols[4]:
        st.markdown("**↑**")
    with header_cols[5]:
        st.markdown("**↓**")
    with header_cols[6]:
        st.markdown("**削除**")

    cat_changed = False
    for i, item in enumerate(keywords):
        cols = st.columns([1, 3, 3, 1, 1, 1, 1])
        with cols[0]:
            st.write(f"**{i + 1}**")
        with cols[1]:
            edited_kw = st.text_input(
                f"キーワード{i+1}", value=item["keyword"],
                key=f"kw_{i}", label_visibility="collapsed",
            )
            if edited_kw != item["keyword"]:
                data["keywords"][i]["keyword"] = edited_kw
                cat_changed = True
        with cols[2]:
            edited_cat = st.text_input(
                f"カテゴリ{i+1}", value=item["category"],
                key=f"cat_{i}", label_visibility="collapsed",
            )
            if edited_cat != item["category"]:
                data["keywords"][i]["category"] = edited_cat
                cat_changed = True
        with cols[3]:
            if st.button("✅", key=f"cat_save_{i}", help="保存"):
                save_categories(data)
                st.success("保存しました")
                st.rerun()
        with cols[4]:
            if st.button("⬆️", key=f"up_{i}", disabled=(i == 0), help="優先度を上げる"):
                move_keyword(item["keyword"], "up")
                st.rerun()
        with cols[5]:
            if st.button("⬇️", key=f"down_{i}", disabled=(i == len(keywords) - 1), help="優先度を下げる"):
                move_keyword(item["keyword"], "down")
                st.rerun()
        with cols[6]:
            if st.button("🗑️", key=f"cat_del_{i}", help="削除"):
                remove_keyword(item["keyword"])
                st.rerun()

    if cat_changed:
        st.info("変更があります。✅ボタンで保存してください。")


def render_seal_settings_page():
    """印影確認設定ページ"""
    st.header("🔏 印影確認設定")
    st.caption("印影確認・販売課を判定するキーワードと旧字パターンを管理します。")

    data = load_json("seal_settings.json")

    # 各キーワードリストを編集
    for key, label in [
        ("inei_keywords_options", "印影確認キーワード（項目・選択肢）"),
        ("inei_keywords_remarks", "印影確認キーワード（備考欄）"),
        ("inei_keywords_design_remarks", "デザイン確認キーワード（備考欄）"),
    ]:
        st.subheader(label)
        items = data.get(key, [])
        _render_string_list_editor(data, key, items, f"seal_{key}")

    # 旧字パターン
    st.subheader("旧字×書体パターン（印影確認）")
    st.caption("備考欄にこの「旧字」が含まれ、かつ「書体」が一致する場合、印影確認が必要と判定します。")

    # ヘッダー行
    h_cols = st.columns([3, 3, 1, 1])
    with h_cols[0]:
        st.markdown("**旧字（文字）**")
    with h_cols[1]:
        st.markdown("**書体（一致条件）**")
    with h_cols[2]:
        st.markdown("**保存**")
    with h_cols[3]:
        st.markdown("**削除**")

    patterns = data.get("kyuji_inei_patterns", [])
    for i, p in enumerate(patterns):
        cols = st.columns([3, 3, 1, 1])
        with cols[0]:
            new_char = st.text_input(f"文字{i}", value=p["char"], key=f"kyuji_c_{i}", label_visibility="collapsed")
            if new_char != p["char"]:
                data["kyuji_inei_patterns"][i]["char"] = new_char
        with cols[1]:
            new_style = st.text_input(f"書体{i}", value=p["style"], key=f"kyuji_s_{i}", label_visibility="collapsed")
            if new_style != p["style"]:
                data["kyuji_inei_patterns"][i]["style"] = new_style
        with cols[2]:
            if st.button("✅", key=f"kyuji_save_{i}"):
                save_json("seal_settings.json", data)
                st.success("保存")
                st.rerun()
        with cols[3]:
            if st.button("🗑️", key=f"kyuji_del_{i}"):
                data["kyuji_inei_patterns"].pop(i)
                save_json("seal_settings.json", data)
                st.rerun()

    kc1, kc2 = st.columns(2)
    with kc1:
        new_c = st.text_input("新しい文字", key="new_kyuji_c", placeholder="例: 淵")
    with kc2:
        new_s = st.text_input("新しい書体", key="new_kyuji_s", placeholder="例: 行書")
    if st.button("旧字パターン追加", key="add_kyuji") and new_c and new_s:
        data.setdefault("kyuji_inei_patterns", []).append({"char": new_c, "style": new_s})
        save_json("seal_settings.json", data)
        st.rerun()


def render_attribute_settings_page():
    """属性設定ページ（印材・サイズ・書体・文字の向き）"""
    st.header("⚙️ 属性設定")
    st.caption("印材・サイズ・書体・文字の向きの検出キーワードと変換テーブルを管理します。")

    data = load_json("attribute_settings.json")

    # 印材キーワード
    for key, label in [
        ("material_keywords", "印材キーワード（商品名から検出、優先順位順）"),
        ("material_suffix_keywords", "印材サフィックス（選択肢から付加）"),
        ("material_product_suffix", "印材サフィックス（商品名から付加）"),
    ]:
        with st.expander(label, expanded=(key == "material_keywords")):
            _render_kv_list_editor(data, key, f"attr_{key}")

    # サイズ
    with st.expander("サイズパターン (mm)"):
        sizes = data.get("size_patterns", [])
        _render_string_list_editor(data, "size_patterns", sizes, "size")

    # 書体キーワード
    with st.expander("書体キーワード"):
        _render_kv_list_editor(data, "font_keywords", "font_kw")

    # 書体変換テーブル
    with st.expander("書体変換テーブル（日本語名→フォント名）"):
        conv = data.get("font_conversion", {})
        changed = False
        for i, (k, v) in enumerate(list(conv.items())):
            cols = st.columns([3, 3, 1, 1])
            with cols[0]:
                nk = st.text_input(f"元{i}", value=k, key=f"fc_k_{i}", label_visibility="collapsed")
            with cols[1]:
                nv = st.text_input(f"先{i}", value=v, key=f"fc_v_{i}", label_visibility="collapsed")
            with cols[2]:
                if st.button("✅", key=f"fc_save_{i}"):
                    if nk != k:
                        del data["font_conversion"][k]
                    data["font_conversion"][nk] = nv
                    save_json("attribute_settings.json", data)
                    st.success("保存")
                    st.rerun()
            with cols[3]:
                if st.button("🗑️", key=f"fc_del_{i}"):
                    del data["font_conversion"][k]
                    save_json("attribute_settings.json", data)
                    st.rerun()

        fc1, fc2 = st.columns(2)
        with fc1:
            new_fk = st.text_input("新しい書体名", key="new_fc_k")
        with fc2:
            new_fv = st.text_input("新しいフォント名", key="new_fc_v")
        if st.button("書体変換追加", key="add_fc") and new_fk and new_fv:
            data["font_conversion"][new_fk] = new_fv
            save_json("attribute_settings.json", data)
            st.rerun()

    # 文字の向き
    with st.expander("文字の向きキーワード"):
        _render_kv_list_editor(data, "direction_keywords", "dir_kw")

    # 文字の向き変換
    with st.expander("文字の向き変換テーブル"):
        dconv = data.get("direction_conversion", {})
        for i, (k, v) in enumerate(list(dconv.items())):
            cols = st.columns([3, 3, 1, 1])
            with cols[0]:
                nk = st.text_input(f"元{i}", value=k, key=f"dc_k_{i}", label_visibility="collapsed")
            with cols[1]:
                nv = st.text_input(f"先{i}", value=v, key=f"dc_v_{i}", label_visibility="collapsed")
            with cols[2]:
                if st.button("✅", key=f"dc_save_{i}"):
                    if nk != k:
                        del data["direction_conversion"][k]
                    data["direction_conversion"][nk] = nv
                    save_json("attribute_settings.json", data)
                    st.success("保存")
                    st.rerun()
            with cols[3]:
                if st.button("🗑️", key=f"dc_del_{i}"):
                    del data["direction_conversion"][k]
                    save_json("attribute_settings.json", data)
                    st.rerun()

        dc1, dc2 = st.columns(2)
        with dc1:
            new_dk = st.text_input("新しい向き名", key="new_dc_k")
        with dc2:
            new_dv = st.text_input("新しい変換先", key="new_dc_v")
        if st.button("向き変換追加", key="add_dc") and new_dk and new_dv:
            data["direction_conversion"][new_dk] = new_dv
            save_json("attribute_settings.json", data)
            st.rerun()


def render_name_settings_page():
    """作成名設定ページ"""
    st.header("✏️ 作成名抽出設定")
    st.caption("作成名を検出するキーワードと、抽出を停止するキーワードを管理します。")

    data = load_json("name_settings.json")

    st.subheader("作成名検出キーワード")
    st.caption("備考欄・選択肢でこのキーワードの後に続く文字列を作成名として抽出します。")
    _render_string_list_editor(data, "name_keywords", data.get("name_keywords", []), "name_kw")

    st.subheader("停止キーワード")
    st.caption("作成名抽出中にこのキーワードが出現したら抽出を停止します。")
    _render_string_list_editor(data, "name_stop_keywords", data.get("name_stop_keywords", []), "name_stop")


def render_product_db_page():
    """商品DB管理ページ"""
    st.header("📦 商品コードDB管理")

    stats = get_all_db_stats()
    stat_cols = st.columns(len(stats))
    for col, (label, count) in zip(stat_cols, stats.items()):
        col.metric(label, f"{count:,}件")

    st.divider()

    # DB選択
    db_choice = st.selectbox("編集するDB", ["楽天印鑑 (product_db)", "外注 (outsource_db)", "Amazon (amazon_db)"])
    db_files = {
        "楽天印鑑 (product_db)": "product_db.json",
        "外注 (outsource_db)": "outsource_db.json",
        "Amazon (amazon_db)": "amazon_db.json",
    }
    db_file = db_files[db_choice]
    db = load_json(db_file)

    # --- CSVアップロードで一括登録 ---
    st.subheader("CSVで一括登録")
    st.caption("1列目: 商品コード/SKU、2列目: カテゴリ のCSVをアップロード（ヘッダー有無どちらもOK）")

    csv_file = st.file_uploader("CSVをアップロード", type=["csv"], key="db_csv_upload")
    if csv_file:
        from processor.reader import read_csv as _read_csv
        try:
            csv_df = _read_csv(csv_file)
            # 2列以上あることを確認
            if len(csv_df.columns) < 2:
                st.error("2列以上のCSVが必要です（1列目: SKU、2列目: カテゴリ）")
            else:
                sku_col = csv_df.columns[0]
                cat_col = csv_df.columns[1]
                csv_df = csv_df[[sku_col, cat_col]].dropna()
                csv_df = csv_df[csv_df[sku_col].str.strip() != ""]
                csv_df = csv_df[csv_df[cat_col].str.strip() != ""]

                st.write(f"読み込み: **{len(csv_df)}件**")
                st.dataframe(csv_df.head(10), use_container_width=True, hide_index=True)

                # 既存との重複チェック
                new_count = sum(1 for _, row in csv_df.iterrows() if str(row[sku_col]).strip() not in db)
                dup_count = len(csv_df) - new_count

                st.write(f"新規: **{new_count}件** / 上書き: **{dup_count}件**")

                col_add, col_new = st.columns(2)
                with col_add:
                    if st.button("全件登録（上書き含む）", type="primary", key="db_csv_all"):
                        for _, row in csv_df.iterrows():
                            db[str(row[sku_col]).strip()] = str(row[cat_col]).strip()
                        save_json(db_file, db)
                        st.success(f"{len(csv_df)}件登録しました")
                        st.rerun()
                with col_new:
                    if st.button("新規のみ登録（既存はスキップ）", key="db_csv_new"):
                        added = 0
                        for _, row in csv_df.iterrows():
                            s = str(row[sku_col]).strip()
                            if s not in db:
                                db[s] = str(row[cat_col]).strip()
                                added += 1
                        save_json(db_file, db)
                        st.success(f"{added}件追加しました（{dup_count}件スキップ）")
                        st.rerun()
        except Exception as e:
            st.error(f"CSV読み込みエラー: {e}")

    st.divider()

    # --- 手動追加 ---
    st.subheader("手動で追加")
    ac1, ac2 = st.columns(2)
    with ac1:
        new_sku = st.text_input("商品コード/SKU", key="new_db_sku")
    with ac2:
        new_cat = st.text_input("カテゴリ", key="new_db_cat")
    if st.button("追加", type="primary", key="db_add") and new_sku and new_cat:
        db[new_sku] = new_cat
        save_json(db_file, db)
        st.success(f"追加: {new_sku} → {new_cat}")
        st.rerun()

    st.divider()

    # --- 検索 + 全件表示 ---
    st.subheader("登録データ")
    search = st.text_input("🔍 SKU/カテゴリで検索", key="db_search")

    if search:
        filtered = {k: v for k, v in db.items() if search.lower() in k.lower() or search.lower() in v.lower()}
    else:
        filtered = db

    st.write(f"**{len(filtered):,}件** 表示中（全{len(db):,}件）")

    # DataFrameで一覧表示（高速・全件表示可能）
    if filtered:
        display_df = pd.DataFrame(
            list(filtered.items()), columns=["商品コード/SKU", "カテゴリ"]
        )
        st.dataframe(
            display_df,
            use_container_width=True,
            height=500,
            hide_index=True,
        )

        # CSV一括ダウンロード
        csv_dl = to_csv_bytes(display_df)
        st.download_button(
            label=f"📥 表示中の{len(filtered):,}件をCSVダウンロード",
            data=csv_dl,
            file_name=generate_filename(f"商品DB_{db_choice.split('(')[0].strip()}"),
            mime="text/csv",
            key="db_csv_dl",
        )

    # --- 個別編集（検索結果が少ない場合のみ表示） ---
    if search and 0 < len(filtered) <= 50:
        st.subheader("個別編集")
        for i, (sku, cat) in enumerate(filtered.items()):
            cols = st.columns([4, 3, 1, 1])
            with cols[0]:
                new_s = st.text_input(f"SKU{i}", value=sku, key=f"db_s_{i}", label_visibility="collapsed")
            with cols[1]:
                new_c = st.text_input(f"CAT{i}", value=cat, key=f"db_c_{i}", label_visibility="collapsed")
            with cols[2]:
                if st.button("✅", key=f"db_save_{i}"):
                    if new_s != sku:
                        del db[sku]
                    db[new_s] = new_c
                    save_json(db_file, db)
                    st.success("保存")
                    st.rerun()
            with cols[3]:
                if st.button("🗑️", key=f"db_del_{i}"):
                    del db[sku]
                    save_json(db_file, db)
                    st.rerun()


def render_sheet_layout_page():
    """シートレイアウト管理ページ"""
    st.header("📋 シートレイアウト設定")
    st.caption("カテゴリごとのExcel出力シートのカラム構成を管理します。")

    data = load_json("sheet_layouts.json")
    layouts = data.get("layouts", {})

    # 共通設定
    st.subheader("共通設定")
    sc1, sc2 = st.columns(2)
    with sc1:
        max_rows = st.number_input("シートあたり最大行数", value=data.get("max_rows_per_sheet", 100), min_value=10, step=10)
        if max_rows != data.get("max_rows_per_sheet"):
            data["max_rows_per_sheet"] = max_rows
            save_json("sheet_layouts.json", data)
    with sc2:
        bp = st.text_input("バーコードプレフィックス", value=data.get("barcode_prefix", "*"))
        bs = st.text_input("バーコードサフィックス", value=data.get("barcode_suffix", "*"))
        if bp != data.get("barcode_prefix") or bs != data.get("barcode_suffix"):
            data["barcode_prefix"] = bp
            data["barcode_suffix"] = bs
            save_json("sheet_layouts.json", data)

    st.divider()

    # カテゴリ別レイアウト
    layout_names = [k for k in layouts.keys() if k != "_comment"]
    selected = st.selectbox("編集するレイアウト", layout_names)

    if selected:
        layout = layouts[selected]
        columns = layout.get("columns", [])

        st.subheader(f"「{selected}」のカラム構成（{len(columns)}列）")

        # カラム一覧を表形式で表示・編集
        for i, col in enumerate(columns):
            cols = st.columns([2, 3, 2, 1, 1])
            with cols[0]:
                new_h = st.text_input(f"ヘッダー{i}", value=col.get("header", ""), key=f"sh_{selected}_{i}", label_visibility="collapsed")
                if new_h != col.get("header"):
                    data["layouts"][selected]["columns"][i]["header"] = new_h
            with cols[1]:
                new_src = st.text_input(f"ソース{i}", value=col.get("source", ""), key=f"ss_{selected}_{i}", label_visibility="collapsed")
                if new_src != col.get("source"):
                    data["layouts"][selected]["columns"][i]["source"] = new_src
            with cols[2]:
                ext = col.get("extract", "")
                new_ext = st.text_input(f"抽出{i}", value=ext, key=f"se_{selected}_{i}", label_visibility="collapsed", placeholder="(抽出方法)")
                if new_ext != ext:
                    if new_ext:
                        data["layouts"][selected]["columns"][i]["extract"] = new_ext
                    elif "extract" in data["layouts"][selected]["columns"][i]:
                        del data["layouts"][selected]["columns"][i]["extract"]
            with cols[3]:
                if st.button("✅", key=f"sl_save_{selected}_{i}"):
                    save_json("sheet_layouts.json", data)
                    st.success("保存")
                    st.rerun()
            with cols[4]:
                if st.button("🗑️", key=f"sl_del_{selected}_{i}"):
                    data["layouts"][selected]["columns"].pop(i)
                    save_json("sheet_layouts.json", data)
                    st.rerun()

        # カラム追加
        st.write("---")
        ac1, ac2, ac3 = st.columns(3)
        with ac1:
            new_header = st.text_input("新しいヘッダー名", key=f"new_h_{selected}")
        with ac2:
            new_source = st.text_input("ソース列名", key=f"new_s_{selected}", help="元データの列名 or _row_number")
        with ac3:
            new_extract = st.text_input("抽出方法（任意）", key=f"new_e_{selected}", placeholder="size_mm, body_color等")
        if st.button("カラム追加", key=f"add_col_{selected}") and new_header and new_source:
            new_col = {"header": new_header, "source": new_source}
            if new_extract:
                new_col["extract"] = new_extract
            data["layouts"][selected]["columns"].append(new_col)
            save_json("sheet_layouts.json", data)
            st.rerun()

    # 新しいレイアウト追加
    st.divider()
    st.subheader("新しいレイアウトを追加")
    new_layout_name = st.text_input("カテゴリ名（カテゴリ管理のカテゴリ名と一致させる）", key="new_layout_name")
    if st.button("レイアウト追加", key="add_layout") and new_layout_name:
        if new_layout_name not in layouts:
            # デフォルトレイアウトをコピー
            data["layouts"][new_layout_name] = {
                "sheet_prefix": new_layout_name,
                "columns": list(layouts.get("_default", {}).get("columns", []))
            }
            save_json("sheet_layouts.json", data)
            st.success(f"「{new_layout_name}」を追加しました（デフォルトカラムをコピー）")
            st.rerun()


def render_transfer_rules_page():
    """外注マクロ転送ルール管理ページ"""
    st.header("転送ルール管理")
    st.caption("外注マクロテンプレートNEWの設定シート（39商品×1,219ルール）")

    rules = load_transfer_rules()
    if not rules:
        st.warning("transfer_rules.jsonが見つかりません")
        return

    # 統計
    total_rules = sum(len(d.get("columns", [])) for d in rules.values())
    st.info(f"**{len(rules)}商品** / **{total_rules}ルール** 定義済み")

    # 商品カテゴリ選択
    sheet_names = list(rules.keys())
    selected = st.selectbox(
        "商品カテゴリ",
        sheet_names,
        format_func=lambda x: f"{x} ({len(rules[x].get('columns', []))}ルール)",
    )

    if selected:
        columns = rules[selected].get("columns", [])
        headers = get_headers_for_sheet(selected)

        st.subheader(f"{selected} — {len(columns)}ルール / {len(headers)}列")
        st.write(f"**出力ヘッダー:** {' → '.join(headers)}")

        # ルール一覧テーブル
        METHOD_LABELS = {1: "連番", 2: "固定文字", 3: "原本から転送", 4: "数式"}
        TRANSFER_LABELS = {
            1: "そのまま", 2: "変換", 3: "右側", 4: "分割N番目",
            10: "不要行除去", 11: "不要行除去", 12: "新行に転送",
            20: "残り行", 21: "字種判別", 22: "行番号指定",
        }

        table_data = []
        for r in columns:
            table_data.append({
                "列": r.get("output_col", ""),
                "ヘッダー": r.get("header", ""),
                "方法": METHOD_LABELS.get(r.get("method"), str(r.get("method", ""))),
                "転送": TRANSFER_LABELS.get(r.get("transfer"), str(r.get("transfer", ""))),
                "ソース列": r.get("source_col", ""),
                "検索KW": ", ".join(r.get("search_keywords", []))[:50],
                "変換/固定": str(r.get("transform_value", r.get("fixed_value", "")))[:30],
            })

        st.dataframe(
            pd.DataFrame(table_data),
            use_container_width=True,
            height=min(len(table_data) * 35 + 40, 500),
        )

        # テスト実行パネル
        st.divider()
        st.subheader("テスト実行")
        st.caption("「項目・選択肢」のサンプルテキストを入力して、各ルールの適用結果を確認")

        test_text = st.text_area(
            "テスト用「項目・選択肢」テキスト",
            height=150,
            placeholder="ボディカラー=ピンク\n書体=楷書体\nイラスト=ハート\n【選択必須】:了承した。\n田中太郎",
        )

        if st.button("テスト実行", key="transfer_test") and test_text:
            test_row = pd.Series({
                "商品コード": "test", "商品コード2": "test",
                "商品SKU": "test", "商品名": "テスト商品",
                "項目・選択肢": test_text,
                "個数": "1", "備考": "",
                "GoQ管理番号": "0000-001",
                "注文者氏名": "テスト太郎",
                "ひとことメモ": selected,
            })

            # ルール適用
            result = apply_transfer_rules(test_row, selected, row_number=1)

            # 結果表示
            st.subheader("適用結果")
            result_data = []
            for h in headers:
                v = result.get(h, "")
                result_data.append({"列": h, "値": v})
            st.dataframe(pd.DataFrame(result_data), use_container_width=True)

            # 消費プロセスの可視化
            st.subheader("消費プロセス")
            tracker = ConsumedLineTracker(test_text)
            step_data = []
            for rule in columns:
                header = rule.get("header", "")
                method = rule.get("method")
                transfer = rule.get("transfer")
                before = len(tracker.get_remaining_lines())
                value = _dispatch_rule(rule, test_row, tracker, 1)
                after = len(tracker.get_remaining_lines())
                consumed = before - after
                if value or consumed > 0:
                    step_data.append({
                        "列": header,
                        "方法": f"{method}×{transfer}" if transfer else str(method),
                        "結果": str(value)[:50] if value else "(空)",
                        "消費行数": consumed,
                        "残り行数": after,
                    })

            st.dataframe(pd.DataFrame(step_data), use_container_width=True)

            remaining = tracker.get_remaining_lines()
            if remaining:
                st.write(f"**最終残り行** ({len(remaining)}行):")
                for line in remaining:
                    st.code(line)
            else:
                st.success("全行が処理されました")


# === 共通UIコンポーネント ===

def _render_string_list_editor(data: dict, key: str, items: list, prefix: str):
    """文字列リストの編集UI（追加・編集・削除）"""
    settings_file = _guess_settings_file(key)

    for i, item in enumerate(items):
        cols = st.columns([7, 1, 1])
        with cols[0]:
            edited = st.text_input(f"{prefix}_{i}", value=item, key=f"{prefix}_{i}", label_visibility="collapsed")
            if edited != item:
                data[key][i] = edited
        with cols[1]:
            if st.button("✅", key=f"{prefix}_save_{i}"):
                save_json(settings_file, data)
                st.success("保存")
                st.rerun()
        with cols[2]:
            if st.button("🗑️", key=f"{prefix}_del_{i}"):
                data[key].pop(i)
                save_json(settings_file, data)
                st.rerun()

    new_val = st.text_input(f"新規追加", key=f"{prefix}_new", placeholder="追加する値を入力")
    if st.button("追加", key=f"{prefix}_add") and new_val:
        data.setdefault(key, []).append(new_val)
        save_json(settings_file, data)
        st.rerun()


def _render_kv_list_editor(data: dict, key: str, prefix: str):
    """keyword/valueペアリストの編集UI"""
    settings_file = _guess_settings_file(key)
    items = data.get(key, [])

    for i, item in enumerate(items):
        cols = st.columns([3, 3, 1, 1])
        with cols[0]:
            nk = st.text_input(f"KW{i}", value=item["keyword"], key=f"{prefix}_k_{i}", label_visibility="collapsed")
            if nk != item["keyword"]:
                data[key][i]["keyword"] = nk
        with cols[1]:
            nv = st.text_input(f"VAL{i}", value=item["value"], key=f"{prefix}_v_{i}", label_visibility="collapsed")
            if nv != item["value"]:
                data[key][i]["value"] = nv
        with cols[2]:
            if st.button("✅", key=f"{prefix}_save_{i}"):
                save_json(settings_file, data)
                st.success("保存")
                st.rerun()
        with cols[3]:
            if st.button("🗑️", key=f"{prefix}_del_{i}"):
                data[key].pop(i)
                save_json(settings_file, data)
                st.rerun()

    kc1, kc2 = st.columns(2)
    with kc1:
        new_k = st.text_input("キーワード", key=f"{prefix}_new_k", placeholder="検索キーワード")
    with kc2:
        new_v = st.text_input("値", key=f"{prefix}_new_v", placeholder="設定値")
    if st.button("追加", key=f"{prefix}_add") and new_k and new_v:
        data.setdefault(key, []).append({"keyword": new_k, "value": new_v})
        save_json(settings_file, data)
        st.rerun()


def _guess_settings_file(key: str) -> str:
    """キー名から設定ファイル名を推測"""
    if key in ("inei_keywords_options", "inei_keywords_remarks", "inei_keywords_design_remarks", "kyuji_inei_patterns"):
        return "seal_settings.json"
    if key in ("name_keywords", "name_stop_keywords"):
        return "name_settings.json"
    return "attribute_settings.json"


def _platform_label(platform: str) -> str:
    labels = {
        "rakuten": "楽天分",
        "non_rakuten": "楽天Amazon以外",
        "unknown": "不明",
    }
    return labels.get(platform, platform)


def check_password() -> bool:
    """パスワード認証。st.secretsにpasswordが設定されている場合のみ有効。"""
    try:
        correct_pw = st.secrets["password"]
    except (KeyError, FileNotFoundError):
        return True  # secrets未設定ならスキップ（ローカル開発時）

    if "authenticated" in st.session_state and st.session_state["authenticated"]:
        return True

    pw = st.text_input("パスワードを入力", type="password")
    if pw == correct_pw:
        st.session_state["authenticated"] = True
        st.rerun()
    elif pw:
        st.error("パスワードが違います")
    return False


if __name__ == "__main__":
    if check_password():
        main()
