#!/usr/bin/env bash
# Add Dota Draft Assistant to the Linux application menu.
set -euo pipefail
DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICON="$DIR/dota-draft.png"
mkdir -p "$APPS"

cat > "$APPS/dota-draft-assistant.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Dota Draft Assistant
Comment=Dota 2 draft helper with live hero recommendations
Exec="$DIR/start.sh"
Icon="$ICON"
Terminal=false
Categories=Game;Utility;
StartupNotify=false
EOF
chmod +x "$APPS/dota-draft-assistant.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" >/dev/null 2>&1 || true
echo "Installed: $APPS/dota-draft-assistant.desktop"
echo "You can now launch Dota Draft Assistant from your application menu."
