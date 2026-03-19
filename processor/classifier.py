"""カテゴリ判定 + 単品/複数判定"""

import pandas as pd
from config.categories import get_keywords, get_default_category


def classify_category(memo: str) -> str:
    """ひとことメモからカテゴリを判定。

    キーワードリストを上から順にチェックし、最初にマッチしたカテゴリを返す。
    """
    default = get_default_category()
    if not memo:
        return default

    for keyword, category in get_keywords():
        if keyword in memo:
            return category

    return default


def classify_quantity_type(memo: str) -> str:
    """ひとことメモから単品/複数/単品+を判定。"""
    if not memo:
        return "単品"

    if "複数" in memo:
        return "複数"
    if "単品" in memo:
        return "単品+"
    return "単品"


def classify_all(df: pd.DataFrame) -> pd.DataFrame:
    """DataFrame全行にカテゴリ列と単品複数列を追加。"""
    df = df.copy()

    memo_col = "ひとことメモ"
    if memo_col not in df.columns:
        df["カテゴリ"] = get_default_category()
        df["単品複数"] = "単品"
        return df

    df["カテゴリ"] = df[memo_col].apply(classify_category)
    df["単品複数"] = df[memo_col].apply(classify_quantity_type)

    return df


def split_by_category(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """カテゴリ列でグループ分割し、dict形式で返す。"""
    if "カテゴリ" not in df.columns:
        return {"全件": df}

    result = {}
    for category, group in df.groupby("カテゴリ", sort=False):
        result[category] = group.reset_index(drop=True)

    # カテゴリ別件数の降順でソート
    result = dict(sorted(result.items(), key=lambda x: -len(x[1])))
    return result
