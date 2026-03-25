"""Excel作業指示書生成エンジン

カテゴリ別にシートを作成し、レイアウト定義に従ってデータを配置。
100行ごとにPartを分割。Summaryシートで全シートの数量を集計。
"""

import io
import re
import math
from datetime import datetime

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

from config.settings_io import load_json
from processor.transfer_engine import (
    has_transfer_rules, apply_transfer_rules, get_headers_for_sheet
)
from processor.houjin3_splitter import split_houjin3
from processor.amazon_extractor import extract_amazon_attributes, _shorten_product_name, expand_multi_name_rows

LAYOUTS_FILE = "sheet_layouts.json"

# スタイル定義
HEADER_FONT = Font(name="游ゴシック", size=11, bold=True)
HEADER_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
HEADER_FONT_WHITE = Font(name="游ゴシック", size=11, bold=True, color="FFFFFF")
DATA_FONT = Font(name="游ゴシック", size=10)
BARCODE_FONT = Font(name="游ゴシック", size=10)
FRONTIER_FILL = PatternFill(start_color="FF6666", end_color="FF6666", fill_type="solid")
PINK_FILL = PatternFill(start_color="FFB6C1", end_color="FFB6C1", fill_type="solid")
THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)


def _resolve_sheet_name(row):
    """元マクロと同じロジックで出力シート名を決定する。

    優先順位:
    1. 特殊分類（印影確認・販売課）が設定されていればそれを使う
    2. 製品カテゴリ → sheet_mapping.json で日本語シート名に変換
    3. マッチしなければ「未分類」
    """
    mapping = load_json("sheet_mapping.json")
    special = mapping.get("特殊分類（最優先）", {})
    hanko = mapping.get("印鑑系（product_db）", {})
    outsource = mapping.get("外注系（outsource_db）", {})
    default_name = mapping.get("デフォルト", "未分類")

    # 1. 特殊分類チェック
    special_class = str(row.get("特殊分類", "")).strip()
    if special_class and special_class in special:
        return special[special_class]

    # 2. 製品カテゴリからマッピング
    product_cat = str(row.get("製品カテゴリ", "")).strip()
    if product_cat:
        # 印鑑系
        if product_cat in hanko:
            return hanko[product_cat]
        # 外注系
        if product_cat in outsource:
            return outsource[product_cat]

    return default_name


