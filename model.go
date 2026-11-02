package main

import (
	"math"
	"strings"
)

// Hero is both the on-disk seed representation and the object served to the
// browser. Pairs deliberately live in a separate document: a fresh page load
// only needs hero metadata, while the matchup matrix stays in the Go process.
type Hero struct {
	ID        int      `json:"id"`
	Key       string   `json:"key"`
	Name      string   `json:"name"`
	Attr      string   `json:"attr"`
	Attack    string   `json:"attack"`
	Roles     []string `json:"roles"`
	Img       string   `json:"img"`
	Icon      string   `json:"icon"`
	RemoteImg string   `json:"remoteImg"`
	Pub       WinStat  `json:"pub"`
	High      WinStat  `json:"high"`
	Pro       ProStat  `json:"pro"`
	Brackets  [][2]int `json:"brackets"`
	Base      BaseStat `json:"base"`

	// Computed at load time.
	WinRate     float64      `json:"winRate"`
	HighWinRate float64      `json:"highWinRate"`
	PickRate    float64      `json:"pickRate"`
	Pos         [5]float64   `json:"pos"`
	PrimaryPos  int          `json:"primaryPos"`
	Save        bool         `json:"save"`
	Positions   PositionInfo `json:"positions"`
}

type PositionInfo struct {
	Primary    int     `json:"primary"`
	Flex       []int   `json:"flex,omitempty"`
	Confidence float64 `json:"confidence"`
}

type WinStat struct {
	Picks     int     `json:"picks"`
	Wins      int     `json:"wins"`
	PickShare float64 `json:"pickShare,omitempty"`
}

type ProStat struct {
	Picks int `json:"picks"`
	Wins  int `json:"wins"`
	Bans  int `json:"bans"`
}

type BaseStat struct {
	HP        int     `json:"hp,omitempty"`
	Mana      int     `json:"mana,omitempty"`
	Armor     float64 `json:"armor,omitempty"`
	AttackMin int     `json:"attackMin,omitempty"`
	AttackMax int     `json:"attackMax,omitempty"`
	Range     int     `json:"range,omitempty"`
	Speed     int     `json:"speed,omitempty"`
	Str       int     `json:"str,omitempty"`
	Agi       int     `json:"agi,omitempty"`
	Int       int     `json:"int,omitempty"`
	StrGain   float64 `json:"strGain,omitempty"`
	AgiGain   float64 `json:"agiGain,omitempty"`
	IntGain   float64 `json:"intGain,omitempty"`
}

type HeroDoc struct {
	Schema      int    `json:"schema"`
	GeneratedAt string `json:"generatedAt"`
	Patch       string `json:"patch"`
	Source      string `json:"source"`
	Attribution string `json:"attribution"`
	Heroes      []Hero `json:"heroes"`
}

type MatchupDoc struct {
	Schema      int                 `json:"schema"`
	GeneratedAt string              `json:"generatedAt"`
	Pairs       map[string][][3]int `json:"pairs"`
}

type PositionsDoc struct {
	Schema    int                  `json:"schema"`
	Note      string               `json:"note"`
	Positions map[string][]float64 `json:"positions"`
}

type MetaInfo struct {
	Schema        int    `json:"schema"`
	GeneratedAt   string `json:"generatedAt"`
	Patch         string `json:"patch"`
	Source        string `json:"source"`
	TotalMatchups int    `json:"totalMatchups"`
	Heroes        int    `json:"heroes"`
}

func (h *Hero) hasRole(role string) bool {
	for _, r := range h.Roles {
		if strings.EqualFold(r, role) {
			return true
		}
	}
	return false
}

func (h *Hero) isSupport() bool {
	return h.hasRole("Support")
}

func (h *Hero) isCarry() bool {
	return h.hasRole("Carry")
}

func (h *Hero) primaryAttr() string {
	return strings.ToLower(h.Attr)
}

func (h *Hero) winRateOf(stat WinStat) float64 {
	if stat.Picks <= 0 {
		return 0
	}
	return 100 * float64(stat.Wins) / float64(stat.Picks)
}

func (h *Hero) recompute() {
	h.WinRate = round1(h.winRateOf(h.Pub))
	h.HighWinRate = round1(h.winRateOf(h.High))
	if h.High.Picks < 250 {
		h.HighWinRate = h.WinRate
	}
	h.Save = saveHeroes[h.Key]

	h.normalizePositions()
	primary := 0
	for i := 1; i < 5; i++ {
		if h.Pos[i] > h.Pos[primary] {
			primary = i
		}
	}
	h.PrimaryPos = primary + 1
	flex := make([]int, 0, 2)
	for i, w := range h.Pos {
		if i != primary && w >= 0.2 {
			flex = append(flex, i+1)
		}
	}
	h.Positions = PositionInfo{Primary: h.PrimaryPos, Flex: flex, Confidence: round2(h.Pos[primary])}
}

func (h *Hero) normalizePositions() {
	sum := 0.0
	for _, w := range h.Pos {
		if w > 0 {
			sum += w
		}
	}
	if sum <= 0 {
		hp := heuristicPositions(h)
		h.Pos = hp
		return
	}
	for i := range h.Pos {
		if h.Pos[i] < 0 {
			h.Pos[i] = 0
		}
		h.Pos[i] = round2(h.Pos[i] / sum)
	}
	// Rounding can make the sum drift a little; nudge the largest entry.
	sum = 0
	maxIdx := 0
	for i, w := range h.Pos {
		sum += w
		if w > h.Pos[maxIdx] {
			maxIdx = i
		}
	}
	if math.Abs(sum-1) > 0.001 {
		h.Pos[maxIdx] += 1 - sum
		if h.Pos[maxIdx] < 0 {
			h.Pos[maxIdx] = 0
		}
	}
}

func round1(v float64) float64 { return math.Round(v*10) / 10 }
func round2(v float64) float64 { return math.Round(v*100) / 100 }
func round0(v float64) float64 { return math.Round(v) }

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
