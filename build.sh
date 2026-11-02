#!/usr/bin/env bash
# Build self-contained Dota Draft Assistant binaries for Windows and Linux.
set -euo pipefail

cd "$(dirname "$0")"

VERSION="${VERSION:-2.0.0}"
OUT="${OUT:-dist}"

if ! command -v go >/dev/null 2>&1; then
  echo "Go is required: https://go.dev/dl/" >&2
  exit 1
fi

echo "==> tests"
go test ./...

echo "==> web checks"
if command -v node >/dev/null 2>&1; then
  node --check web/app.js
else
  echo "node not found; skipping app.js syntax check"
fi

mkdir -p "$OUT"
rm -rf "$OUT/linux-amd64" "$OUT/linux-arm64" "$OUT/windows-amd64" "$OUT/windows-arm64"

build_target() {
  local goos="$1" goarch="$2" name="$3" ldflags="$4"
  local dir="$OUT/$goos-$goarch"
  mkdir -p "$dir"
  echo "==> $goos/$goarch -> $dir/$name"
  CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
    go build -trimpath -buildvcs=false -ldflags "$ldflags" -o "$dir/$name" .
}

COMMON="-s -w -X main.version=${VERSION}"
build_target linux amd64 dota-draft "$COMMON"
build_target linux arm64 dota-draft "$COMMON"
build_target windows amd64 DotaDraftAssistant.exe "$COMMON -H=windowsgui"
build_target windows arm64 DotaDraftAssistant.exe "$COMMON -H=windowsgui"

for target in linux-amd64 linux-arm64; do
  cp start.sh "$OUT/$target/start.sh"
  cp install-desktop.sh "$OUT/$target/install-desktop.sh"
  cp README-DIST.txt "$OUT/$target/README.txt"
  cp web/dota-draft.png "$OUT/$target/dota-draft.png"
  chmod +x "$OUT/$target/start.sh" "$OUT/$target/install-desktop.sh" "$OUT/$target/dota-draft"
done
for target in windows-amd64 windows-arm64; do
  cp README-DIST.txt "$OUT/$target/README.txt"
  cp web/dota-draft.png "$OUT/$target/dota-draft.png"
done

echo "==> archives"
( cd "$OUT/linux-amd64" && tar -czf ../dota-draft-linux-amd64.tar.gz . )
( cd "$OUT/linux-arm64" && tar -czf ../dota-draft-linux-arm64.tar.gz . )
if command -v zip >/dev/null 2>&1; then
  ( cd "$OUT/windows-amd64" && zip -qr ../dota-draft-windows-amd64.zip . )
  ( cd "$OUT/windows-arm64" && zip -qr ../dota-draft-windows-arm64.zip . )
else
  echo "zip not found; Windows folders were built but archives were skipped"
fi

if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$OUT" && sha256sum *.tar.gz *.zip 2>/dev/null > SHA256SUMS.txt || true )
fi

echo
echo "Done. Binaries are in $OUT/"
find "$OUT" -maxdepth 2 -type f \( -name 'dota-draft' -o -name 'DotaDraftAssistant.exe' -o -name '*.tar.gz' -o -name '*.zip' \) -printf '  %p (%s bytes)\n' | sort