def generate_workbook(df: pd.DataFrame) -> bytes:
    """処理済みDataFrameからExcel作業指示書を生成してバイト列で返す。

    元マクロと同じシート振り分け: 製品カテゴリ → 日本語シート名 × 単品/複数
    """
    settings = load_json(LAYOUTS_FILE)
    layouts = settings.get("layouts", {})
    max_rows = settings.get("max_rows_per_sheet", 100)
    barcode_pre = settings.get("barcode_prefix", "*")
    barcode_suf = settings.get("barcode_suffix", "*")

    wb = Workbook()
    wb.remove(wb.active)

    summary_data = []

    # 各行に出力シート名を付与
    df = df.copy()
    df["_出力シート"] = df.apply(_resolve_sheet_name, axis=1)

    # Amazon専用レイアウト
    amazon_layouts = settings.get("amazon_layouts", {})
    amazon_sheet_names = amazon_layouts.get("amazon_sheet_names", {})

    # シート名別に処理
    for sheet_base, group in df.groupby("_出力シート", sort=False):
        # Amazon/楽天混在の場合はソースで分離
        has_amazon = (group.get("ソース") == "amazon").any() if "ソース" in group.columns else False
        has_rakuten = (group.get("ソース") != "amazon").any() if "ソース" in group.columns else True

        # 楽天データ
        if has_rakuten:
            rakuten_group = group[group.get("ソース", "") != "amazon"] if has_amazon else group
            layout = layouts.get(sheet_base, layouts.get("_default", {}))
            if "単品複数" in rakuten_group.columns:
                for qty_type, sub_group in rakuten_group.groupby("単品複数", sort=False):
                    sub_group = sub_group.reset_index(drop=True)
                    sheet_name = f"{sheet_base}_{qty_type}"
                    _write_sheet(wb, sheet_name, sub_group, layout, max_rows, barcode_pre, barcode_suf, summary_data)
            else:
                rakuten_group = rakuten_group.reset_index(drop=True)
                _write_sheet(wb, sheet_base, rakuten_group, layout, max_rows, barcode_pre, barcode_suf, summary_data)

        # Amazonデータ（専用レイアウト・シート名 + 複数名行展開）
        if has_amazon:
            amazon_group = group[group.get("ソース") == "amazon"]

            # 複数名入れの行展開（同一管理番号は1回だけ展開）
            expanded_rows = []
            expanded_goqs = set()  # 展開済み管理番号
            for _, row in amazon_group.iterrows():
                goq = str(row.get("GoQ管理番号", ""))
                opts = str(row.get("項目・選択肢", ""))
                result_rows = expand_multi_name_rows(row)
                if len(result_rows) > 1:
                    # 複数行に展開される場合、同一管理番号は最初の1回だけ
                    if goq and goq in expanded_goqs:
                        continue  # この管理番号は既に展開済み→スキップ
                    expanded_goqs.add(goq)
                expanded_rows.extend(result_rows)
            amazon_group = pd.DataFrame(expanded_rows).fillna("").reset_index(drop=True)

            amazon_sheet = amazon_sheet_names.get(sheet_base, sheet_base)
            amazon_layout = amazon_layouts.get(sheet_base, amazon_layouts.get("_default", {}))

            # Amazonは配送区分でシート分割（単品=AmazonJP, 単品＋=フロンティア+, 複数=フロンティア）
            amazon_group["_amazon_split"] = amazon_group.apply(_amazon_split_key, axis=1)
            for split_key, sub_group in amazon_group.groupby("_amazon_split", sort=False):
                sub_group = sub_group.reset_index(drop=True)
                sheet_name = f"{amazon_sheet}{split_key}"
                _write_sheet(wb, sheet_name, sub_group, amazon_layout, max_rows, barcode_pre, barcode_suf, summary_data)

    # Summaryシートを先頭に追加
    _write_summary(wb, summary_data)

    # バイト列に変換
    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


