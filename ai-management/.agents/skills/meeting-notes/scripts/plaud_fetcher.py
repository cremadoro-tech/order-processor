#!/usr/bin/env python3
"""
PLAUD Note API から録音ファイルを検索し、文字起こし・議事録データを取得するスクリプト

使い方:
  # ファイル一覧（デスクトップ録音、最新10件）
  python3 plaud_fetcher.py list

  # 日時で録音を検索（例: 2026-03-06 11:00）
  python3 plaud_fetcher.py find --date "2026-03-06" --time "11:00"

  # 指定ファイルの議事録を取得
  python3 plaud_fetcher.py notes --file-id "abc123..."

  # 指定ファイルの文字起こしテキストを取得
  python3 plaud_fetcher.py transcript --file-id "abc123..."
"""

import argparse
import gzip
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

CREDS_FILE = Path(__file__).resolve().parent.parent / "data" / "plaud-creds.json"
JST = timezone(timedelta(hours=9))


def load_creds():
    if not CREDS_FILE.exists():
        print(json.dumps({"error": "PLAUD認証情報がありません。先にブラウザでログインしてください。"}), file=sys.stderr)
        sys.exit(1)
    with open(CREDS_FILE) as f:
        return json.load(f)


def api_get(api_domain, token, path):
    headers = {
        "Authorization": token,
        "edit-from": "web",
        "app-platform": "web",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }
    url = f"{api_domain}{path}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def download_content(url):
    """S3の署名付きURLからコンテンツを取得（gzip対応）"""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        raw = resp.read()
    try:
        text = gzip.decompress(raw)
        return json.loads(text)
    except (gzip.BadGzipFile, OSError):
        return json.loads(raw)


def list_files(api, token, page_size=10):
    """ファイル一覧を取得"""
    data = api_get(api, token, f"/file/simple/web?pageSize={page_size}&pageNo=1")
    files = data.get("data_file_list", [])
    result = []
    for f in files:
        start_ms = f.get("start_time", 0)
        start_dt = datetime.fromtimestamp(start_ms / 1000, tz=JST)
        duration_sec = f.get("duration", 0) / 1000
        mins = int(duration_sec // 60)
        secs = int(duration_sec % 60)
        result.append({
            "id": f["id"],
            "filename": f["filename"],
            "start_time": start_dt.isoformat(),
            "duration": f"{mins}分{secs}秒",
            "is_trans": f.get("is_trans", False),
            "is_summary": f.get("is_summary", False),
        })
    return result


def find_by_datetime(api, token, target_date, target_time, tolerance_min=30):
    """日時で録音を検索（±tolerance_min分）"""
    target_str = f"{target_date} {target_time}"
    target_dt = datetime.strptime(target_str, "%Y-%m-%d %H:%M").replace(tzinfo=JST)
    tolerance = timedelta(minutes=tolerance_min)

    # 最新50件を検索
    data = api_get(api, token, "/file/simple/web?pageSize=50&pageNo=1")
    files = data.get("data_file_list", [])

    matches = []
    for f in files:
        start_ms = f.get("start_time", 0)
        start_dt = datetime.fromtimestamp(start_ms / 1000, tz=JST)
        if abs(start_dt - target_dt) <= tolerance:
            duration_sec = f.get("duration", 0) / 1000
            mins = int(duration_sec // 60)
            secs = int(duration_sec % 60)
            matches.append({
                "id": f["id"],
                "filename": f["filename"],
                "start_time": start_dt.isoformat(),
                "duration": f"{mins}分{secs}秒",
                "is_trans": f.get("is_trans", False),
                "is_summary": f.get("is_summary", False),
            })

    return matches


def get_file_detail(api, token, file_id):
    """ファイル詳細を取得"""
    data = api_get(api, token, f"/file/detail/{file_id}")
    return data.get("data", {})


def get_notes(api, token, file_id):
    """議事録（auto_sum_note）を取得"""
    detail = get_file_detail(api, token, file_id)
    content_list = detail.get("content_list", [])

    for item in content_list:
        if item.get("data_type") == "auto_sum_note" and item.get("task_status") == 1:
            link = item.get("data_link", "")
            if link:
                data = download_content(link)
                return {
                    "source": "plaud",
                    "title": data.get("header", {}).get("headline", ""),
                    "markdown": data.get("ai_content", ""),
                    "category": data.get("category", ""),
                }

    return {"source": "plaud", "error": "議事録データがありません（PLAUDで未処理）"}


def get_transcript(api, token, file_id):
    """文字起こしテキスト（transaction）を取得"""
    detail = get_file_detail(api, token, file_id)
    content_list = detail.get("content_list", [])

    for item in content_list:
        if item.get("data_type") == "transaction" and item.get("task_status") == 1:
            link = item.get("data_link", "")
            if link:
                segments = download_content(link)
                # テキストに変換
                lines = []
                for seg in segments:
                    speaker = seg.get("speaker", "不明")
                    content = seg.get("content", "")
                    lines.append(f"【{speaker}】{content}")
                full_text = "\n".join(lines)
                return {
                    "source": "plaud",
                    "text": full_text,
                    "segments": segments,
                    "segment_count": len(segments),
                }

    return {"source": "plaud", "error": "文字起こしデータがありません（PLAUDで未処理）"}


def download_audio(api, token, file_id, output_path):
    """音声ファイル（MP3）をダウンロード"""
    url = f"{api}/file/download/{file_id}"
    headers = {
        "Authorization": token,
        "edit-from": "web",
        "app-platform": "web",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    out = Path(output_path)
    out.write_bytes(data)
    return {
        "file_path": str(out),
        "size_bytes": len(data),
        "size_mb": round(len(data) / 1024 / 1024, 1),
    }


def main():
    parser = argparse.ArgumentParser(description="PLAUD Note API クライアント")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("list", help="ファイル一覧")

    find_p = sub.add_parser("find", help="日時で検索")
    find_p.add_argument("--date", required=True, help="日付 (YYYY-MM-DD)")
    find_p.add_argument("--time", required=True, help="時刻 (HH:MM)")
    find_p.add_argument("--tolerance", type=int, default=30, help="許容誤差（分）")

    notes_p = sub.add_parser("notes", help="議事録を取得")
    notes_p.add_argument("--file-id", required=True)

    trans_p = sub.add_parser("transcript", help="文字起こしを取得")
    trans_p.add_argument("--file-id", required=True)

    dl_p = sub.add_parser("download", help="音声ファイルをダウンロード")
    dl_p.add_argument("--file-id", required=True)
    dl_p.add_argument("--output", default="/tmp/plaud-meeting.mp3", help="保存先パス")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    creds = load_creds()
    api = creds["api_domain"]
    token = creds["token"]

    if args.command == "list":
        result = list_files(api, token)
    elif args.command == "find":
        result = find_by_datetime(api, token, args.date, args.time, args.tolerance)
    elif args.command == "notes":
        result = get_notes(api, token, args.file_id)
    elif args.command == "transcript":
        result = get_transcript(api, token, args.file_id)
    elif args.command == "download":
        result = download_audio(api, token, args.file_id, args.output)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
