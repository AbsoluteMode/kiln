#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP="build/Calculator.app"

open "$APP"
sleep 3
if pgrep -x Calculator >/dev/null; then
    echo "SMOKE OK: Calculator launched and is alive"
    osascript -e 'quit app "Calculator"' 2>/dev/null || pkill -x Calculator || true
    exit 0
else
    echo "SMOKE FAIL: Calculator is not running"
    exit 1
fi
