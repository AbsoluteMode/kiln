#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP="build/FileRenamer.app"

open "$APP"
sleep 3
if pgrep -x FileRenamer >/dev/null; then
    echo "SMOKE OK: FileRenamer launched and is alive"
    osascript -e 'quit app "FileRenamer"' 2>/dev/null || pkill -x FileRenamer || true
    exit 0
else
    echo "SMOKE FAIL: FileRenamer is not running"
    exit 1
fi
