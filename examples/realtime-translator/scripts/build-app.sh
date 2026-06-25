#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release
BIN_PATH="$(swift build -c release --show-bin-path)/RealtimeTranslator"

APP="build/RealtimeTranslator.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp Resources/Info.plist "$APP/Contents/Info.plist"
[ -f Resources/AppIcon.icns ] && cp Resources/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
cp "$BIN_PATH" "$APP/Contents/MacOS/RealtimeTranslator"

# Sign with a STABLE self-signed identity so macOS keeps the Screen Recording
# permission across rebuilds (ad-hoc changes the code hash every build and forces
# re-granting). Falls back to ad-hoc if the identity is unavailable.
SIGN_ID="${KILN_SIGN_ID:-Sidekey Dev}"
codesign --force --sign "$SIGN_ID" --entitlements Resources/RealtimeTranslator.entitlements "$APP" 2>/dev/null \
    || codesign --force --sign "$SIGN_ID" "$APP" 2>/dev/null \
    || codesign --force --sign - "$APP"

echo "Built $APP — $(codesign -dvv "$APP" 2>&1 | grep -i '^Authority=' | head -1 || echo 'Signature=adhoc')"
