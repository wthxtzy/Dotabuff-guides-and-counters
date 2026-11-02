package main

import "embed"

// The whole UI and the offline seed dataset are compiled into the binary, so
// the executable is completely self-contained (no node/python runtime).
//
//go:embed all:web
var webFS embed.FS

//go:embed data/heroes.json data/matchups.json data/meta.json data/positions.json
var dataFS embed.FS
