#!/bin/bash
# sync-cron.sh — 楽天RMS→BigQuery 日次同期（cron実行用ラッパー）
#
# crontab 登録例（毎日午前6時）:
#   0 6 * * * /bin/bash "/Users/emikomizukami/My WorkSpace/ai-management/scripts/rakuten-api/sync-cron.sh"

set -euo pipefail

# プロジェクトルート（ai-management/）
PROJECT_ROOT="/Users/emikomizukami/My WorkSpace/ai-management"
SCRIPT_DIR="${PROJECT_ROOT}/scripts"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/rakuten-sync-$(date +%Y-%m).log"

# ログディレクトリ作成
mkdir -p "${LOG_DIR}"

# Node.js パス（cron環境ではPATHが限定されるため明示指定）
NODE="/opt/homebrew/bin/node"

echo "========================================" >> "${LOG_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 同期開始" >> "${LOG_FILE}"
echo "========================================" >> "${LOG_FILE}"

# 同期実行（scriptsディレクトリから実行することでpackage.jsonのtypeが適用される）
cd "${SCRIPT_DIR}"
"${NODE}" rakuten-api/sync.mjs >> "${LOG_FILE}" 2>&1
EXIT_CODE=$?

if [ ${EXIT_CODE} -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 同期完了（正常終了）" >> "${LOG_FILE}"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 同期失敗（終了コード: ${EXIT_CODE}）" >> "${LOG_FILE}"
fi

echo "" >> "${LOG_FILE}"
exit ${EXIT_CODE}
