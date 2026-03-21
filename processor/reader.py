"""CSV読み込み + プラットフォーム自動判定"""

import io
import pandas as pd


def read_csv(file) -> pd.DataFrame:
    """CSVファイルを読み込んでDataFrameを返す。

    Shift-JIS(CP932) → UTF-8 の順でデコードを試行。
    file: StreamlitのUploadedFile または ファイルパス文字列
    """
    if hasattr(file, "read"):
        raw = file.read()
        file.seek(0)
    else:
        with open(file, "rb") as f:
            raw = f.read()

    # エンコーディング検出
    for enc in ["cp932", "shift_jis", "utf-8-sig", "utf-8"]:
        try:
            text = raw.decode(enc)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        raise ValueError("CSVのエンコーディングを判定できませんでした")

    df = pd.read_csv(io.StringIO(text), dtype=str)
    df = df.fillna("")
    return df


def detect_platform(df: pd.DataFrame) -> str:
    """ヘッダー列名からプラットフォームを判定。

    Returns: 'rakuten' | 'non_rakuten' | 'unknown'
    """
    columns = list(df.columns)

    # 楽天分: 2列目が「商品SKU」
    if len(columns) >= 2 and columns[1] == "商品SKU":
        return "rakuten"

    # 楽天Amazon以外: 2列目が「商品SKU」ではなく「商品コード」が先
    if len(columns) >= 2 and columns[1] == "商品コード":
        return "non_rakuten"

    # Amazon: 「注文時間」列と「送付先氏名」列がある
    if "注文時間" in columns and "送付先氏名" in columns:
        return "amazon"

    # GoQ管理番号のヘッダー名でも判定可能
    for col in columns:
        if "三桁ハイフン区切り" in col:
            return "rakuten"
        if "カスタム" in col:
            return "non_rakuten"

    return "unknown"
