#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-dir}"
ICON_PATH="${APP_ICON_PATH:-}"
ICON_ASSET="$ROOT_DIR/build-assets/icon.icns"
BUILD_TARGET="$TARGET"
ELECTRON_BUILDER_BIN="$ROOT_DIR/node_modules/.bin/electron-builder"

cd "$ROOT_DIR"

npm --prefix modules/commander run build

if [ -n "$ICON_PATH" ]; then
  "$ROOT_DIR/scripts/prepare-desktop-icon.sh" "$ICON_PATH"
fi

if [ "$TARGET" = "zip" ]; then
  BUILD_TARGET="dir"
fi

ARGS=(--mac "$BUILD_TARGET" --publish never)

if [ -f "$ICON_ASSET" ]; then
  ARGS+=("-c.mac.icon=$ICON_ASSET")
fi

"$ELECTRON_BUILDER_BIN" "${ARGS[@]}"

PRODUCT_NAME="$(node -p "require('./package.json').build.productName")"
ARCH="$(node -p "process.arch")"

if [ "$TARGET" = "zip" ]; then
  VERSION="$(node -p "require('./package.json').version")"
  APP_PATH="$ROOT_DIR/dist/mac-$ARCH/$PRODUCT_NAME.app"
  ZIP_PATH="$ROOT_DIR/dist/$PRODUCT_NAME-$VERSION-$ARCH-mac.zip"

  if [ ! -d "$APP_PATH" ]; then
    echo "App bundle not found: $APP_PATH"
    exit 1
  fi

  rm -f "$ZIP_PATH"
  rm -f "$ZIP_PATH.blockmap"
  ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"
  echo "Created desktop zip: $ZIP_PATH"
fi