def _write_sheet(
    wb: Workbook,
    base_name: str,
    df: pd.DataFrame,
    layout: dict,
    max_rows: int,
    barcode_pre: str,
    barcode_suf: str,
    summary_data: list,
):
    """DataFrameをシートに書き込む。max_rows超過時はPart分割。"""
    # カテゴリ名を抽出（"ジョインティ_単品" → "ジョインティ"）
    category_name = base_name.rsplit("_", 1)[0] if "_" in base_name else base_name

    # 法人3本セット分割: 1行→3行に展開
    is_houjin3 = layout.get("houjin3_split", False)
    if is_houjin3:
        expanded_rows = []
        for _, row in df.iterrows():
            expanded_rows.extend(split_houjin3(row))
        if expanded_rows:
            df = pd.DataFrame(expanded_rows)
        else:
            return

    # 転送ルールが存在するカテゴリか判定
    # Amazon専用レイアウト（amazon_source付き）の場合は転送エンジンを使わない
    has_amazon_layout = any("amazon_source" in col for col in layout.get("columns", []))
    use_transfer_engine = has_transfer_rules(category_name) and not is_houjin3 and not has_amazon_layout

    if use_transfer_engine:
        # 転送エンジンのヘッダーからカラム定義を生成
        headers = get_headers_for_sheet(category_name)
        columns = [{"header": h, "source": h} for h in headers]
    else:
        columns = layout.get("columns", [])
        if not columns:
            columns = load_json(LAYOUTS_FILE).get("layouts", {}).get("_default", {}).get("columns", [])

    total_rows = len(df)
    if total_rows == 0:
        return

    num_parts = math.ceil(total_rows / max_rows)

    for part in range(num_parts):
        start = part * max_rows
        end = min(start + max_rows, total_rows)
        part_df = df.iloc[start:end].reset_index(drop=True)

        # シート名（31文字制限）
        if num_parts > 1:
            sheet_name = f"{base_name}_Part_{part + 1}"
        else:
            sheet_name = base_name
        sheet_name = sheet_name[:31]

        # 重複シート名の回避
        existing = [ws.title for ws in wb.worksheets]
        if sheet_name in existing:
            for suffix in range(1, 100):
                candidate = f"{sheet_name[:28]}_{suffix}"
                if candidate not in existing:
                    sheet_name = candidate
                    break

        ws = wb.create_sheet(title=sheet_name)

        # ヘッダー行
        for col_idx, col_def in enumerate(columns, 1):
            cell = ws.cell(row=1, column=col_idx, value=col_def["header"])
            cell.font = HEADER_FONT_WHITE
            cell.fill = HEADER_FILL
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = THIN_BORDER

        # データ行
        for row_idx, (_, data_row) in enumerate(part_df.iterrows(), 2):
            is_frontier = str(data_row.get("配送区分", "")) == "フロンティア行"
            _source = data_row.get("ソース", "")
            is_amazon = str(_source) == "amazon" if _source is not None and str(_source) != "nan" else has_amazon_layout

            if use_transfer_engine and not is_amazon:
                # 楽天用: 転送エンジンで全列の値を一括生成
                transfer_result = apply_transfer_rules(data_row, category_name, row_number=row_idx - 1)

            if is_amazon:
                # Amazon用: 専用抽出器で属性を取得
                # NaN対策: pandasのNaNをstr()すると"nan"になるため空文字に変換
                _opts = data_row.get("項目・選択肢", "")
                _opts = "" if pd.isna(_opts) else str(_opts)
                _pname = data_row.get("商品名", "")
                _pname = "" if pd.isna(_pname) else str(_pname)
                amazon_attrs = extract_amazon_attributes(_opts, _pname)
                product_cat = str(data_row.get("製品カテゴリ", "") or "")
                short_name = _shorten_product_name(_pname, product_cat)

            for col_idx, col_def in enumerate(columns, 1):
                header = col_def["header"]

                if is_amazon:
                    # Amazon専用の値マッピング
                    amazon_src = col_def.get("amazon_source", header)
                    value = _extract_amazon_value(
                        data_row, header, amazon_attrs, short_name,
                        row_idx - 1, barcode_pre, barcode_suf,
                        amazon_source=amazon_src,
                    )
                elif use_transfer_engine:
                    value = transfer_result.get(header, "")
                else:
                    value = _extract_value(data_row, col_def, row_idx - 1, barcode_pre, barcode_suf)

                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.font = DATA_FONT
                cell.border = THIN_BORDER
                cell.alignment = Alignment(vertical="center", wrap_text=True)

                # フロンティア行は赤背景
                if is_frontier:
                    cell.fill = FRONTIER_FILL

                # 個数2以上はピンク
                if col_def["header"] == "個数":
                    try:
                        if int(value) >= 2:
                            cell.fill = PINK_FILL
                    except (ValueError, TypeError):
                        pass

        # 列幅の自動調整
        _auto_column_width(ws, len(columns))

        # 印刷設定
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True

        # Summary用データ
        qty_col = next((c for c in columns if c["header"] == "個数"), None)
        if qty_col:
            qty_total = 0
            for _, row in part_df.iterrows():
                try:
                    qty_total += int(row.get("個数", 1))
                except (ValueError, TypeError):
                    qty_total += 1
        else:
            qty_total = len(part_df)

        summary_data.append({
            "シート名": sheet_name,
            "件数": len(part_df),
            "数量合計": qty_total,
        })


def _amazon_split_key(row):
    """Amazon用のシート分割キーを決定。

    マクロ②のI列と同じ分類:
    1. ひとことメモに「複数」+「単品」→ 単品＋（フロンティア+）
    2. ひとことメモに「複数」→ 複数（フロンティア）
    3. 単品複数列が「複数」or「単品+」→ 複数 or 単品＋（同一注文に他商品）
    4. それ以外 → 単品（AmazonJP）
    """
    memo = str(row.get("ひとことメモ", ""))
    has_fukusu = "複数" in memo
    has_tanpin = "単品" in memo

    if has_fukusu and has_tanpin:
        return "単品＋"
    elif has_fukusu:
        return "複数"

    # ひとことメモに「複数」がなくても、単品複数列で判定
    qty_type = str(row.get("単品複数", ""))
    if qty_type == "複数":
        return "複数"
    if qty_type == "単品+":
        return "単品＋"

    return "単品"


