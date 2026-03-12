#!/bin/bash
# daily-report.sh
# 毎朝9時に実行: EC各サイトのデータ取得 → スプレッドシート書き込み → Slack投稿

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/../output/logs"
DATE=$(date '+%Y-%m-%d')
LOG_FILE="${LOG_DIR}/daily-report-${DATE}.log"

mkdir -p "${LOG_DIR}"

echo "=====================================" | tee -a "${LOG_FILE}"
echo "EC日報自動実行: $(date '+%Y/%m/%d %H:%M:%S')" | tee -a "${LOG_FILE}"
echo "=====================================" | tee -a "${LOG_FILE}"

# Node.js のパスを明示（cron/launchd は PATH が限られるため）
NODE="/usr/local/bin/node"

cd "${SCRIPT_DIR}"

# ── Step 1: EC各サイトのデータ取得 & スプレッドシート書き込み ──
echo "" | tee -a "${LOG_FILE}"
echo "📥 Step1: ECデータ取得中..." | tee -a "${LOG_FILE}"
if "${NODE}" ec/index.js >> "${LOG_FILE}" 2>&1; then
  echo "✅ ECデータ取得完了" | tee -a "${LOG_FILE}"
else
  echo "⚠️  ECデータ取得に一部失敗しましたが続行します" | tee -a "${LOG_FILE}"
fi

# データがスプレッドシートに反映されるまで少し待機
sleep 10

# ── Step 2: Slack日報投稿 ──
echo "" | tee -a "${LOG_FILE}"
echo "📤 Step2: Slack投稿中..." | tee -a "${LOG_FILE}"
if "${NODE}" slack-daily-report.mjs >> "${LOG_FILE}" 2>&1; then
  echo "✅ Slack投稿完了" | tee -a "${LOG_FILE}"
else
  echo "❌ Slack投稿失敗" | tee -a "${LOG_FILE}"
  exit 1
fi

echo "" | tee -a "${LOG_FILE}"
echo "🎉 日報自動実行完了: $(date '+%Y/%m/%d %H:%M:%S')" | tee -a "${LOG_FILE}"
