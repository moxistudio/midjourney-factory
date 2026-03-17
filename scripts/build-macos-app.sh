#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-Midjourney Factory}"
OUTPUT_DIR="${1:-$ROOT_DIR/output/app}"
APP_DIR="$OUTPUT_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
EXECUTABLE_NAME="midjourney-factory-launcher"
LAUNCH_SCRIPT="$ROOT_DIR/scripts/start-detached.sh"
RUN_LOG="$ROOT_DIR/output/logs/macos-launch.log"
ICON_INPUT="${APP_ICON_PATH:-${2:-}}"
ICON_OUTPUT_NAME="AppIcon.icns"
ICON_OUTPUT_PATH="$RESOURCES_DIR/$ICON_OUTPUT_NAME"
ICON_PLIST_BLOCK=""

build_icon() {
  local input_path="$1"
  if [ -z "$input_path" ]; then
    return 0
  fi

  if [ ! -f "$input_path" ]; then
    echo "Icon file not found: $input_path"
    exit 1
  fi

  case "${input_path##*.}" in
    icns|ICNS)
      cp "$input_path" "$ICON_OUTPUT_PATH"
      ;;
    png|PNG|jpg|JPG|jpeg|JPEG|tiff|TIFF)
      if ! command -v sips >/dev/null 2>&1 || ! command -v iconutil >/dev/null 2>&1; then
        echo "sips and iconutil are required to convert image icons on macOS."
        exit 1
      fi

      local iconset_dir
      iconset_dir="$(mktemp -d /tmp/mj_factory_iconset.XXXXXX)"

      sips -z 16 16 "$input_path" --out "$iconset_dir/icon_16x16.png" >/dev/null
      sips -z 32 32 "$input_path" --out "$iconset_dir/icon_16x16@2x.png" >/dev/null
      sips -z 32 32 "$input_path" --out "$iconset_dir/icon_32x32.png" >/dev/null
      sips -z 64 64 "$input_path" --out "$iconset_dir/icon_32x32@2x.png" >/dev/null
      sips -z 128 128 "$input_path" --out "$iconset_dir/icon_128x128.png" >/dev/null
      sips -z 256 256 "$input_path" --out "$iconset_dir/icon_128x128@2x.png" >/dev/null
      sips -z 256 256 "$input_path" --out "$iconset_dir/icon_256x256.png" >/dev/null
      sips -z 512 512 "$input_path" --out "$iconset_dir/icon_256x256@2x.png" >/dev/null
      sips -z 512 512 "$input_path" --out "$iconset_dir/icon_512x512.png" >/dev/null
      sips -z 1024 1024 "$input_path" --out "$iconset_dir/icon_512x512@2x.png" >/dev/null

      iconutil -c icns "$iconset_dir" -o "$ICON_OUTPUT_PATH"
      rm -rf "$iconset_dir"
      ;;
    *)
      echo "Unsupported icon format: $input_path"
      echo "Use .icns, .png, .jpg, .jpeg, or .tiff"
      exit 1
      ;;
  esac

  ICON_PLIST_BLOCK=$(cat <<EOF
    <key>CFBundleIconFile</key>
    <string>$ICON_OUTPUT_NAME</string>
EOF
)
}

if [ ! -f "$LAUNCH_SCRIPT" ]; then
  echo "Launch script not found: $LAUNCH_SCRIPT"
  exit 1
fi

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
chmod +x "$LAUNCH_SCRIPT"
build_icon "$ICON_INPUT"

cat >"$CONTENTS_DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleExecutable</key>
    <string>$EXECUTABLE_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.viamons.midjourney-factory.launcher</string>
${ICON_PLIST_BLOCK}
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
  </dict>
</plist>
EOF

cat >"$MACOS_DIR/$EXECUTABLE_NAME" <<EOF
#!/bin/bash
set -euo pipefail

ROOT_DIR="$ROOT_DIR"

"$LAUNCH_SCRIPT"

if command -v osascript >/dev/null 2>&1; then
  osascript -e 'display notification "Midjourney Factory is starting." with title "$APP_NAME"' >/dev/null 2>&1 || true
fi
EOF

chmod +x "$MACOS_DIR/$EXECUTABLE_NAME"

echo "Created: $APP_DIR"
if [ -n "$ICON_INPUT" ]; then
  echo "Icon: $ICON_OUTPUT_PATH"
fi
echo "Launch log: $RUN_LOG"
