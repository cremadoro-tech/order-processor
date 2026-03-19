"""複数判定（強化版）+ JP行/フロンティア行判定

VBA「複数判別」「フロンティア行変換」「ネームイン複数」を再現。
注文番号ごとに商品種類数と個数を集計して判定する。
"""

import pandas as pd
from config.product_lookup import lookup_product_code


def check_quantity_advanced(df: pd.DataFrame) -> pd.DataFrame:
    """注文番号ベースの高度な複数判定。

    更新列: 単品複数（単品 / 単品+ / 複数 に上書き）
    追加列: 配送区分（JP行 / フロンティア行 / (空)）, 製品カテゴリ
    """
    df = df.copy()
    df["製品カテゴリ"] = ""
    df["配送区分"] = ""

    order_col = "GoQ管理番号" if "GoQ管理番号" in df.columns else None
    sku_col = "商品SKU" if "商品SKU" in df.columns else None
    code_col = "商品コード" if "商品コード" in df.columns else None
    product_col = "商品名" if "商品名" in df.columns else None

    # 商品コードからカテゴリをルックアップ
    for idx in df.index:
        sku = str(df.at[idx, sku_col]) if sku_col else ""
        code = str(df.at[idx, code_col]) if code_col else ""
        # SKU優先、なければ商品コードで検索
        cat = lookup_product_code(sku) or lookup_product_code(code)
        df.at[idx, "製品カテゴリ"] = cat

    # 注文番号ベースの複数判定
    if order_col:
        df = _advanced_quantity_check(df, order_col)

    # JP行 / フロンティア行判定
    df = _check_delivery_type(df)

    return df


def _advanced_quantity_check(df: pd.DataFrame, order_col: str) -> pd.DataFrame:
    """注文番号ごとに商品種類と個数をチェックして単品/複数を再判定"""
    orders = df.groupby(order_col)

    for order_id, group in orders:
        if not order_id or str(order_id).strip() == "":
            continue

        # 製品カテゴリの種類数
        categories = set(group["製品カテゴリ"].dropna().unique()) - {""}
        row_count = len(group)

        if len(categories) >= 2:
            # 異なるカテゴリの商品が混在 → 複数
            df.loc[group.index, "単品複数"] = "複数"
        elif row_count >= 2 and len(categories) <= 1:
            # 同じカテゴリで2行以上 → 単品+
            df.loc[group.index, "単品複数"] = "単品+"

    return df


def _check_delivery_type(df: pd.DataFrame) -> pd.DataFrame:
    """JP行/フロンティア行の判定"""
    sku_col = "商品SKU" if "商品SKU" in df.columns else None
    product_col = "商品名" if "商品名" in df.columns else None
    cat_col = "製品カテゴリ"

    for idx in df.index:
        sku = str(df.at[idx, sku_col]) if sku_col else ""
        product = str(df.at[idx, product_col]) if product_col else ""
        category = str(df.at[idx, cat_col])

        # フロンティア行: SKUに「kuro-j9」を含む（Jointy J9用）
        if "kuro-j9" in sku.lower():
            df.at[idx, "配送区分"] = "フロンティア行"
            continue

        # フロンティア行: 製品カテゴリに「フロンティア」を含む
        if "フロンティア" in category:
            df.at[idx, "配送区分"] = "フロンティア行"
            continue

        # JP行: 受注番号が「232996-」で始まる（楽天特定店舗）
        order_col = "受注番号" if "受注番号" in df.columns else None
        if order_col:
            order_num = str(df.at[idx, order_col])
            if order_num.startswith("232996-"):
                # Normal系の一部はJP行
                if category in ("Normal2", "Normal3", "normal2", "normal3"):
                    df.at[idx, "配送区分"] = "JP行"

    return df
