#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"
APP="build/Calculator.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/Calculator" "$APP/Contents/MacOS/Calculator"
cp Resources/Info.plist "$APP/Contents/Info.plist"

# Ad-hoc sign (no Developer ID). No rpath fixup — no embedded frameworks.
codesign --force --sign - --entitlements Resources/Calculator.entitlements "$APP"
codesign --verify --verbose "$APP"
echo "Built $APP"
