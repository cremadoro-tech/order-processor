#!/bin/bash
# auto-cleanup.sh — Desktop/Downloads/ログの自動整理
# 毎日 08:00 に launchd で実行

set -euo pipefail

LOG_DIR="$HOME/My WorkSpace/ai-management/output/logs"
ARCHIVE_DIR="$HOME/My WorkSpace/ai-management/archive"
DESKTOP="$HOME/Desktop"
DOWNLOADS="$HOME/Downloads"

# アーカイブ先を作成
mkdir -p "$ARCHIVE_DIR/desktop" "$ARCHIVE_DIR/downloads" "$ARCHIVE_DIR/logs"

DATE=$(date +%Y-%m-%d)
echo "[$DATE] auto-cleanup started"

# --- 1. Desktop: 30日超ファイルを退避 ---
count=0
while IFS= read -r -d '' file; do
  fname=$(basename "$file")
  # .DS_Store は無視
  [[ "$fname" == ".DS_Store" ]] && continue
  mv "$file" "$ARCHIVE_DIR/desktop/"
  count=$((count + 1))
done < <(find "$DESKTOP" -maxdepth 1 -not -name ".DS_Store" -not -path "$DESKTOP" -mtime +30 -print0 2>/dev/null)
echo "  Desktop: ${count} files archived"

# --- 2. Downloads: 30日超ファイルを退避 ---
count=0
while IFS= read -r -d '' file; do
  fname=$(basename "$file")
  [[ "$fname" == ".DS_Store" ]] && continue
  mv "$file" "$ARCHIVE_DIR/downloads/"
  count=$((count + 1))
done < <(find "$DOWNLOADS" -maxdepth 1 -not -name ".DS_Store" -not -path "$DOWNLOADS" -mtime +30 -print0 2>/dev/null)
echo "  Downloads: ${count} files archived"

# --- 3. output/logs: 7日超ログを圧縮退避 ---
count=0
while IFS= read -r -d '' file; do
  fname=$(basename "$file")
  gzip -c "$file" > "$ARCHIVE_DIR/logs/${fname}.gz"
  rm "$file"
  count=$((count + 1))
done < <(find "$LOG_DIR" -maxdepth 1 -name "*.log" -not -name "launchd-*.log" -mtime +7 -print0 2>/dev/null)
echo "  Logs: ${count} files compressed & archived"

echo "[$DATE] auto-cleanup completed"
