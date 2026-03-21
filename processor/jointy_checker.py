"""ジョインティ詳細機能

元マクロの「ジョインティ用グループ」のロジックを再現:
1. 文字数×配置の整合性チェック（既存）
2. イラスト名プレフィックス付与（すまいるばん→「すまいる」等）
3. 2行区切り必要フラグ
4. 配置番号の正規化（「配置16　/　1文字」→「配置16」）
"""

import re

import pandas as pd
from config.settings_io import load_json, save_json

SETTINGS_FILE = "jointy_settings.json"

# デフォルト設定
DEFAULT_SETTINGS = {
    "layout_char_limits": {
        "配置1": {"min": 1, "max": 4, "label": "タテ1行"},
        "配置2": {"min": 1, "max": 8, "label": "タテ2行"},
        "配置3": {"min": 2, "max": 6, "label": "タテ添え字下"},
        "配置4": {"min": 2, "max": 6, "label": "タテ添え字右寄"},
        "配置5": {"min": 2, "max": 6, "label": "タテ添え字中"},
        "配置6": {"min": 2, "max": 6, "label": "タテ添え字左下"},
        "配置7": {"min": 2, "max": 6, "label": "タテ添え字右下"},
        "配置8": {"min": 2, "max": 6, "label": "タテ添え字カッコ"},
        "配置9": {"min": 2, "max": 6, "label": "タテ添え字カッコ右下"},
        "配置10": {"min": 1, "max": 6, "label": "ヨコ1行"},
        "配置11": {"min": 1, "max": 12, "label": "ヨコ2行"},
        "配置12": {"min": 2, "max": 8, "label": "ヨコ添え字下"},
        "配置13": {"min": 2, "max": 8, "label": "ヨコ添え字右下"},
        "配置14": {"min": 2, "max": 8, "label": "ヨコ添え字カッコ"},
        "配置15": {"min": 2, "max": 8, "label": "ヨコ添え字カッコ右下"},
        "配置16": {"min": 1, "max": 1, "label": "1文字"},
        "配置17": {"min": 1, "max": 1, "label": "訂正印1文字"},
        "配置18": {"min": 1, "max": 4, "label": "訂正印タテ1行"},
        "配置19": {"min": 1, "max": 6, "label": "訂正印ヨコ1行"},
        "配置20": {"min": 1, "max": 8, "label": "訂正印タテ2行"},
        "配置21": {"min": 2, "max": 6, "label": "訂正印添え字下"},
        "配置22": {"min": 2, "max": 6, "label": "訂正印添え字カッコ"},
        "タテ1列": {"min": 1, "max": 4, "label": "タテ1列"},
        "タテ2列": {"min": 1, "max": 8, "label": "タテ2列"},
        "ヨコ1列": {"min": 1, "max": 6, "label": "ヨコ1列"},
        "ヨコ2列": {"min": 1, "max": 12, "label": "ヨコ2列"},
        "1文字": {"min": 1, "max": 1, "label": "1文字"},
        "1-文字": {"min": 1, "max": 1, "label": "1文字"},
    },
    "max_lines_warning": 5,
    "illustration_prefixes": {
        "すまいるばん": "すまいる",
        "わんこばん": "わんこ",
        "にゃんこばん": "にゃんこ",
        "ぱんだばん": "ぱんだ",
        "Kidsばん": "Kids",
    },
    "two_line_split_patterns": [
        "配置2", "配置3", "配置4", "配置5", "配置6", "配置7",
        "配置8", "配置9", "配置11", "配置12", "配置13",
        "配置14", "配置15", "配置20", "配置21", "配置22",
        "タテ2列", "ヨコ2列",
    ],
}


