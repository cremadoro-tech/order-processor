"""全設定ファイルの汎用読み書きユーティリティ"""

import json
from pathlib import Path

CONFIG_DIR = Path(__file__).parent


def load_json(filename: str) -> dict:
    filepath = CONFIG_DIR / filename
    if not filepath.exists():
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filename: str, data: dict) -> None:
    filepath = CONFIG_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
