#!/bin/zsh
# Builds T3 Code Custom from this checkout, signs it with this Mac's fixed
# certificate, and installs it as /Applications/T3 Code Custom.app.
#
#   scripts/custom-app/update-app.sh <name>         version <base>-custom.<name>
#   scripts/custom-app/update-app.sh --stage <dir>  sign and install a built .app in <dir>
#
# While the app is running, the new build waits and replaces it when the app
# quits. See docs/operations/custom-app.md.
set -eu

HERE="${0:A:h}"
REPO="${HERE:h:h}"
STATE="${T3CODE_CUSTOM_STATE:-$HOME/.t3code-custom}"
TARGET="/Applications/T3 Code Custom.app"
BUNDLE_ID="com.lsj8706.t3code.custom"
IDENTITY="T3 Code Custom Signing"
KEYCHAIN="$STATE/signing.keychain-db"
LABEL_PREFIX="com.lsj8706.t3code.custom-update"
UID_DOMAIN="gui/$(id -u)"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

sign_app() {
  local app="$1" log="$2"
  # codesign only finds the identity while its keychain is on the search list.
  local saved=("${(@f)$(security list-keychains -d user | sed -E 's/^ *"(.*)"$/\1/')}")
  security list-keychains -d user -s "${saved[@]}" "$KEYCHAIN"
  {
    security unlock-keychain -p "$(cat "$STATE/signing-keychain-password")" "$KEYCHAIN"
    codesign --force --deep --sign "$IDENTITY" --timestamp=none \
      --preserve-metadata=entitlements "$app" >"$log" 2>&1
  } always {
    security list-keychains -d user -s "${saved[@]}"
    security lock-keychain "$KEYCHAIN" 2>/dev/null || true
  }
  codesign --verify --deep --strict "$app"
  codesign -d -r- "$app" 2>&1 | grep -q "certificate leaf" ||
    { echo "The app is not signed with the fixed certificate." >&2; return 1; }
}

cancel_pending() {
  # A newer build replaces one still waiting for the app to quit.
  if [[ -f "$STATE/pending" ]]; then
    local label stage
    { read -r label; read -r stage; } <"$STATE/pending"
    if launchctl print "$UID_DOMAIN/$label" >/dev/null 2>&1; then
      launchctl bootout "$UID_DOMAIN/$label" || true
    fi
    if [[ "$stage" == /Applications/.t3-custom-* && -d "$stage" ]]; then rm -rf "$stage"; fi
    rm -f "$STATE/pending"
  fi
}

install_app() {
  local built="$1" work="$2"
  cancel_pending
  local stage app version pid inode label
  stage=$(mktemp -d '/Applications/.t3-custom-update.XXXXXX')
  app="$stage/T3 Code Custom.app"
  mv "$built" "$app"
  plutil -replace CFBundleDisplayName -string 'T3 Code Custom' "$app/Contents/Info.plist"
  plutil -replace CFBundleIdentifier -string "$BUNDLE_ID" "$app/Contents/Info.plist"
  sign_app "$app" "$work/sign.log"
  version=$(plutil -extract CFBundleShortVersionString raw "$app/Contents/Info.plist")
  local executable
  executable=$(plutil -extract CFBundleExecutable raw "$app/Contents/Info.plist")
  T3CODE_HOME="$work/start-test" "$app/Contents/MacOS/$executable" \
    --user-data-dir="$work/version-profile" --version >/dev/null

  if [[ ! -e "$TARGET" ]]; then
    mv "$app" "$TARGET"
    rmdir "$stage"
    "$LSREGISTER" -f "$TARGET"
    echo "Installed $version at $TARGET."
    return
  fi

  cp "$HERE/apply-update.py" "$stage/apply-update.py"
  pid=$(lsappinfo info -only pid -app "$BUNDLE_ID" | sed -nE 's/.*"pid"=([0-9]+).*/\1/p')
  inode=$(stat -f '%i' "$TARGET")
  label="$LABEL_PREFIX.$inode"
  python3 - "$stage" "$STATE/update.log" "$label" "$inode" "${pid:-0}" "$version" <<'PY'
import plistlib, sys
from pathlib import Path
stage, log, label, inode, pid, version = sys.argv[1:]
with (Path(stage) / "job.plist").open("wb") as f:
    plistlib.dump({
        "Label": label,
        "ProgramArguments": ["/usr/bin/python3", "-B", stage + "/apply-update.py", inode, pid, version],
        "RunAtLoad": True,
        "KeepAlive": False,
        "StandardErrorPath": log,
    }, f)
PY
  : >"$STATE/update.log"
  # A finished one-shot job keeps its label until removed.
  if launchctl print "$UID_DOMAIN/$label" >/dev/null 2>&1; then
    launchctl bootout "$UID_DOMAIN/$label" || true
  fi
  launchctl bootstrap "$UID_DOMAIN" "$stage/job.plist"
  printf '%s\n%s\n' "$label" "$stage" >"$STATE/pending"
  local n
  for n in {1..50}; do
    if [[ -f "$stage/waiting" || ! -d "$stage" ]]; then break; fi
    sleep 0.2
  done
  if [[ -f "$stage/waiting" ]]; then
    echo "Staged $version. Quit T3 Code Custom and open it again to switch."
  elif [[ ! -d "$stage" ]]; then
    rm -f "$STATE/pending"
    echo "Installed $version."
  else
    cat "$STATE/update.log" >&2
    return 1
  fi
}

"$HERE/setup-signing.sh" >/dev/null

if [[ "${1:-}" == "--stage" ]]; then
  built="${2:?directory holding the built .app}"
  apps=("$built"/*.app(N))
  if [[ ${#apps} -ne 1 ]]; then
    echo "Expected one .app in $built" >&2
    exit 1
  fi
  work=$(mktemp -d "$STATE/work.XXXXXX")
  install_app "${apps[1]}" "$work"
  rm -rf "$work"
  exit 0
fi

name="${1:?usage: update-app.sh <name>   (the version becomes <base>-custom.<name>)}"
if [[ ! "$name" =~ ^[a-z0-9][a-z0-9.-]*$ ]]; then
  echo "The name takes lowercase letters, digits, dots and dashes." >&2
  exit 1
fi
base=$(node -p "require('$REPO/apps/desktop/package.json').version")
version="$base-custom.$name"
work=$(mktemp -d "$STATE/work.XXXXXX")
echo "Building $version from $REPO ($(git -C "$REPO" rev-parse --short HEAD))..."
if ! (cd "$REPO" && node scripts/build-desktop-artifact.ts --platform mac --target dir \
  --arch "$(uname -m | sed 's/x86_64/x64/')" --build-version "$version" \
  --output-dir "$work/build" >"$work/package.log" 2>&1); then
  tail -20 "$work/package.log" >&2
  echo "Build failed. Log: $work/package.log" >&2
  exit 1
fi
built=("$work"/build/mac*/*.app(N))
install_app "${built[1]}" "$work"
rm -rf "$work"
