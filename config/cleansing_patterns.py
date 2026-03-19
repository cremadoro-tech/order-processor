"""クレンジングパターンの読み書き（JSONファイルベース）

パターンはconfig/cleansing_patterns.jsonに保存。
StreamlitのUI上から追加・削除できる。
"""

import json
from pathlib import Path

PATTERNS_FILE = Path(__file__).parent / "cleansing_patterns.json"


def load_patterns() -> dict:
    """JSONファイルからパターンを読み込む"""
    with open(PATTERNS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_patterns(data: dict) -> None:
    """パターンをJSONファイルに保存"""
    with open(PATTERNS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_remove_patterns() -> list[str]:
    """削除パターンのリストを返す"""
    return load_patterns().get("remove_patterns", [])


def add_pattern(pattern: str) -> None:
    """削除パターンを追加"""
    data = load_patterns()
    if pattern not in data["remove_patterns"]:
        data["remove_patterns"].append(pattern)
        save_patterns(data)


def remove_pattern(pattern: str) -> None:
    """削除パターンを除去"""
    data = load_patterns()
    if pattern in data["remove_patterns"]:
        data["remove_patterns"].remove(pattern)
        save_patterns(data)


def get_linebreak_replacements() -> dict[str, str]:
    """改行記号の変換マップを返す"""
    return load_patterns().get("linebreak_replacements", {})
