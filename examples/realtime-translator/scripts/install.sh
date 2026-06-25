#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Build the signed .app, then install it into /Applications so it opens like any
# normal Mac app (Spotlight / Launchpad / Finder). The stable "Sidekey Dev" signature
# means Screen Recording permission carries over and is not asked again.
./scripts/build-app.sh

DEST="/Applications/RealtimeTranslator.app"
osascript -e 'quit app "RealtimeTranslator"' 2>/dev/null || true
[ -d "$DEST" ] && rm -rf "$DEST"
cp -R build/RealtimeTranslator.app "$DEST"

echo "Installed → $DEST"
echo "Open it from Spotlight (Cmd-Space → \"Realtime Translator\") or Launchpad."
echo "It runs in the menu bar — click the 🗣️ icon, then \"Старт перевода\"."
