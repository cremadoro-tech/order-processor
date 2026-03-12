# NotebookLM セットアップ・利用ガイド

> 元README.mdの内容をガイド準拠のためreferences/に移動（スキルフォルダ内にREADME.md禁止ルール対応）

## 注意事項: ローカルClaude Codeのみ対応

このスキルはローカルの[Claude Code](https://github.com/anthropics/claude-code)でのみ動作する。
Web UIはサンドボックスでネットワークアクセスがないため、ブラウザ自動化が使えない。

## 問題と解決策

### 問題
- ローカルドキュメントをClaude Codeに読ませるとトークン大量消費
- キーワード検索では文脈やドキュメント間の関連を見落とす
- 見つからない情報をハルシネーションで補完してしまう
- NotebookLMブラウザとエディタ間のコピペが手間

### 解決策
Claude CodeがNotebookLM（Geminiのソースグラウンデッド知識ベース）と直接対話する。

```
Your Task → Claude asks NotebookLM → Gemini synthesizes answer → Claude writes correct code
```

## なぜNotebookLMか？（ローカルRAGとの比較）

| アプローチ | トークンコスト | セットアップ | ハルシネーション | 回答品質 |
|----------|------------|-----------|-------------|--------|
| ドキュメントをClaudeに投入 | 非常に高い | 即座 | あり | 可変 |
| Web検索 | 中程度 | 即座 | 高い | 当たり外れ |
| ローカルRAG | 中〜高 | 数時間 | 中程度 | セットアップ依存 |
| **NotebookLMスキル** | **最小** | **5分** | **最小** | **エキスパート級** |

## インストール

```bash
# 1. skillsディレクトリを作成（なければ）
mkdir -p ~/.claude/skills

# 2. リポジトリをクローン
cd ~/.claude/skills
git clone https://github.com/PleasePrompto/notebooklm-skill notebooklm

# 3. Claude Codeで確認
"What are my skills?"
```

初回使用時に自動で:
- 隔離されたPython環境(`.venv`)を作成
- 全依存パッケージをインストール（Chromeブラウザ含む）
- すべてスキルフォルダ内に完結

## クイックスタート

### 1. 認証（初回のみ）
```
"Set up NotebookLM authentication"
```
→ Chromeウィンドウが開く → Googleアカウントでログイン

### 2. ナレッジベースを作成
[notebooklm.google.com](https://notebooklm.google.com) → ノートブック作成 → ドキュメントをアップロード:
- PDF、Google Docs、Markdownファイル
- Webサイト、GitHubリポジトリ
- YouTube動画
- 1ノートブックに複数ソース可

共有設定: **設定 → リンクを知っている全員 → リンクをコピー**

### 3. ライブラリに追加
**スマート追加（推奨）:**
```
"Query this notebook about its content and add it to my library: [your-link]"
```
→ Claudeが自動でノートブック内容を確認してメタデータ付きで追加

**手動追加:**
```
"Add this NotebookLM to my library: [your-link]"
```

### 4. リサーチ開始
```
"What does my React docs say about hooks?"
```

## よく使うコマンド

| 発話例 | 動作 |
|-------|------|
| "Set up NotebookLM authentication" | Chrome でGoogleログイン |
| "Add [link] to my NotebookLM library" | ノートブックをメタデータ付きで保存 |
| "Show my NotebookLM notebooks" | 保存済みノートブック一覧 |
| "Ask my API docs about [topic]" | 該当ノートブックにクエリ |
| "Use the React notebook" | アクティブノートブック設定 |
| "Clear NotebookLM data" | データリセット（ライブラリは保持） |

## アーキテクチャ

```
~/.claude/skills/notebooklm/
├── SKILL.md              # Claude向けの指示
├── scripts/              # Python自動化スクリプト
│   ├── ask_question.py   # NotebookLMクエリ
│   ├── notebook_manager.py # ライブラリ管理
│   └── auth_manager.py   # Google認証
├── .venv/                # 隔離Python環境（自動作成）
└── data/                 # ローカルノートブックライブラリ
```

## 技術詳細

### コア技術
- **Patchright**: ブラウザ自動化ライブラリ（Playwrightベース）
- **Python**: 実装言語
- **ステルス技術**: 人間らしいタイピング・インタラクションパターン

### 依存パッケージ
- **patchright==1.55.2**: ブラウザ自動化
- **python-dotenv==1.0.0**: 環境設定
- `.venv`に自動インストール

### データ保存

```
~/.claude/skills/notebooklm/data/
├── library.json       - ノートブックライブラリ（メタデータ）
├── auth_info.json     - 認証ステータス
└── browser_state/     - ブラウザCookieとセッション
```

**セキュリティ**: `data/` ディレクトリは`.gitignore`で保護。絶対にgitコミットしない。

### セッションモデル

ステートレスモデル:
- 各質問ごとに新しいブラウザを開く
- 質問して回答を取得して閉じる
- ノートブックライブラリは永続化
- フォローアップ機構: 各回答に「Is that ALL you need?」を含めてClaudeに追加質問を促す

## 制限事項

### スキル固有
- **ローカルClaude Codeのみ** — Web UIでは動作しない
- **セッション非永続** — 各質問は独立
- **フォローアップコンテキストなし** — 「前の回答」を参照できない

### NotebookLM
- **レート制限** — 無料枠には日次クエリ上限あり
- **手動アップロード必要** — ドキュメントはNotebookLMに事前アップロード
- **共有設定必要** — ノートブックは公開共有する必要あり

## トラブルシューティング

### スキルが見つからない
```bash
ls ~/.claude/skills/notebooklm/
# SKILL.md, scripts/ 等が表示されるか確認
```

### 認証の問題
`"Reset NotebookLM authentication"` と発話

### ブラウザクラッシュ
`"Clear NotebookLM browser data"` と発話

### 依存パッケージの問題
```bash
cd ~/.claude/skills/notebooklm
rm -rf .venv
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## クレジット

[NotebookLM MCP Server](https://github.com/PleasePrompto/notebooklm-mcp)のClaude Codeスキル版。
- 両方ともPatchrightでブラウザ自動化（MCP: TypeScript、Skill: Python）
- スキル版はMCPプロトコル不要で直接Claude Codeで実行
- スキルアーキテクチャに最適化したステートレス設計
