"""全設定ファイルの汎用読み書きユーティリティ

Streamlit Community Cloud（読み取り専用FS）では書き込みが失敗するため、
save_jsonはエラーを返さず警告のみ出す。設定変更はGitHub経由で管理する。
"""

import json
from pathlib import Path

CONFIG_DIR = Path(__file__).parent


def load_json(filename: str) -> dict:
    filepath = CONFIG_DIR / filename
    if not filepath.exists():
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filename: str, data: dict) -> bool:
    """JSONファイルに保存。書き込み不可環境ではFalseを返す。"""
    filepath = CONFIG_DIR / filename
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except OSError:
        return False


def is_writable() -> bool:
    """ファイルシステムが書き込み可能かチェック"""
    test_path = CONFIG_DIR / ".write_test"
    try:
        test_path.write_text("test")
        test_path.unlink()
        return True
    except OSError:
        return False
