"""カラム正規化 — プラットフォーム別の列順・列名を統一スキーマに変換"""

import pandas as pd
from config.columns import UNIFIED_COLUMNS, RAKUTEN_RENAME, NON_RAKUTEN_RENAME


def normalize(df: pd.DataFrame, platform: str) -> pd.DataFrame:
    """統一スキーマに正規化して返す。

    - 列名のリネーム（GoQ管理番号ヘッダーの統一）
    - 列順を統一スキーマに揃える
    - 日付形式を統一（2026/3/19 → 2026-03-19）
    """
    df = df.copy()

    # 列名リネーム
    rename_map = RAKUTEN_RENAME if platform == "rakuten" else NON_RAKUTEN_RENAME
    df = df.rename(columns=rename_map)

    # 統一スキーマの列のみ抽出（存在する列だけ）
    available = [col for col in UNIFIED_COLUMNS if col in df.columns]
    df = df[available]

    # 日付形式を統一
    if "注文日" in df.columns:
        df["注文日"] = df["注文日"].apply(_normalize_date)

    # ソース列を追加（どのCSVから来たか）
    df["ソース"] = platform

    return df


def _normalize_date(date_str: str) -> str:
    """日付形式を統一。'2026/3/19' → '2026-03-19'"""
    if not date_str:
        return date_str
    # スラッシュ区切りの場合
    if "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            return f"{parts[0]}-{int(parts[1]):02d}-{int(parts[2]):02d}"
    return date_str
