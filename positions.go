package main

import "strings"

// saveHeroes lists heroes whose kit can reliably rescue a teammate. OpenDota's
// role tags have no "save" category, so this small curated set is used by the
// composition heuristic (and is easy to audit/update).
var saveHeroes = map[string]bool{
	"abaddon":             true,
	"bane":                false, // nightmare is a disable, not a reliable save
	"chen":                true,
	"dazzle":              true,
	"disruptor":           true, // glimpse/field can save, situationally
	"earth_spirit":        true,
	"elder_titan":         false,
	"io":                  true,
	"keeper_of_the_light": true,
	"marci":               true,
	"omniknight":          true,
	"oracle":              true,
	"phoenix":             false,
	"rubick":              false,
	"shadow_demon":        true,
	"snapfire":            true,
	"treant":              true,
	"tusk":                true,
	"vengefulspirit":      true,
	"winter_wyvern":       true,
}

// heuristicPositions is the fallback for a hero added by a data refresh before
// the curated position map has been updated. It is intentionally conservative.
func heuristicPositions(h *Hero) [5]float64 {
	var p [5]float64
	roles := stringsSet(h.Roles)
	if roles["carry"] {
		p[0] += 0.45
	}
	if roles["nuker"] {
		p[1] += 0.20
	}
	if roles["initiator"] || roles["durable"] {
		p[2] += 0.50
	}
	if roles["support"] {
		p[3] += 0.25
		p[4] += 0.45
	}
	if roles["disabler"] {
		p[3] += 0.10
	}
	// A hero with no useful tags still needs a valid distribution.
	sum := 0.0
	for _, w := range p {
		sum += w
	}
	if sum == 0 {
		p[1] = 0.5
		p[2] = 0.5
		return p
	}
	for i := range p {
		p[i] /= sum
	}
	return p
}

func stringsSet(values []string) map[string]bool {
	out := make(map[string]bool, len(values))
	for _, v := range values {
		out[strings.ToLower(v)] = true
	}
	return out
}
