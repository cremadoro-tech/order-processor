# /meeting-notes -- PLAUD録音 → 議事録 → Google Docs保存

## 概要

PLAUD Noteの録音から議事録を自動生成し、Google Docsに保存する。
PLAUDで文字起こし済みならその議事録を使い、未処理ならWhisper（ローカル無料）で文字起こしする。

**全て無料・Claude Code内で完結する設計。**

---

## 実行手順

### 1. ユーザーに会議の日時を確認

ユーザーの発言から日時を特定する。例：
- 「本日11時のミーティング」→ 今日の日付 + 11:00
- 「昨日の定例」→ 昨日の日付（時刻はユーザーに確認）

### 2. PLAUD API で該当録音を検索

```bash
python3 ".agents/skills/meeting-notes/scripts/plaud_fetcher.py" find \
  --date "YYYY-MM-DD" --time "HH:MM"
```

結果から該当ファイルを特定する。複数ヒットした場合はユーザーに選択させる。

### 3. 分岐: 文字起こしデータの取得

**is_trans=true の場合** → PLAUDの議事録を取得:

```bash
python3 ".agents/skills/meeting-notes/scripts/plaud_fetcher.py" notes \
  --file-id "ファイルID"
```

取得した議事録をそのまま使うか、Claude Codeで再構成するかユーザーに確認。

**is_trans=false の場合** → Whisper でローカル文字起こし:

1. 音声ファイルをダウンロード:
```bash
python3 ".agents/skills/meeting-notes/scripts/plaud_fetcher.py" download \
  --file-id "ファイルID" --output "/tmp/plaud-meeting.mp3"
```

2. Whisper で文字起こし:
```python
import static_ffmpeg
static_ffmpeg.add_paths()
import whisper
model = whisper.load_model("small")
result = model.transcribe("/tmp/plaud-meeting.mp3", language="ja", verbose=False)
transcript_text = result["text"]
```

注意: Whisper の処理は音声の長さに応じて数分〜20分程度かかる。バックグラウンド実行推奨。

### 4. 議事録の生成

Claude Code自身が以下のMarkdownフォーマットで議事録を生成する（追加API不要）:

```markdown
# 【会議タイトル】議事録

## 会議情報
- **日時**: YYYY-MM-DD H:MM-H:MM
- **参加者**: [カンマ区切り]
- **場所/形式**: [Zoom/対面等]
- **記録者**: AI（自動生成）

## 会議の目的
[文字起こしから推定した概要]

## 議論内容
### 議題1: [件名]
> **発言者**: ...内容...
> **結論**: ...

## 決定事項
- [x] 決定事項1

## アクションアイテム
| # | 担当 | タスク | 期限 |
|:--|:-----|:------|:-----|
| 1 | [名前] | [タスク] | [日付] |

## 次回予定
- **日時**: [推定日時]
- **議題**: [議題案]
```

### 5. Google Docs に保存

議事録Markdownを一時ファイルに書き出し、スクリプトで保存:

```bash
python3 ".agents/skills/meeting-notes/scripts/gdocs_saver.py" \
  --title "【会議タイトル】YYYY-MM-DD 議事録" \
  --markdown-file "/tmp/meeting-notes-output.md"
```

保存後、Google Docs URLをユーザーに通知する。

---

## PLAUDトークンの更新（有効期限切れ時）

トークンが切れた場合は以下のスクリプトでブラウザを開き再ログイン:

```bash
python3 ".agents/skills/meeting-notes/scripts/plaud_fetcher.py" list
```

401エラーが出たら、ユーザーにブラウザ経由でPLAUDにログインし直してもらう。

---

## 必要な認証情報

- `.agents/skills/meeting-notes/data/plaud-creds.json` -- PLAUDトークン（初回ログイン時に自動生成）
- `.google_token.json` -- Google OAuth トークン
- `.env` の `GOOGLE_DOCS_FOLDER_ID`
