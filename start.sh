#!/usr/bin/env bash
# Start Dota Draft Assistant in the background and return the terminal.
set -euo pipefail
DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BIN="$DIR/dota-draft"

if [ ! -x "$BIN" ]; then
  echo "dota-draft binary not found next to start.sh ($BIN)" >&2
  exit 1
fi

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/dota-draft"
mkdir -p "$STATE_DIR"

if ! command -v xdg-open >/dev/null 2>&1 && ! command -v gio >/dev/null 2>&1; then
  echo "No xdg-open/gio found. The app will still start; open the URL from:" >&2
  echo "  ${XDG_CONFIG_HOME:-$HOME/.config}/DotaDraft/session.json" >&2
fi

nohup "$BIN" "$@" >>"$STATE_DIR/launcher.log" 2>&1 &
disown 2>/dev/null || true
