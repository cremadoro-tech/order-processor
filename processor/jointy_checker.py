"""ジョインティ文字数×配置の整合性チェック

VBA「ジョインティ用グループ」のロジックを再現。
- 配置パターンごとの許容文字数を定義
- 不整合があれば警告列にフラグ
- 改行数が5行以上なら赤色警告
"""

import pandas as pd
from config.settings_io import load_json, save_json

SETTINGS_FILE = "jointy_settings.json"

# デフォルト設定（初回起動時に生成）
DEFAULT_SETTINGS = {
    "layout_char_limits": {
        "タテ1列": {"min": 1, "max": 4},
        "タテ2列": {"min": 1, "max": 8},
        "ヨコ1列": {"min": 1, "max": 6},
        "ヨコ2列": {"min": 1, "max": 12},
        "フルネーム1列": {"min": 2, "max": 6},
        "フルネーム2列": {"min": 2, "max": 12},
    },
    "max_lines_warning": 5,
}


def _ensure_settings():
    """設定ファイルがなければデフォルトを生成"""
    data = load_json(SETTINGS_FILE)
    if not data:
        save_json(SETTINGS_FILE, DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS
    return data


def check_jointy(df: pd.DataFrame) -> pd.DataFrame:
    """ジョインティカテゴリの行に対して文字数×配置の整合性をチェック。

    追加列: ジョインティ警告
    """
    df = df.copy()
    df["ジョインティ警告"] = ""

    settings = _ensure_settings()
    limits = settings.get("layout_char_limits", {})
    max_lines = settings.get("max_lines_warning", 5)

    cat_col = "カテゴリ" if "カテゴリ" in df.columns else None
    name_col = "作成名" if "作成名" in df.columns else None
    dir_col = "文字の向き" if "文字の向き" in df.columns else None
    remarks_col = "備考" if "備考" in df.columns else None

    if not all([cat_col, name_col]):
        return df

    for idx in df.index:
        category = str(df.at[idx, cat_col])
        if category != "ジョインティ":
            continue

        name = str(df.at[idx, name_col]) if name_col else ""
        direction = str(df.at[idx, dir_col]) if dir_col else ""
        remarks = str(df.at[idx, remarks_col]) if remarks_col else ""

        warnings = []

        # 文字数チェック
        char_count = len(name.replace(" ", "").replace("　", ""))
        if direction and direction in limits:
            limit = limits[direction]
            if char_count > limit["max"]:
                warnings.append(f"文字数多い({char_count}>{limit['max']})")
            elif char_count < limit["min"]:
                warnings.append(f"文字数少ない({char_count}<{limit['min']})")

        # 改行数チェック（備考欄）
        line_count = remarks.count("\n") + 1
        if line_count >= max_lines:
            warnings.append(f"改行{line_count}行")

        if warnings:
            df.at[idx, "ジョインティ警告"] = " / ".join(warnings)

    return df
