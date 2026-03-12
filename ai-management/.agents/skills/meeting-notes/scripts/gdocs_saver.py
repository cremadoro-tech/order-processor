#!/usr/bin/env python3
"""
Markdown の議事録を Google Docs に保存するスクリプト

使い方:
  python3 gdocs_saver.py --title "議事録タイトル" --markdown-file "/path/to/notes.md"
"""

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# .env 読み込み（プロジェクトルート）
# scripts/ → meeting-notes/ → skills/ → .agents/ → ai-management/
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

TOKEN_FILE = PROJECT_ROOT / ".google_token.json"
SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]


def get_credentials():
    """Google OAuth2 認証情報を取得・リフレッシュ"""
    if not TOKEN_FILE.exists():
        print(json.dumps({"error": f"トークンファイルが見つかりません: {TOKEN_FILE}"}), file=sys.stderr)
        sys.exit(1)

    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, "w") as f:
            json.dump(json.loads(creds.to_json()), f)

    return creds


def save_to_docs(title: str, markdown_text: str, folder_id: str) -> dict:
    """Google Docs にドキュメントを作成して保存"""
    creds = get_credentials()
    drive = build("drive", "v3", credentials=creds)
    docs = build("docs", "v1", credentials=creds)

    # 1. Google Docs を指定フォルダに作成
    file_metadata = {
        "name": title,
        "mimeType": "application/vnd.google-apps.document",
        "parents": [folder_id],
    }
    created = drive.files().create(body=file_metadata, fields="id,webViewLink").execute()
    doc_id = created["id"]
    doc_url = created["webViewLink"]

    # 2. テキストを書き込み
    requests = [{"insertText": {"text": markdown_text, "location": {"index": 1}}}]
    docs.documents().batchUpdate(documentId=doc_id, body={"requests": requests}).execute()

    return {"doc_id": doc_id, "doc_url": doc_url, "title": title}


def main():
    parser = argparse.ArgumentParser(description="議事録を Google Docs に保存")
    parser.add_argument("--title", required=True, help="ドキュメントタイトル")
    parser.add_argument("--markdown-file", required=True, help="Markdown ファイルパス")
    parser.add_argument("--folder-id", default=None, help="保存先フォルダID（省略時は .env から）")
    args = parser.parse_args()

    import os
    folder_id = args.folder_id or os.getenv("GOOGLE_DOCS_FOLDER_ID")
    if not folder_id:
        print(json.dumps({"error": "GOOGLE_DOCS_FOLDER_ID が未設定です"}), file=sys.stderr)
        sys.exit(1)

    md_path = Path(args.markdown_file)
    if not md_path.exists():
        print(json.dumps({"error": f"ファイルが見つかりません: {md_path}"}), file=sys.stderr)
        sys.exit(1)

    markdown_text = md_path.read_text(encoding="utf-8")
    result = save_to_docs(args.title, markdown_text, folder_id)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
