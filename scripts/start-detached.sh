#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/output/logs"
RUN_LOG="$LOG_DIR/macos-launch.log"
PID_FILE="$LOG_DIR/macos-launch.pid"
NO_AUTO_OPEN_VALUE="${NO_AUTO_OPEN:-1}"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

chmod +x ./start.sh

if [ "${MJ_FACTORY_DRY_RUN:-0}" = "1" ]; then
    echo "Dry run: would execute NO_AUTO_OPEN=$NO_AUTO_OPEN_VALUE nohup ./start.sh >>$RUN_LOG 2>&1 &"
    exit 0
fi

NO_AUTO_OPEN="$NO_AUTO_OPEN_VALUE" nohup ./start.sh >>"$RUN_LOG" 2>&1 &
APP_PID=$!
echo "$APP_PID" >"$PID_FILE"

echo "Started Midjourney Factory (PID: $APP_PID)"
echo "Log: $RUN_LOG"
