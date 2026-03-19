"""印影確認判定 + 販売課判定 + 同一注文番号への波及

VBA「印影確認」「印影確認2」「販売課」のロジックを再現。
設定はconfig/seal_settings.jsonで管理。
"""

import pandas as pd
from config.settings_io import load_json

SETTINGS_FILE = "seal_settings.json"


def _load_settings() -> dict:
    return load_json(SETTINGS_FILE)


def check_seal_confirmation(df: pd.DataFrame) -> pd.DataFrame:
    """印影確認・販売課・名入れスペシャルを判定し、同一注文番号に波及させる。"""
    df = df.copy()
    df["特殊分類"] = ""

    settings = _load_settings()
    inei_options = settings.get("inei_keywords_options", [])
    inei_remarks = settings.get("inei_keywords_remarks", [])
    inei_design = settings.get("inei_keywords_design_remarks", [])
    kyuji_patterns = [
        (p["char"], p["style"]) for p in settings.get("kyuji_inei_patterns", [])
    ]

    options_col = "項目・選択肢" if "項目・選択肢" in df.columns else None
    remarks_col = "備考" if "備考" in df.columns else None
    memo_col = "ひとことメモ" if "ひとことメモ" in df.columns else None
    order_col = "GoQ管理番号" if "GoQ管理番号" in df.columns else None

    for idx in df.index:
        options = str(df.at[idx, options_col]) if options_col else ""
        remarks = str(df.at[idx, remarks_col]) if remarks_col else ""
        memo = str(df.at[idx, memo_col]) if memo_col else ""

        if "名入れスペシャル" in memo:
            df.at[idx, "特殊分類"] = "名入れスペシャル"
            continue

        if any(kw in options for kw in inei_options):
            df.at[idx, "特殊分類"] = "印影確認"
            continue

        if any(kw in remarks for kw in inei_remarks):
            df.at[idx, "特殊分類"] = "印影確認"
            continue

        if any(kw in remarks for kw in inei_design):
            df.at[idx, "特殊分類"] = "印影確認"
            continue

        if "GLO" in options and "高田" in str(df.at[idx, "注文者氏名"] if "注文者氏名" in df.columns else ""):
            df.at[idx, "特殊分類"] = "印影確認"
            continue

        for char, style in kyuji_patterns:
            if char in remarks and style in remarks:
                df.at[idx, "特殊分類"] = "印影確認"
                break

        if "," in remarks or "，" in remarks:
            df.at[idx, "特殊分類"] = "印影確認"
            continue

        if "2024-" in options:
            df.at[idx, "特殊分類"] = "販売課"

    if order_col:
        df = _propagate_by_order(df, order_col, "印影確認")
        df = _propagate_by_order(df, order_col, "販売課")

    return df


def _propagate_by_order(df: pd.DataFrame, order_col: str, label: str) -> pd.DataFrame:
    flagged_orders = set(
        df.loc[df["特殊分類"] == label, order_col].dropna().unique()
    )
    if flagged_orders:
        mask = df[order_col].isin(flagged_orders) & (df["特殊分類"] == "")
        df.loc[mask, "特殊分類"] = label
    return df
