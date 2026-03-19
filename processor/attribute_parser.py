"""属性自動解析 — 印材・サイズ・書体・文字の向きを抽出 + 書体変換

設定はconfig/attribute_settings.jsonで管理。
"""

import re
import pandas as pd
from config.settings_io import load_json

SETTINGS_FILE = "attribute_settings.json"


def _load_settings() -> dict:
    return load_json(SETTINGS_FILE)


def parse_attributes(df: pd.DataFrame) -> pd.DataFrame:
    """商品名・項目選択肢から印材/サイズ/書体/文字の向きを自動解析。"""
    df = df.copy()
    df["印材"] = ""
    df["サイズ"] = ""
    df["書体"] = ""
    df["書体(フォント名)"] = ""
    df["文字の向き"] = ""

    settings = _load_settings()

    product_col = "商品名" if "商品名" in df.columns else None
    options_col = "項目・選択肢" if "項目・選択肢" in df.columns else None

    if not product_col:
        return df

    for idx in df.index:
        product = str(df.at[idx, product_col])
        options = str(df.at[idx, options_col]) if options_col else ""

        df.at[idx, "印材"] = _detect_material(product, options, settings)
        df.at[idx, "サイズ"] = _detect_size(product, options, settings)

        font = _detect_font(options, settings)
        font_conv = settings.get("font_conversion", {})
        df.at[idx, "書体"] = font
        df.at[idx, "書体(フォント名)"] = font_conv.get(font, font)
        df.at[idx, "文字の向き"] = _detect_direction(options, settings)

    return df


def _detect_material(product: str, options: str, settings: dict) -> str:
    material = ""
    for item in settings.get("material_keywords", []):
        if item["keyword"] in product:
            material = item["value"]
            break
    for item in settings.get("material_product_suffix", []):
        if item["keyword"] in product:
            material += item["value"]
    for item in settings.get("material_suffix_keywords", []):
        if item["keyword"] in options:
            if item["value"] == "桜" and "薄桜" in options:
                material += "薄桜"
            elif item["value"] != "桜" or "薄桜" not in options:
                material += item["value"]
            break
    return material


def _detect_size(product: str, options: str, settings: dict) -> str:
    match = re.search(r"[【\[](\d+\.?\d*)\s*mm[】\]]", product)
    if match:
        return f"{float(match.group(1)):.1f}mm"
    for size in settings.get("size_patterns", []):
        if size in options:
            return f"{size}mm"
    return ""


def _detect_font(options: str, settings: dict) -> str:
    for item in settings.get("font_keywords", []):
        if item["keyword"] in options:
            return item["value"]
    return ""


def _detect_direction(options: str, settings: dict) -> str:
    for item in settings.get("direction_keywords", []):
        if item["keyword"] in options:
            return item["value"]
    return ""
