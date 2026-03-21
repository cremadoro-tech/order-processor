"""カラム正規化 — プラットフォーム別の列順・列名を統一スキーマに変換"""

import re

import pandas as pd
from config.columns import UNIFIED_COLUMNS, RAKUTEN_RENAME, NON_RAKUTEN_RENAME, AMAZON_RENAME


def normalize(df: pd.DataFrame, platform: str) -> pd.DataFrame:
    """統一スキーマに正規化して返す。

    - 列名のリネーム（GoQ管理番号ヘッダーの統一）
    - 列順を統一スキーマに揃える
    - 日付形式を統一（2026/3/19 → 2026-03-19）
    - Amazon: 備考欄の「23:59:59」以降を「項目・選択肢」に変換
    """
    df = df.copy()

    # 列名リネーム
    if platform == "rakuten":
        rename_map = RAKUTEN_RENAME
    elif platform == "amazon":
        rename_map = AMAZON_RENAME
    else:
        rename_map = NON_RAKUTEN_RENAME
    df = df.rename(columns=rename_map)

    # Amazon専用: 備考欄から作成内容を抽出して「項目・選択肢」列を生成
    if platform == "amazon":
        df = _normalize_amazon(df)

    # 統一スキーマの列のみ抽出（存在する列だけ）
    available = [col for col in UNIFIED_COLUMNS if col in df.columns]
    df = df[available]

    # 日付形式を統一
    if "注文日" in df.columns:
        df["注文日"] = df["注文日"].apply(_normalize_date)

    # ソース列を追加（どのCSVから来たか）
    df["ソース"] = platform

    return df


def _normalize_amazon(df):
    """Amazon専用の正規化処理。

    元マクロ「作成内容取り出し2」を再現:
    - 備考欄の「23:59:59」以降のテキストを「項目・選択肢」列に抽出
    - 「ギフトメッセージ」の行を削除
    - 商品コード列がないので商品SKUをコピー
    """
    # 備考欄から「23:59:59」以降を抽出→項目・選択肢に
    if "備考" in df.columns:
        df["項目・選択肢"] = df["備考"].apply(_extract_after_timestamp)
        # 備考欄は元のまま残す（注意事項抽出等で使うため）

    # 商品コード列がないのでSKUをコピー
    if "商品コード" not in df.columns and "商品SKU" in df.columns:
        df["商品コード"] = df["商品SKU"]

    # 受注ステータス列がなければ空で追加
    if "受注ステータス" not in df.columns:
        df["受注ステータス"] = ""

    return df


def _extract_after_timestamp(text):
    """備考欄から「23:59:59」以降のテキストを抽出する。

    元マクロ「作成内容取り出し2」のTEXTAFTER関数相当。
    例:
    入力: "発送予定日\n...\n2026-03-26 23:59:59\nギフトメッセージ\n彫刻名　山田 書体　楷書体"
    出力: "彫刻名　山田 書体　楷書体"
    """
    if not text:
        return ""

    # 最後の「23:59:59」以降を抽出（複数ある場合は最後を使う）
    parts = re.split(r"\d{4}-\d{2}-\d{2}\s+23:59:59\s*", text)
    if len(parts) > 1:
        after = parts[-1]  # 最後のタイムスタンプ以降
    else:
        # タイムスタンプがない場合は全文を使う
        after = text

    # 不要行を削除
    lines = after.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # ギフトメッセージ関連
        if stripped == "ギフトメッセージ":
            continue
        if stripped.startswith("ギフトをお楽しみください"):
            continue
        # お届け予定日のタイムスタンプ行
        if re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$", stripped):
            continue
        if stripped == "お届け予定日":
            continue
        if stripped:
            cleaned.append(stripped)

    return "\n".join(cleaned)


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
