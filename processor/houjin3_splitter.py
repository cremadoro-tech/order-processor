"""法人3本セット分割モジュール

法人3本セット（houjin3）の1受注行を、代表者印・銀行印・角印の3行に分割する。
元マクロの「法人3本用書体」「法人3本サイズ判別」「法人3本印材判別」
「法人3本印材セット判別」「法人3本セット分割」を再現。
"""

import re

import pandas as pd


# セットタイプ別の構成定義
# A/B/Cセットで代表者印・銀行印の形状（天丸/寸胴）とサイズが異なる
SET_DEFINITIONS = {
    "A": {
        "1本目": {"種類": "代表者印", "形状": "天丸", "サイズ": "18.0"},
        "2本目": {"種類": "銀行印", "形状": "寸胴", "サイズ": "16.5"},
    },
    "B": {
        "1本目": {"種類": "代表者印", "形状": "寸胴", "サイズ": "18.0"},
        "2本目": {"種類": "銀行印", "形状": "天丸", "サイズ": "16.5"},
    },
    "C": {
        "1本目": {"種類": "代表者印", "形状": "寸胴", "サイズ": "16.5"},
        "2本目": {"種類": "銀行印", "形状": "寸胴", "サイズ": "13.5"},
    },
}


def split_houjin3(row):
    """法人3本セットを3行に分割する。

    Args:
        row: pd.Series（元の受注データ1行）
    Returns:
        list[dict]: 3行分の辞書リスト（代表者印、銀行印、角印）
    """
    product_name = str(row.get("商品名", ""))
    product_code = str(row.get("商品コード", ""))
    sku = str(row.get("商品SKU", ""))

    # セットタイプ判定（A/B/C）
    set_type = _detect_set_type(product_name, product_code, sku)

    # 印材判定
    material = _detect_material(product_name, product_code, sku)

    # 角印サイズ判定（21mm or 24mm）
    kaku_size = _detect_kaku_size(product_name, product_code, sku)

    # セット定義を取得
    set_def = SET_DEFINITIONS.get(set_type, SET_DEFINITIONS["A"])

    # 共通情報
    common = {
        "受注番号": str(row.get("受注番号", "")),
        "商品名": product_name,
        "書体": str(row.get("書体", "")),
        "書体(フォント名)": str(row.get("書体(フォント名)", "")),
        "作成名": str(row.get("作成名", "")),
        "注文者氏名": str(row.get("注文者氏名", "")),
        "GoQ管理番号": str(row.get("GoQ管理番号", "")),
        "個数": str(row.get("個数", "1")),
        "備考": str(row.get("備考", "")),
        "注意事項": str(row.get("注意事項", "")),
        "項目・選択肢": str(row.get("項目・選択肢", "")),
        "セットタイプ": f"{set_type}セット",
    }

    rows = []

    # 1本目: 代表者印
    r1 = dict(common)
    r1["No"] = 1
    r1["印鑑種類"] = set_def["1本目"]["種類"]
    r1["形状"] = set_def["1本目"]["形状"]
    r1["印材"] = f"{material}{set_def['1本目']['形状']}"
    r1["サイズ"] = f"{set_def['1本目']['サイズ']}mm"
    rows.append(r1)

    # 2本目: 銀行印
    r2 = dict(common)
    r2["No"] = 2
    r2["印鑑種類"] = set_def["2本目"]["種類"]
    r2["形状"] = set_def["2本目"]["形状"]
    r2["印材"] = f"{material}{set_def['2本目']['形状']}"
    r2["サイズ"] = f"{set_def['2本目']['サイズ']}mm"
    rows.append(r2)

    # 3本目: 角印
    r3 = dict(common)
    r3["No"] = 3
    r3["印鑑種類"] = "角印"
    r3["形状"] = "角"
    r3["印材"] = material
    r3["サイズ"] = f"{kaku_size}mm"
    rows.append(r3)

    return rows


def is_houjin3(row):
    """この行が法人3本セット（分割対象）かどうかを判定"""
    product_cat = str(row.get("製品カテゴリ", ""))
    return product_cat == "houjin3"


def _detect_set_type(product_name, product_code, sku):
    """セットタイプ（A/B/C）を判定"""
    # コードから判定（優先）
    code_lower = (product_code + sku).lower()
    if "-ac" in code_lower or "-a-" in code_lower or code_lower.endswith("-a"):
        return "A"
    if "-bc" in code_lower or "-b-" in code_lower or code_lower.endswith("-b"):
        return "B"
    if "-cc" in code_lower or "-c-" in code_lower or code_lower.endswith("-c"):
        return "C"

    # 商品名から判定
    if "Ａセット" in product_name or "Aセット" in product_name:
        return "A"
    if "Ｂセット" in product_name or "Bセット" in product_name:
        return "B"
    if "Ｃセット" in product_name or "Cセット" in product_name:
        return "C"

    return "A"  # デフォルト


def _detect_material(product_name, product_code, sku):
    """印材を判定"""
    code_lower = (product_code + sku).lower()

    # 黒水牛
    if "黒水牛" in product_name or "-k-" in code_lower or "3s-k-" in code_lower or "3set-k-" in code_lower:
        return "黒水牛"

    # オランダ水牛
    if "オランダ水牛" in product_name or "-w-" in code_lower or "3s-w-" in code_lower or "3set-w-" in code_lower:
        return "オランダ水牛"

    # チタン
    if "チタン" in product_name or "titan" in code_lower:
        return "チタン"

    # デフォルト: 上柘
    return "上柘"


def _detect_kaku_size(product_name, product_code, sku):
    """角印サイズ（21mm or 24mm）を判定"""
    code_combined = product_code + sku
    if "-24" in code_combined or "角24" in product_name:
        return "24.0"
    return "21.0"
