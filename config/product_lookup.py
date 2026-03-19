"""商品コードデータベースの読み書き（JSONファイルベース）

3つのDB:
- product_db.json: 振り分け用テンプレート（楽天印鑑系、11,386件）
- outsource_db.json: 外注マクロ（おなまえ・ゴム印等、2,505件）
- amazon_db.json: Amazon印鑑（297件）
"""

import json
from functools import lru_cache
from pathlib import Path

CONFIG_DIR = Path(__file__).parent

DB_FILES = ["product_db.json", "outsource_db.json", "amazon_db.json"]


def _load_json(filename: str) -> dict:
    filepath = CONFIG_DIR / filename
    if not filepath.exists():
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_all_dbs() -> dict:
    """全DBを1つの辞書に統合して返す"""
    merged = {}
    for db_file in DB_FILES:
        merged.update(_load_json(db_file))
    return merged


def lookup_product_code(sku: str) -> str:
    """商品コード(SKU)から製品カテゴリを検索。

    検索順序:
    1. 完全一致
    2. SKUからハイフン区切りで末尾を削りながら前方一致
       例: PCL-2B-RD2-RDBL → PCL-2B-RD2 → PCL-2B → PCL
    3. DB側キーがSKUの前方一致
    """
    if not sku:
        return ""

    db = _load_all_dbs()

    # 1. 完全一致
    if sku in db:
        return db[sku]

    # 2. SKU末尾を順に削って検索（最も長い一致を優先）
    parts = sku.split("-")
    for i in range(len(parts) - 1, 0, -1):
        prefix = "-".join(parts[:i])
        if prefix in db:
            return db[prefix]

    # 3. 部分前方一致（双方向）
    # SKUがDB側キーで始まる or DB側キーがSKUで始まる
    # 最も長い一致を優先（最も具体的なマッチ）
    best_match = ""
    best_key_len = 0
    for key in db:
        if (sku.startswith(key) or key.startswith(sku)) and len(key) > best_key_len:
            best_key_len = len(key)
            best_match = db[key]

    return best_match


def get_all_db_stats() -> dict:
    """全DBの統計情報を返す"""
    stats = {}
    for db_file, label in [
        ("product_db.json", "楽天印鑑"),
        ("outsource_db.json", "外注"),
        ("amazon_db.json", "Amazon"),
    ]:
        db = _load_json(db_file)
        stats[label] = len(db)
    return stats
