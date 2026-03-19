"""注意事項抽出 — 旧字確認・ヤフー備考欄確認

VBA「ヤフー備考欄確認」「楽天旧字確認」のロジックを再現。
備考欄から注意が必要な情報を抽出し「注意事項」列に格納する。
"""

import re
import pandas as pd


def extract_cautions(df: pd.DataFrame) -> pd.DataFrame:
    """備考欄から注意事項を抽出して「注意事項」列を追加。"""
    df = df.copy()
    df["注意事項"] = ""

    remarks_col = "備考" if "備考" in df.columns else None
    if not remarks_col:
        return df

    for idx in df.index:
        remarks = str(df.at[idx, remarks_col])
        cautions = []

        # 旧字確認
        kyuji = _extract_kyuji(remarks)
        if kyuji:
            cautions.append(f"旧字: {kyuji}")

        # ヤフー備考欄の「備考=」以降
        bikou = _extract_yahoo_bikou(remarks)
        if bikou:
            cautions.append(bikou)

        if cautions:
            df.at[idx, "注意事項"] = "☆注意☆ " + " / ".join(cautions)

    return df


def _extract_kyuji(text: str) -> str:
    """備考欄に「旧字」が含まれる場合、旧字以降の内容を抽出"""
    if "旧字" not in text:
        return ""

    # 「旧字」以降の内容を抽出
    match = re.search(r"旧字[：:\s]*(.+?)(?:\n|$)", text)
    if match:
        content = match.group(1).strip()
        # 定型文を除去
        content = re.sub(
            r"\(任意\)\s*旧字指定がある場合はご記入ください。?[=＝]?", "", content
        )
        content = content.strip()
        if content and content != "☆注意☆":
            return content
    return ""


def _extract_yahoo_bikou(text: str) -> str:
    """備考欄の「備考=」以降の文字列を抽出"""
    match = re.search(r"備考[=＝]\s*(.+?)(?:\n|$)", text)
    if match:
        content = match.group(1).strip()
        if content:
            return content
    return ""
