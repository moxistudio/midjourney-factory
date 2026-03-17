#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICON_SOURCE="${1:-${APP_ICON_PATH:-}}"
ASSET_DIR="$ROOT_DIR/build-assets"
ICON_OUTPUT="$ASSET_DIR/icon.icns"

if [ -z "$ICON_SOURCE" ]; then
  if [ -f "$ICON_OUTPUT" ]; then
    echo "Using existing icon: $ICON_OUTPUT"
    exit 0
  fi

  echo "No icon source provided. Set APP_ICON_PATH or pass a file path."
  exit 0
fi

if [ ! -f "$ICON_SOURCE" ]; then
  echo "Icon source not found: $ICON_SOURCE"
  exit 1
fi

mkdir -p "$ASSET_DIR"

case "${ICON_SOURCE##*.}" in
  icns|ICNS)
    cp "$ICON_SOURCE" "$ICON_OUTPUT"
    ;;
  png|PNG|jpg|JPG|jpeg|JPEG|tiff|TIFF)
    if ! command -v sips >/dev/null 2>&1 || ! command -v iconutil >/dev/null 2>&1; then
      echo "sips and iconutil are required to convert image icons on macOS."
      exit 1
    fi

    TEMP_DIR="$(mktemp -d /tmp/mjfactory_iconbuild.XXXXXX)"
    ICONSET_DIR="$TEMP_DIR/AppIcon.iconset"
    mkdir -p "$ICONSET_DIR"
    trap 'rm -rf "$TEMP_DIR"' EXIT
    sips -z 16 16 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
    sips -z 32 32 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
    sips -z 32 32 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
    sips -z 64 64 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
    sips -z 128 128 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
    sips -z 256 256 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
    sips -z 256 256 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
    sips -z 512 512 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
    sips -z 512 512 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
    sips -z 1024 1024 "$ICON_SOURCE" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
    iconutil -c icns "$ICONSET_DIR" -o "$ICON_OUTPUT"
    trap - EXIT
    rm -rf "$TEMP_DIR"
    ;;
  *)
    echo "Unsupported icon format: $ICON_SOURCE"
    echo "Use .icns, .png, .jpg, .jpeg, or .tiff"
    exit 1
    ;;
esac

echo "Prepared desktop icon: $ICON_OUTPUT"
