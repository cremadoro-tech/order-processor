#!/bin/bash
# backfill.sh — 楽天受注データ過去分一括取得
# nohupで実行することでターミナルを閉じても継続する
#
# 使用方法:
#   nohup bash scripts/rakuten-api/backfill.sh > logs/backfill.log 2>&1 &

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$SCRIPT_DIR/../logs/backfill.log"
START_DATE="${1:-2024-04-12}"
END_DATE="${2:-2026-02-28}"

echo "========================================"
echo "楽天 過去データ バックフィル開始"
echo "期間: $START_DATE 〜 $END_DATE"
echo "ログ: $LOG_FILE"
echo "PID: $$"
echo "開始時刻: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

cd "$SCRIPT_DIR"
node rakuten-api/sync.mjs --start "$START_DATE" --end "$END_DATE"

echo ""
echo "========================================"
echo "バックフィル完了: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"
