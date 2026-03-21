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


def generate_workbook(df: pd.DataFrame) -> bytes:
    """処理済みDataFrameからExcel作業指示書を生成してバイト列で返す。"""
    settings = load_json(LAYOUTS_FILE)
    layouts = settings.get("layouts", {})
    max_rows = settings.get("max_rows_per_sheet", 100)
    barcode_pre = settings.get("barcode_prefix", "*")
    barcode_suf = settings.get("barcode_suffix", "*")

    wb = Workbook()
    # デフォルトシートを削除
    wb.remove(wb.active)

    summary_data = []

    # カテゴリ別に処理
    if "カテゴリ" not in df.columns:
        _write_sheet(wb, "全件", df, layouts.get("_default", {}), max_rows, barcode_pre, barcode_suf, summary_data)
    else:
        for category, group in df.groupby("カテゴリ", sort=False):
            layout = layouts.get(category, layouts.get("_default", {}))

            # 単品複数で分割
            if "単品複数" in group.columns:
                for qty_type, sub_group in group.groupby("単品複数", sort=False):
                    sub_group = sub_group.reset_index(drop=True)
                    sheet_name = f"{category}_{qty_type}"
                    _write_sheet(wb, sheet_name, sub_group, layout, max_rows, barcode_pre, barcode_suf, summary_data)
            else:
                group = group.reset_index(drop=True)
                _write_sheet(wb, category, group, layout, max_rows, barcode_pre, barcode_suf, summary_data)

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

    # 転送ルールが存在するカテゴリか判定
    use_transfer_engine = has_transfer_rules(category_name)

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

            if use_transfer_engine:
                # 転送エンジンで全列の値を一括生成
                transfer_result = apply_transfer_rules(data_row, category_name, row_number=row_idx - 1)

            for col_idx, col_def in enumerate(columns, 1):
                if use_transfer_engine:
                    value = transfer_result.get(col_def["header"], "")
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
