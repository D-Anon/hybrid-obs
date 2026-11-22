#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
platform=$(uname -s)
case "$platform" in
  MINGW*|MSYS*|CYGWIN*) MSYS2_ARG_CONV_EXCL="*" cmd.exe /c Setup-and-Start.cmd; exit ;;
  Darwin)
    # Finder-launched terminals can have a shorter PATH than interactive shells.
    export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
    ;;
  Linux) ;;
  *) echo "Unsupported platform: $platform"; exit 1 ;;
esac
available() {
  case "$1" in
    node) node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' >/dev/null 2>&1 ;;
    mkcert) mkcert -version >/dev/null 2>&1 ;;
    obs)
      command -v obs >/dev/null ||
        [[ "$platform" == Darwin && ( -x /Applications/OBS.app/Contents/MacOS/OBS || -x "$HOME/Applications/OBS.app/Contents/MacOS/OBS" ) ]] ||
        { command -v flatpak >/dev/null && flatpak info com.obsproject.Studio >/dev/null 2>&1; } ||
        { command -v snap >/dev/null && snap list obs-studio >/dev/null 2>&1; }
      ;;
    certutil) command -v certutil >/dev/null ;;
  esac
}
items=(node mkcert obs)
if [[ "$platform" == Linux ]]; then items+=(certutil); fi
missing=()
for item in "${items[@]}"; do
  if available "$item"; then echo "[Ready] $item"; else echo "[Needs installation or update] $item"; missing+=("$item"); fi
done
if (( ${#missing[@]} )); then
  if [[ "$platform" == Darwin ]]; then
    command -v brew >/dev/null || { echo "Install Homebrew or the listed programs, then rerun setup."; exit 1; }
    for item in "${missing[@]}"; do
      if [[ "$item" == obs ]]; then brew install --cask obs; else brew install "$item"; fi
    done
  else
    elevate=()
    if (( EUID != 0 )); then elevate=(sudo); fi
    if command -v apt-get >/dev/null; then manager=apt-get; nss=libnss3-tools
    elif command -v dnf >/dev/null; then manager=dnf; nss=nss-tools
    else echo "Install the listed programs using your distribution's package manager and run setup again."; exit 1; fi
    packages=()
    for item in "${missing[@]}"; do
      case "$item" in
        node) packages+=(nodejs) ;;
        obs) packages+=(obs-studio) ;;
        certutil) packages+=("$nss") ;;
        *) packages+=("$item") ;;
      esac
    done
    if [[ "$manager" == apt-get ]]; then "${elevate[@]}" apt-get update; fi
    "${elevate[@]}" "$manager" install -y "${packages[@]}"
  fi
  hash -r
  for item in "${missing[@]}"; do
    if ! available "$item"; then echo "[Failed] $item is still unavailable or incompatible. Check the installation and PATH, then rerun setup."; exit 1; fi
    echo "[Verified] $item"
  done
fi
exec node setup.js
