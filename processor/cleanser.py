"""備考欄・項目選択肢のクレンジング処理"""

import re
import pandas as pd
from config.cleansing_patterns import get_remove_patterns, get_linebreak_replacements


def cleanse(df: pd.DataFrame) -> pd.DataFrame:
    """備考欄と項目・選択肢列をクレンジングして返す。"""
    df = df.copy()
    patterns = get_remove_patterns()
    lb_replacements = get_linebreak_replacements()

    # 備考欄のクレンジング
    if "備考" in df.columns:
        df["備考"] = df["備考"].apply(
            lambda x: _cleanse_text(x, patterns, lb_replacements)
        )

    # 項目・選択肢のクレンジング
    if "項目・選択肢" in df.columns:
        df["項目・選択肢"] = df["項目・選択肢"].apply(
            lambda x: _cleanse_text(x, patterns, lb_replacements)
        )

    return df


def _cleanse_text(
    text: str, patterns: list[str], lb_replacements: dict[str, str]
) -> str:
    """テキストから不要パターンを削除し、改行記号を変換する。"""
    if not text:
        return text

    # 改行記号を変換
    for symbol, replacement in lb_replacements.items():
        text = text.replace(symbol, replacement)

    # 不要パターンを削除
    for pattern in patterns:
        text = text.replace(pattern, "")

    # 連続改行を1つに圧縮
    text = re.sub(r"\n{3,}", "\n\n", text)
    # 先頭・末尾の改行・空白を除去
    text = text.strip()

    return text
