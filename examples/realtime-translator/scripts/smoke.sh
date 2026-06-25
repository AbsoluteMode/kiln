#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP="build/RealtimeTranslator.app"

open "$APP"
sleep 3
if pgrep -x RealtimeTranslator >/dev/null; then
    echo "SMOKE OK: RealtimeTranslator launched and is alive (menu-bar agent)"
    osascript -e 'quit app "RealtimeTranslator"' 2>/dev/null || pkill -x RealtimeTranslator || true
    exit 0
else
    echo "SMOKE FAIL: RealtimeTranslator is not running"
    exit 1
fi