def _extract_value(row: pd.Series, col_def: dict, row_number: int, barcode_pre: str, barcode_suf: str):
    """カラム定義に従ってデータを抽出"""
    source = col_def.get("source", "")
    extract = col_def.get("extract", "")

    # 連番
    if source == "_row_number":
        return row_number

    raw = str(row.get(source, "")) if source in row.index else ""

    # 抽出パターン
    if extract == "size_mm":
        # 商品名からサイズ部分のみ抽出
        match = re.search(r"(\d+\.?\d*)\s*(?:mm|ｍｍ|ミリ)", raw)
        return f"{match.group(1)}ｍｍ" if match else raw[:20]

    if extract == "product_short":
        # 商品名を短縮（【】内を除去、30文字まで）
        short = re.sub(r"【[^】]*】", "", raw)
        short = re.sub(r"\[.*?\]", "", short)
        short = re.sub(r"【?10％OFF.*?】?", "", short)
        return short.strip()[:30]

    if extract == "body_color":
        # ボディカラーを抽出
        match = re.search(r"(?:カラー|ボディカラー|ボディーカラー)[=：:]\s*(.+?)(?:\n|$)", raw)
        return match.group(1).strip() if match else ""

    if extract == "illustration":
        # イラストを抽出
        match = re.search(r"(?:イラスト|イラストスタンプ)[=：:]\s*(.+?)(?:\n|$)", raw)
        return match.group(1).strip() if match else ""

    if extract == "ink_color":
        # 墨色/インク色を抽出
        match = re.search(r"(?:墨色|薄墨|インク色)[=：:]\s*(.+?)(?:\n|$)", raw)
        return match.group(1).strip() if match else ""

    if extract == "sei":
        # 姓を抽出（スペース区切りの前半）
        parts = raw.split()
        return parts[0] if parts else raw

    if extract == "mei":
        # 名を抽出（スペース区切りの後半）
        parts = raw.split()
        return parts[1] if len(parts) >= 2 else ""

    # バーコード列はプレフィックス/サフィックス付与
    if col_def["header"] == "バーコード" and raw:
        return f"{barcode_pre}{raw}{barcode_suf}"

    return raw


def _extract_amazon_value(row, header, amazon_attrs, short_name, row_number, barcode_pre, barcode_suf, amazon_source=""):
    """Amazon用の値取得。amazon_sourceキーで何のデータを取るか指定。"""
    src = amazon_source or header

    # 空文字指定 = 空欄出力（Amazon備考欄は作成内容抽出に使ったので空にする）
    if src == "":
        return ""
    if src in ("備考", "備考欄"):
        return ""

    # 固定値パターン（_fixed:XXX）
    if src.startswith("_fixed:"):
        return src[7:]

    # 短縮商品名
    if src == "short_name":
        return short_name

    # 行展開された場合の優先値
    if src == "作成名" and "_expanded_name" in row.index and str(row.get("_expanded_name", "")):
        return str(row.get("_expanded_name", ""))
    if src == "書体" and "_expanded_font" in row.index and str(row.get("_expanded_font", "")):
        return str(row.get("_expanded_font", ""))

    # Amazon抽出結果
    if src in ("書体", "カラー", "作成名", "サイズ", "配置"):
        return amazon_attrs.get(src, "")

    def _safe_str(val):
        return "" if val is None or (isinstance(val, float) and pd.isna(val)) else str(val)

    # 元データから直接取得
    if src == "個数":
        val = _safe_str(row.get("個数", "1")) or "1"
        return val.replace(".0", "") if val.endswith(".0") else val
    if src == "GoQ管理番号":
        return _safe_str(row.get("GoQ管理番号", ""))
    if src == "ひとことメモ":
        return _safe_str(row.get("ひとことメモ", ""))
    if src == "単品複数":
        # AmazonJP / フロンティア / フロンティア+ の形式（マクロ③と一致）
        memo = _safe_str(row.get("ひとことメモ", ""))
        has_fukusu = "複数" in memo
        has_tanpin = "単品" in memo
        if has_fukusu and has_tanpin:
            return "フロンティア+"
        elif has_fukusu:
            return "Amazonフロンティア"
        qty = _safe_str(row.get("単品複数", ""))
        if qty == "複数":
            return "Amazonフロンティア"
        if qty == "単品+":
            return "フロンティア+"
        return "AmazonJP"
    if src == "注文者氏名":
        return str(row.get("注文者氏名", ""))
    if src == "セット":
        name = str(row.get("商品名", ""))
        if "2点セット" in name:
            return "2点セット"
        if "3点セット" in name:
            return "3点セット"
        return ""

    # フォールバック
    if src in row.index:
        val = row.get(src, "")
        return "" if pd.isna(val) else str(val)

    return ""


