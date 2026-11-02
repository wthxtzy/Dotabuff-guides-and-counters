# Build self-contained Dota Draft Assistant binaries for Windows and Linux.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$Version = if ($env:VERSION) { $env:VERSION } else { "2.0.0" }
$Out = if ($env:OUT) { $env:OUT } else { "dist" }
$Common = "-s -w -X main.version=$Version"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
  throw "Go is required: https://go.dev/dl/"
}

Write-Host "==> tests" -ForegroundColor Cyan
go test ./...

if (Get-Command node -ErrorAction SilentlyContinue) {
  node --check web/app.js
}

$targets = @(
  @{ os = "linux";   arch = "amd64"; name = "dota-draft";             gui = $false },
  @{ os = "linux";   arch = "arm64"; name = "dota-draft";             gui = $false },
  @{ os = "windows"; arch = "amd64"; name = "DotaDraftAssistant.exe"; gui = $true  },
  @{ os = "windows"; arch = "arm64"; name = "DotaDraftAssistant.exe"; gui = $true  }
)

foreach ($target in $targets) {
  $dir = Join-Path $Out "$($target.os)-$($target.arch)"
  New-Item -ItemType Directory -Force $dir | Out-Null
  Write-Host "==> $($target.os)/$($target.arch)" -ForegroundColor Cyan
  $env:CGO_ENABLED = "0"
  $env:GOOS = $target.os
  $env:GOARCH = $target.arch
  $ldflags = $Common
  if ($target.gui) { $ldflags = "$ldflags -H=windowsgui" }
  go build -trimpath -buildvcs=false -ldflags $ldflags -o (Join-Path $dir $target.name) .
}

foreach ($arch in @("amd64", "arm64")) {
  $dir = Join-Path $Out "linux-$arch"
  Copy-Item start.sh, install-desktop.sh, README-DIST.txt, web/dota-draft.png $dir -Force
  Move-Item (Join-Path $dir "README-DIST.txt") (Join-Path $dir "README.txt") -Force
}
foreach ($arch in @("amd64", "arm64")) {
  $dir = Join-Path $Out "windows-$arch"
  Copy-Item README-DIST.txt, web/dota-draft.png $dir -Force
  Move-Item (Join-Path $dir "README-DIST.txt") (Join-Path $dir "README.txt") -Force
  Compress-Archive -Path (Join-Path $dir "*") -DestinationPath (Join-Path $Out "dota-draft-windows-$arch.zip") -Force
}

Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue

Get-ChildItem $Out -Filter "dota-draft-windows-*.zip" | ForEach-Object {
  $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
  "$hash  $($_.Name)" | Add-Content (Join-Path $Out "SHA256SUMS.txt")
}

Write-Host "`nDone. Binaries are in $Out/" -ForegroundColor Green
