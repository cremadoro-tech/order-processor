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
from config.settings_io import load_json, save_json

st.set_page_config(
    page_title="受注処理システム",
    page_icon="📦",
    layout="wide",
)


def main():
    st.title("📦 受注処理システム")
    st.caption("CSVアップロード → クレンジング → カテゴリ別振り分け → ダウンロード")

    # サイドバー: ページ切り替え
    page = st.sidebar.radio(
        "ページ",
        ["処理", "パターン管理", "カテゴリ管理", "印鑑設定", "属性設定", "作成名設定", "商品DB", "シートレイアウト"],
        index=0,
    )

    pages = {
        "処理": render_processing_page,
        "パターン管理": render_patterns_page,
        "カテゴリ管理": render_categories_page,
        "印鑑設定": render_seal_settings_page,
        "属性設定": render_attribute_settings_page,
        "作成名設定": render_name_settings_page,
        "商品DB": render_product_db_page,
        "シートレイアウト": render_sheet_layout_page,
    }
    pages[page]()


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


if __name__ == "__main__":
    main()