def _auto_column_width(ws, num_columns: int):
    """列幅を内容に合わせて自動調整"""
    for col_idx in range(1, num_columns + 1):
        max_len = 0
        col_letter = get_column_letter(col_idx)
        for row in ws.iter_rows(min_col=col_idx, max_col=col_idx, values_only=False):
            for cell in row:
                if cell.value:
                    # 日本語文字は2倍幅で計算
                    val = str(cell.value)
                    char_len = sum(2 if ord(c) > 127 else 1 for c in val)
                    max_len = max(max_len, char_len)
        # 最小8、最大40
        ws.column_dimensions[col_letter].width = min(max(max_len + 2, 8), 40)


def _write_summary(wb: Workbook, summary_data: list):
    """Summaryシートを先頭に追加"""
    ws = wb.create_sheet(title="Summary", index=0)

    # ヘッダー
    headers = ["シート名", "件数", "数量合計"]
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = HEADER_FONT_WHITE
        cell.fill = HEADER_FILL
        cell.border = THIN_BORDER

    # データ
    total_count = 0
    total_qty = 0
    for row_idx, item in enumerate(summary_data, 2):
        ws.cell(row=row_idx, column=1, value=item["シート名"]).border = THIN_BORDER
        ws.cell(row=row_idx, column=2, value=item["件数"]).border = THIN_BORDER
        ws.cell(row=row_idx, column=3, value=item["数量合計"]).border = THIN_BORDER
        total_count += item["件数"]
        total_qty += item["数量合計"]

    # 合計行
    total_row = len(summary_data) + 2
    ws.cell(row=total_row, column=1, value="合計").font = Font(bold=True)
    ws.cell(row=total_row, column=2, value=total_count).font = Font(bold=True)
    ws.cell(row=total_row, column=3, value=total_qty).font = Font(bold=True)
    for col in range(1, 4):
        ws.cell(row=total_row, column=col).border = THIN_BORDER

    # 列幅
    ws.column_dimensions["A"].width = 35
    ws.column_dimensions["B"].width = 10
    ws.column_dimensions["C"].width = 12


