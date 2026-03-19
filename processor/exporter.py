"""CSV/ZIPエクスポート"""

import io
import zipfile
from datetime import datetime

import pandas as pd


def to_csv_bytes(df: pd.DataFrame) -> bytes:
    """DataFrameをBOM付きUTF-8のCSVバイト列に変換。"""
    output = io.BytesIO()
    output.write(b"\xef\xbb\xbf")  # BOM
    df.to_csv(output, index=False, encoding="utf-8")
    return output.getvalue()


def to_zip_bytes(category_dfs: dict[str, pd.DataFrame]) -> bytes:
    """カテゴリ別DataFrameをZIPにまとめて返す。"""
    zip_buffer = io.BytesIO()
    today = datetime.now().strftime("%Y%m%d")

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for category, df in category_dfs.items():
            filename = f"{category}_{today}.csv"
            csv_bytes = to_csv_bytes(df)
            zf.writestr(filename, csv_bytes)

    return zip_buffer.getvalue()


def generate_filename(category: str, ext: str = "csv") -> str:
    """カテゴリ名+日付のファイル名を生成。"""
    today = datetime.now().strftime("%Y%m%d")
    return f"{category}_{today}.{ext}"
