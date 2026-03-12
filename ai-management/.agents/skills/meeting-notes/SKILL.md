---
name: meeting-notes
description: PLAUD Noteの録音から議事録を自動生成しGoogle Docsに保存する（全自動・無料）。Use when user says "議事録作って", "会議録作成", "録音を文字起こしして", "ミーティングの議事録", "PLAUD", "meeting notes", or specifies a meeting date/time for transcription. Supports PLAUD API + Whisper local transcription + Google Docs export.
---

# Meeting Notes スキル

PLAUD Noteの録音から議事録を自動生成し、Google Docsに保存する。

## When to Use This Skill

- 「会議録作って」「議事録を作成」「議事録にして」
- 「本日11時のミーティングの議事録」のような日時指定

## アーキテクチャ（全て無料・Claude Code内で完結）

```
[1] PLAUD API で録音ファイル検索
    |
[2] 分岐:
    [2a] is_trans=true → PLAUD議事録を取得
    [2b] is_trans=false → PLAUD APIで音声DL → Whisper(ローカル)で文字起こし
    |
[3] Claude Code が議事録を構造化（Markdown）
    |
[4] Google Docs に保存
```

## ファイル構成

```
.agents/skills/meeting-notes/
├── SKILL.md
├── requirements.txt
├── scripts/
│   ├── plaud_fetcher.py   # PLAUD API クライアント（検索・取得・DL）
│   └── gdocs_saver.py     # Google Docs 保存
├── data/
│   └── plaud-creds.json   # PLAUD認証トークン
└── venv/
```

## スクリプト使い方

### plaud_fetcher.py

```bash
# ファイル一覧
python3 plaud_fetcher.py list

# 日時で検索
python3 plaud_fetcher.py find --date "2026-03-06" --time "11:00"

# 議事録取得（PLAUDの自動議事録）
python3 plaud_fetcher.py notes --file-id "abc123..."

# 文字起こしテキスト取得
python3 plaud_fetcher.py transcript --file-id "abc123..."

# 音声ファイルダウンロード（is_trans=false の場合に使用）
python3 plaud_fetcher.py download --file-id "abc123..." --output "/tmp/meeting.mp3"
```

### Whisper 文字起こし（is_trans=false の場合）

```python
import static_ffmpeg
static_ffmpeg.add_paths()
import whisper
model = whisper.load_model("small")
result = model.transcribe("/tmp/meeting.mp3", language="ja", verbose=False)
# result["text"] に全文テキスト
```

### gdocs_saver.py

```bash
python3 gdocs_saver.py --title "タイトル" --markdown-file "/path/to/notes.md"
```

## 認証情報

| ファイル | 内容 | 有効期限 |
|:--|:--|:--|
| `data/plaud-creds.json` | PLAUD JWT | 約1年 |
| `.google_token.json` | Google OAuth | 自動リフレッシュ |
| `.env` の `GOOGLE_DOCS_FOLDER_ID` | 保存先フォルダ | - |

## 依存パッケージ（システムグローバル）

- `openai-whisper` — ローカル文字起こし（無料）
- `static-ffmpeg` — ffmpeg バイナリ（Whisper が使用）
- `google-api-python-client` — Google Docs/Drive API
- `google-auth`, `google-auth-oauthlib`, `google-auth-httplib2`
- `python-dotenv`

## PLAUDトークン更新手順

1. Playwright で非headlessブラウザを起動
2. PLAUD Note にGoogleログイン
3. localStorage から `tokenstr` を取得
4. `data/plaud-creds.json` に保存
