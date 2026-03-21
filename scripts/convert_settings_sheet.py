"""外注マクロテンプレートNEW.xlsmの設定シートをJSON化するスクリプト"""

import json
import sys
from pathlib import Path

import openpyxl


def convert_settings_sheet(xlsm_path: str, output_path: str) -> dict:
    """設定シートを読み込んでtransfer_rules.jsonに変換する。"""
    wb = openpyxl.load_workbook(xlsm_path, read_only=True, data_only=True)
    ws = wb["設定"]

    sheets = {}

    for row in ws.iter_rows(min_row=2, values_only=True):
        sheet_name = str(row[0]).strip() if row[0] else ""
        if not sheet_name:
            continue

        output_col = str(row[1]).strip() if row[1] else ""
        header = str(row[2]).strip() if row[2] else ""
        method_raw = row[3]
        sort_raw = str(row[4]).strip() if row[4] else ""
        source_col = str(row[5]).strip() if row[5] else ""
        transfer_raw = row[6]
        search_raw = str(row[7]).strip() if row[7] else ""
        fixed_raw = str(row[8]).strip() if row[8] else ""

        # 数値変換
        method = _to_int(method_raw)
        transfer = _to_int(transfer_raw)

        # 検索文字列: カンマ区切り→配列
        search_keywords = [s.strip() for s in search_raw.split(",") if s.strip()] if search_raw else []

        # I列の解釈（method×transferで意味が変わる）
        rule = {
            "output_col": output_col,
            "header": header,
            "method": method,
            "sort": sort_raw,
            "source_col": source_col,
            "transfer": transfer,
            "search_keywords": search_keywords,
        }

        # I列の解釈を転送方法に応じて切り替え
        if method == 1:
            # 連番: I列は不要
            pass
        elif method == 2:
            # 固定文字列
            rule["fixed_value"] = fixed_raw
        elif method == 3:
            if transfer == 2:
                # 検索して変換: I列=変換後の値
                rule["transform_value"] = fixed_raw
            elif transfer in (10, 20):
                # 不要行除去: I列=不要部分（カンマ区切り）
                rule["remove_parts"] = [s.strip() for s in fixed_raw.split(",") if s.strip()] if fixed_raw else []
            elif transfer == 4:
                # スペース分割N番目: I列=インデックス番号
                rule["split_index"] = _to_int(fixed_raw)
            elif transfer == 21:
                # 字種判別: I列=字種番号（1=ひらがな, 2=漢字, 3=ローマ字）
                rule["char_type"] = _to_int(fixed_raw)
            elif transfer == 22:
                # 行番号指定: I列=行番号
                rule["line_number"] = _to_int(fixed_raw)
            elif transfer == 12:
                # 新しい行に転送: I列=字種番号
                rule["char_type"] = _to_int(fixed_raw)
            else:
                # 転送1, 3: I列=検索一致時に1を返す等
                if fixed_raw:
                    rule["fixed_value"] = fixed_raw
        elif method == 4:
            # 数式
            rule["formula"] = fixed_raw

        # シート別にグループ化
        if sheet_name not in sheets:
            sheets[sheet_name] = {"columns": []}
        sheets[sheet_name]["columns"].append(rule)

    wb.close()

    # ソート情報を集約（各シートの最初のsort値を採用）
    for name, data in sheets.items():
        sort_keys = [r["sort"] for r in data["columns"] if r.get("sort")]
        if sort_keys:
            data["sort_config"] = sort_keys[0]

    result = {
        "_version": "1.0",
        "_source": "外注マクロテンプレートNEW.xlsm 設定シート",
        "_total_rules": sum(len(d["columns"]) for d in sheets.values()),
        "_total_sheets": len(sheets),
        "sheets": sheets,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return {name: len(d["columns"]) for name, d in sheets.items()}


def _to_int(value):
    """数値変換。失敗したらNone。"""
    if value is None:
        return None
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return None


if __name__ == "__main__":
    base = Path(__file__).parent.parent
    xlsm = base / "reference-macros" / "外注マクロテンプレートNEW.xlsm"
    output = base / "config" / "transfer_rules.json"

    summary = convert_settings_sheet(str(xlsm), str(output))

    total = sum(summary.values())
    print(f"変換完了: {len(summary)}商品, {total}ルール")
    print()
    for name, count in sorted(summary.items(), key=lambda x: -x[1]):
        print(f"  {name}: {count}ルール")