def _ensure_settings():
    """設定ファイルがなければデフォルトを生成"""
    data = load_json(SETTINGS_FILE)
    if not data or "illustration_prefixes" not in data:
        save_json(SETTINGS_FILE, DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS
    return data


def check_jointy(df):
    """ジョインティカテゴリの行に対して詳細チェック・変換を実行。

    追加/更新列:
    - ジョインティ警告: 文字数×配置の整合性エラー
    - イラスト名: プレフィックス付与済みイラスト名
    - 2行区切り: 2行区切りが必要な配置かどうか
    - 配置番号: 正規化された配置番号
    """
    df = df.copy()
    df["ジョインティ警告"] = ""
    df["2行区切り"] = ""
    df["配置番号"] = ""

    settings = _ensure_settings()
    limits = settings.get("layout_char_limits", {})
    max_lines = settings.get("max_lines_warning", 5)
    illust_prefixes = settings.get("illustration_prefixes", {})
    two_line_patterns = settings.get("two_line_split_patterns", [])

    cat_col = "カテゴリ" if "カテゴリ" in df.columns else None
    name_col = "作成名" if "作成名" in df.columns else None
    options_col = "項目・選択肢" if "項目・選択肢" in df.columns else None
    product_col = "商品名" if "商品名" in df.columns else None

    if not cat_col:
        return df

    for idx in df.index:
        category = str(df.at[idx, cat_col])
        if category != "ジョインティ":
            continue

        name = str(df.at[idx, name_col]) if name_col else ""
        options = str(df.at[idx, options_col]) if options_col else ""
        product = str(df.at[idx, product_col]) if product_col else ""

        warnings = []

        # === 1. 配置番号の正規化 ===
        layout = _normalize_layout(options)
        df.at[idx, "配置番号"] = layout

        # === 2. 文字数×配置の整合性チェック ===
        if layout and name:
            char_count = len(name.replace(" ", "").replace("　", "").replace("\n", ""))
            if layout in limits:
                limit = limits[layout]
                if char_count > limit["max"]:
                    warnings.append(f"文字数多い({char_count}>{limit['max']})")
                elif char_count < limit["min"]:
                    warnings.append(f"文字数少ない({char_count}<{limit['min']})")

        # 改行数チェック（項目・選択肢）
        line_count = options.count("\n") + 1
        if line_count >= max_lines:
            warnings.append(f"改行{line_count}行")

        if warnings:
            df.at[idx, "ジョインティ警告"] = " / ".join(warnings)

        # === 3. 2行区切りフラグ ===
        if layout in two_line_patterns:
            df.at[idx, "2行区切り"] = "2行区切り必要"

        # === 4. イラスト名プレフィックス付与 ===
        _apply_illustration_prefix(df, idx, product, illust_prefixes)

    return df


def _normalize_layout(options):
    """配置番号を正規化する。

    「配置16　/　1文字」→「配置16」
    「配置5　/　タテ添え字中=配置5」→「配置5」
    「タテ1列」→「タテ1列」
    """
    # 「配置N」パターンを検索
    match = re.search(r'配置(\d+)', options)
    if match:
        return f"配置{match.group(1)}"

    # 旧形式のパターン
    for pattern in ["タテ1列", "タテ2列", "タテ1列+1文字", "ヨコ1列", "ヨコ2列",
                     "タテ-1列", "タテ-2列", "ヨコ-1列", "ヨコ-2列",
                     "1文字", "1-文字"]:
        if pattern in options:
            return pattern

    return ""


def _apply_illustration_prefix(df, idx, product, prefixes):
    """商品名に応じてイラスト名にプレフィックスを付与する。

    例: 商品名に「すまいるばん」→ イラスト列の値の先頭に「すまいる」を付加
    """
    illust_col = None
    for col in ["イラスト", "文字の向き"]:
        if col in df.columns:
            illust_col = col
            break

    if not illust_col:
        return

    current = str(df.at[idx, illust_col])
    if not current:
        return

    for keyword, prefix in prefixes.items():
        if keyword in product:
            # 既にプレフィックスが付いていなければ付与
            if not current.startswith(prefix):
                df.at[idx, illust_col] = f"{prefix}{current}"
            break
