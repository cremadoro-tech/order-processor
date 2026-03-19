"""カテゴリキーワード定義（JSONファイルベース）

ひとことメモにキーワードが含まれるかで判定。
リストの上から順にマッチし、最初にヒットしたカテゴリを採用する。
UIから追加・削除・並び替えが可能。
"""

import json
from pathlib import Path

CATEGORIES_FILE = Path(__file__).parent / "categories.json"


def load_categories() -> dict:
    """JSONファイルからカテゴリ定義を読み込む"""
    with open(CATEGORIES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_categories(data: dict) -> None:
    """カテゴリ定義をJSONファイルに保存"""
    with open(CATEGORIES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_keywords() -> list[tuple[str, str]]:
    """(検索キーワード, 分類先カテゴリ名) のリストを返す"""
    data = load_categories()
    return [(item["keyword"], item["category"]) for item in data["keywords"]]


def get_default_category() -> str:
    """マッチしなかった場合のデフォルトカテゴリを返す"""
    return load_categories().get("default_category", "その他")


def add_keyword(keyword: str, category: str) -> None:
    """キーワードを追加"""
    data = load_categories()
    # 重複チェック
    for item in data["keywords"]:
        if item["keyword"] == keyword:
            return
    data["keywords"].append({"keyword": keyword, "category": category})
    save_categories(data)


def remove_keyword(keyword: str) -> None:
    """キーワードを削除"""
    data = load_categories()
    data["keywords"] = [item for item in data["keywords"] if item["keyword"] != keyword]
    save_categories(data)


def move_keyword(keyword: str, direction: str) -> None:
    """キーワードの優先順位を上下に移動"""
    data = load_categories()
    keywords = data["keywords"]
    idx = next((i for i, item in enumerate(keywords) if item["keyword"] == keyword), None)
    if idx is None:
        return
    if direction == "up" and idx > 0:
        keywords[idx], keywords[idx - 1] = keywords[idx - 1], keywords[idx]
    elif direction == "down" and idx < len(keywords) - 1:
        keywords[idx], keywords[idx + 1] = keywords[idx + 1], keywords[idx]
    save_categories(data)


# 後方互換性のため
CATEGORY_KEYWORDS = property(lambda self: get_keywords())
DEFAULT_CATEGORY = get_default_category()
