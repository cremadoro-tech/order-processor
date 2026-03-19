"""作成名抽出 — 正規表現で名前を精密抽出 + ひらがな/漢字/ローマ字判別

設定はconfig/name_settings.jsonで管理。
"""

import re
import pandas as pd
from config.settings_io import load_json

SETTINGS_FILE = "name_settings.json"


def _load_settings() -> dict:
    return load_json(SETTINGS_FILE)


def extract_names(df: pd.DataFrame) -> pd.DataFrame:
    """備考欄・項目選択肢から作成名を抽出し、文字種を判別。"""
    df = df.copy()
    df["作成名"] = ""
    df["文字種"] = ""

    settings = _load_settings()

    remarks_col = "備考" if "備考" in df.columns else None
    options_col = "項目・選択肢" if "項目・選択肢" in df.columns else None

    for idx in df.index:
        name = ""
        if remarks_col:
            name = _extract_name(str(df.at[idx, remarks_col]), settings)
        if not name and options_col:
            name = _extract_name(str(df.at[idx, options_col]), settings)

        if name:
            df.at[idx, "作成名"] = name
            df.at[idx, "文字種"] = _detect_char_type(name)

    return df


def _extract_name(text: str, settings: dict) -> str:
    if not text:
        return ""

    name_keywords = settings.get("name_keywords", [])
    stop_keywords = settings.get("name_stop_keywords", [])

    for keyword in name_keywords:
        stop_pattern = "|".join(re.escape(k) for k in stop_keywords)
        pattern = (
            re.escape(keyword)
            + r"[\s　：:\[\]【】=＝]*"
            + r"([^\s　【】\[\]=＝\n]+(?:[\s　]+[^\s　【】\[\]=＝\n]+)*?)"
            + r"(?=[\s　]*(?:" + stop_pattern + r"|【|\[|$))"
        )
        match = re.search(pattern, text)
        if match:
            name = match.group(1).strip()
            name = re.sub(r"[】\]]+$", "", name)
            if name and len(name) <= 30:
                return name

    match = re.search(r"作成名[=＝：:]\s*(.+?)(?:\n|$)", text)
    if match:
        name = match.group(1).strip()
        if name and len(name) <= 30:
            return name

    return ""


def _detect_char_type(name: str) -> str:
    if not name:
        return ""
    chars = name.replace(" ", "").replace("　", "")
    has_hiragana = bool(re.search(r"[\u3040-\u309F]", chars))
    has_katakana = bool(re.search(r"[\u30A0-\u30FF]", chars))
    has_kanji = bool(re.search(r"[\u4E00-\u9FFF\u3400-\u4DBF]", chars))
    has_alpha = bool(re.search(r"[a-zA-Zａ-ｚＡ-Ｚ]", chars))
    types = []
    if has_hiragana:
        types.append("ひらがな")
    if has_katakana:
        types.append("カタカナ")
    if has_kanji:
        types.append("漢字")
    if has_alpha:
        types.append("ローマ字")
    if len(types) == 1:
        return types[0]
    elif len(types) > 1:
        return "混合"
    return "その他"
