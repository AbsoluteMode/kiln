#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"
APP="build/FileRenamer.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/FileRenamer" "$APP/Contents/MacOS/FileRenamer"
cp Resources/Info.plist "$APP/Contents/Info.plist"

# Ad-hoc sign (no Developer ID). No rpath fixup needed — no embedded frameworks.
codesign --force --sign - --entitlements Resources/FileRenamer.entitlements "$APP"
codesign --verify --verbose "$APP"
echo "Built $APP"