def generate_vendor_workbooks(df: pd.DataFrame) -> dict:
    """外注先別にExcelを生成して辞書で返す。

    Returns:
        dict[str, bytes]: {外注先名: Excelバイト列}
    """
    vendor_config = load_json("vendor_mapping.json")
    vendors = vendor_config.get("vendors", {})

    # 各行に出力シート名と製品カテゴリを付与
    df = df.copy()
    df["_出力シート"] = df.apply(_resolve_sheet_name, axis=1)

    results = {}

    for vendor_name, vendor_def in vendors.items():
        cats_rakuten = set(vendor_def.get("categories_rakuten", []))
        cats_yahoo = set(vendor_def.get("categories_yahoo", []))
        cats_amazon = set(vendor_def.get("categories_amazon", []))

        source_col = df.get("ソース", pd.Series(dtype=str))

        # 楽天: ソースが"rakuten"の行のみ
        mask_rakuten = (
            (source_col == "rakuten")
            & df["_出力シート"].isin(cats_rakuten)
        ) if cats_rakuten else pd.Series(False, index=df.index)

        # Yahoo!/Qoo10等: ソースが"non_rakuten"の行
        mask_yahoo = (
            (source_col == "non_rakuten")
            & df["_出力シート"].isin(cats_yahoo)
        ) if cats_yahoo else pd.Series(False, index=df.index)

        # 楽天+Yahoo!共通カテゴリ（categories_rakutenにある場合はnon_rakutenも含む）
        mask_rakuten_both = (
            (source_col.isin(["rakuten", "non_rakuten"]))
            & df["_出力シート"].isin(cats_rakuten)
        ) if cats_rakuten else pd.Series(False, index=df.index)

        # Amazon: 製品カテゴリでフィルタ
        mask_amazon = (
            (source_col == "amazon")
            & df["製品カテゴリ"].isin(cats_amazon)
        ) if cats_amazon else pd.Series(False, index=df.index)

        # 条件付きカテゴリ（単品/複数で外注先が変わる）
        mask_conditional = _build_conditional_mask(
            df, vendor_def.get("conditional_categories", {}), source_col
        )

        vendor_df = df[mask_rakuten_both | mask_yahoo | mask_amazon | mask_conditional]

        if len(vendor_df) == 0:
            continue

        # 既存のgenerate_workbookを流用してExcelを生成
        wb_bytes = generate_workbook(vendor_df)
        results[vendor_name] = wb_bytes

    # 未割当データも出力（どの外注先にも属さない行）
    all_assigned = pd.Series(False, index=df.index)
    source_col = df.get("ソース", pd.Series(dtype=str))
    for vendor_name, vendor_def in vendors.items():
        cats_r = set(vendor_def.get("categories_rakuten", []))
        cats_y = set(vendor_def.get("categories_yahoo", []))
        cats_a = set(vendor_def.get("categories_amazon", []))
        mask_r = (
            source_col.isin(["rakuten", "non_rakuten"])
            & df["_出力シート"].isin(cats_r)
        ) if cats_r else pd.Series(False, index=df.index)
        mask_y = (
            (source_col == "non_rakuten")
            & df["_出力シート"].isin(cats_y)
        ) if cats_y else pd.Series(False, index=df.index)
        mask_a = (
            (source_col == "amazon")
            & df["製品カテゴリ"].isin(cats_a)
        ) if cats_a else pd.Series(False, index=df.index)
        mask_cond = _build_conditional_mask(
            df, vendor_def.get("conditional_categories", {}), source_col
        )
        all_assigned = all_assigned | mask_r | mask_y | mask_a | mask_cond

    unassigned = df[~all_assigned]
    if len(unassigned) > 0:
        results["未割当"] = generate_workbook(unassigned)

    return results


def _build_conditional_mask(df, conditional_categories, source_col):
    """条件付きカテゴリのマスクを構築。

    conditional_categories例:
    {"おなまえスタンプ": {"単品複数": ["単品"]}}
    → _出力シートが「おなまえスタンプ」かつ単品複数が「単品」の行のみマッチ
    """
    mask = pd.Series(False, index=df.index)
    if not conditional_categories:
        return mask

    for sheet_name, conditions in conditional_categories.items():
        sheet_mask = df["_出力シート"] == sheet_name
        # 楽天/Yahoo!のみ（Amazonはcategories_amazonで別処理）
        sheet_mask = sheet_mask & source_col.isin(["rakuten", "non_rakuten"])
        for col_name, allowed_values in conditions.items():
            if col_name in df.columns:
                sheet_mask = sheet_mask & df[col_name].isin(allowed_values)
        mask = mask | sheet_mask

    return mask


def generate_vendor_zip(df: pd.DataFrame) -> bytes:
    """外注先別ExcelをZIPにまとめてバイト列で返す。"""
    import zipfile

    vendor_workbooks = generate_vendor_workbooks(df)
    today = datetime.now().strftime("%Y%m%d")

    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        for vendor_name, wb_bytes in vendor_workbooks.items():
            filename = f"{vendor_name}_{today}.xlsx"
            zf.writestr(filename, wb_bytes)

    return output.getvalue()
