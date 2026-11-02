package main

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

const priorGames = 80.0

type RecommendRequest struct {
	Role    int    `json:"role"`
	Allies  []int  `json:"allies"`
	Enemies []int  `json:"enemies"`
	Preset  string `json:"preset"`
}

type WeightSet struct {
	Counter float64 `json:"counter"`
	Meta    float64 `json:"meta"`
	Synergy float64 `json:"synergy"`
	Role    float64 `json:"role"`
}

type ScoreComponents struct {
	Counter float64 `json:"counter"`
	Meta    float64 `json:"meta"`
	Synergy float64 `json:"synergy"`
	Role    float64 `json:"role"`
}

type Reason struct {
	Code   string  `json:"code"`
	HeroID int     `json:"heroId,omitempty"`
	Value  float64 `json:"value,omitempty"`
}

type MatchupDelta struct {
	HeroID  int     `json:"heroId"`
	Delta   float64 `json:"delta"`
	Games   int     `json:"games"`
	WinRate float64 `json:"winRate"`
}

type CounterInfo struct {
	AvgDelta   float64       `json:"avgDelta"`
	LaneDelta  *float64      `json:"laneDelta,omitempty"`
	Best       *MatchupDelta `json:"best,omitempty"`
	Worst      *MatchupDelta `json:"worst,omitempty"`
	Games      int           `json:"games"`
	Confidence float64       `json:"confidence"`
	LaneTarget int           `json:"laneTarget,omitempty"`
}

type MetaInfoForHero struct {
	WinRate float64 `json:"winRate"`
	Delta   float64 `json:"delta"`
	Picks   int     `json:"picks"`
	Source  string  `json:"source"`
}

type RoleInfo struct {
	Fit     float64 `json:"fit"`
	Primary int     `json:"primary"`
}

type Recommendation struct {
	HeroID     int             `json:"heroId"`
	Score      float64         `json:"score"`
	Grade      string          `json:"grade"`
	Components ScoreComponents `json:"components"`
	Reasons    []Reason        `json:"reasons"`
	Counter    CounterInfo     `json:"counter"`
	Meta       MetaInfoForHero `json:"meta"`
	Role       RoleInfo        `json:"role"`
}

type LaneAssignment struct {
	HeroID     int     `json:"heroId"`
	Role       int     `json:"role"`
	Confidence float64 `json:"confidence"`
}

type TeamNeed struct {
	Key       string  `json:"key"`
	Have      int     `json:"have"`
	Target    float64 `json:"target"`
	Fulfilled float64 `json:"fulfilled"`
}

type TeamAnalysis struct {
	Counts map[string]int `json:"counts"`
	Needs  []TeamNeed     `json:"needs"`
	Notes  []Reason       `json:"notes"`
}

type RolePick struct {
	HeroID int     `json:"heroId"`
	Score  float64 `json:"score"`
	Grade  string  `json:"grade"`
}

type RoleBlock struct {
	Role  int        `json:"role"`
	Best  []RolePick `json:"best"`
	Worst []RolePick `json:"worst"`
}

type RecommendResponse struct {
	Role            int              `json:"role"`
	Preset          string           `json:"preset"`
	Weights         WeightSet        `json:"weights"`
	LaneMap         []LaneAssignment `json:"laneMap"`
	Team            TeamAnalysis     `json:"team"`
	Recommendations []Recommendation `json:"recommendations"`
	Roles           []RoleBlock      `json:"roles"`
	ServerTime      string           `json:"serverTime"`
}

type scorer struct {
	ds      *Dataset
	role    int
	allies  []*Hero
	enemies []*Hero
	lanes   map[int]int
	weights WeightSet
}

var needSpecs = []struct {
	Key    string
	Target float64
	Weight float64
	Tag    string
	Save   bool
}{
	{"initiation", 1.5, 0.20, "Initiator", false},
	{"disable", 2.0, 0.20, "Disabler", false},
	{"frontline", 1.0, 0.18, "Durable", false},
	{"damage", 2.0, 0.16, "Nuker", false},
	{"save", 1.0, 0.12, "", true},
	{"scaling", 1.0, 0.08, "Carry", false},
	{"push", 0.7, 0.06, "Pusher", false},
}

func Recommend(ds *Dataset, req RecommendRequest) (*RecommendResponse, error) {
	if req.Role < 1 || req.Role > 5 {
		req.Role = 1
	}
	preset := strings.ToLower(strings.TrimSpace(req.Preset))
	if preset == "" {
		preset = "balanced"
	}
	if _, ok := presets[preset]; !ok {
		preset = "balanced"
	}
	allies, err := resolveTeam(ds, req.Allies, "ally")
	if err != nil {
		return nil, err
	}
	enemies, err := resolveTeam(ds, req.Enemies, "enemy")
	if err != nil {
		return nil, err
	}
	seen := make(map[int]bool, len(allies)+len(enemies))
	for _, h := range allies {
		seen[h.ID] = true
	}
	for _, h := range enemies {
		if seen[h.ID] {
			return nil, fmt.Errorf("%s is already on the other team", h.Name)
		}
		seen[h.ID] = true
	}

	lanes := assignEnemyLanes(ds, enemies)
	weights := weightsFor(preset, len(enemies) > 0, len(allies) > 0)
	base := &scorer{ds: ds, allies: allies, enemies: enemies, lanes: lanes, weights: weights}

	candidates := make([]*Hero, 0, len(ds.Heroes))
	for _, h := range ds.Heroes {
		if !seen[h.ID] {
			candidates = append(candidates, h)
		}
	}

	roleResults := make(map[int][]Recommendation, 5)
	for role := 1; role <= 5; role++ {
		viable := viableForRole(candidates, role)
		s := *base
		s.role = role
		recs := make([]Recommendation, 0, len(viable))
		for _, h := range viable {
			recs = append(recs, s.evaluate(h))
		}
		sort.SliceStable(recs, func(i, j int) bool {
			if recs[i].Score == recs[j].Score {
				a, b := ds.hero(recs[i].HeroID), ds.hero(recs[j].HeroID)
				return strings.ToLower(a.Name) < strings.ToLower(b.Name)
			}
			return recs[i].Score > recs[j].Score
		})
		roleResults[role] = recs
	}

	main := roleResults[req.Role]
	mainRecs := main
	if len(mainRecs) > 6 {
		mainRecs = mainRecs[:6]
	}

	roles := make([]RoleBlock, 0, 5)
	for role := 1; role <= 5; role++ {
		recs := roleResults[role]
		bestN := 3
		worstN := 2
		if len(recs) < bestN+worstN {
			if len(recs) <= worstN {
				worstN = 0
			}
			if len(recs)-worstN < bestN {
				bestN = len(recs) - worstN
			}
		}
		if bestN < 0 {
			bestN = 0
		}
		block := RoleBlock{Role: role, Best: []RolePick{}, Worst: []RolePick{}}
		for _, rec := range recs[:bestN] {
			block.Best = append(block.Best, RolePick{HeroID: rec.HeroID, Score: rec.Score, Grade: rec.Grade})
		}
		if worstN > 0 && len(recs) > bestN {
			tail := recs[len(recs)-worstN:]
			for _, rec := range tail {
				block.Worst = append(block.Worst, RolePick{HeroID: rec.HeroID, Score: rec.Score, Grade: rec.Grade})
			}
		}
		roles = append(roles, block)
	}

	team := analyzeTeam(allies)
	lanemap := make([]LaneAssignment, 0, len(enemies))
	for _, e := range enemies {
		role, ok := lanes[e.ID]
		if !ok {
			continue
		}
		lanemap = append(lanemap, LaneAssignment{HeroID: e.ID, Role: role, Confidence: round2(e.Pos[role-1])})
	}
	sort.Slice(lanemap, func(i, j int) bool { return lanemap[i].Role < lanemap[j].Role })

	return &RecommendResponse{
		Role:            req.Role,
		Preset:          preset,
		Weights:         weights,
		LaneMap:         lanemap,
		Team:            team,
		Recommendations: mainRecs,
		Roles:           roles,
		ServerTime:      time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func resolveTeam(ds *Dataset, ids []int, side string) ([]*Hero, error) {
	if len(ids) > 5 {
		return nil, fmt.Errorf("too many %ss (%d)", side, len(ids))
	}
	seen := make(map[int]bool, len(ids))
	heroes := make([]*Hero, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, fmt.Errorf("invalid hero id %d", id)
		}
		if seen[id] {
			return nil, fmt.Errorf("duplicate hero id %d", id)
		}
		seen[id] = true
		h := ds.hero(id)
		if h == nil {
			return nil, fmt.Errorf("unknown hero id %d", id)
		}
		heroes = append(heroes, h)
	}
	return heroes, nil
}

func viableForRole(candidates []*Hero, role int) []*Hero {
	threshold := 0.20
	filter := func(limit float64) []*Hero {
		out := make([]*Hero, 0, len(candidates))
		for _, h := range candidates {
			if h.Pos[role-1] >= limit {
				out = append(out, h)
			}
		}
		return out
	}
	out := filter(threshold)
	if len(out) >= 8 {
		return out
	}
	if out = filter(0.12); len(out) >= 5 {
		return out
	}
	if out = filter(0.05); len(out) >= 3 {
		return out
	}
	// Last resort: all heroes, sorted by role fit by the caller's score.
	return filter(0)
}

func assignEnemyLanes(ds *Dataset, enemies []*Hero) map[int]int {
	type pair struct {
		heroID int
		role   int
		weight float64
	}
	pairs := make([]pair, 0, len(enemies)*5)
	for _, e := range enemies {
		for role := 1; role <= 5; role++ {
			if e.Pos[role-1] > 0 {
				pairs = append(pairs, pair{heroID: e.ID, role: role, weight: e.Pos[role-1]})
			}
		}
	}
	sort.SliceStable(pairs, func(i, j int) bool {
		if pairs[i].weight == pairs[j].weight {
			if pairs[i].role == pairs[j].role {
				return pairs[i].heroID < pairs[j].heroID
			}
			return pairs[i].role < pairs[j].role
		}
		return pairs[i].weight > pairs[j].weight
	})
	lanes := make(map[int]int, len(enemies))
	usedHero := make(map[int]bool, len(enemies))
	usedRole := make(map[int]bool, 5)
	for _, p := range pairs {
		if usedHero[p.heroID] || usedRole[p.role] {
			continue
		}
		lanes[p.heroID] = p.role
		usedHero[p.heroID] = true
		usedRole[p.role] = true
	}
	// Flexible drafts can leave a role empty; fill the leftovers with the best
	// remaining (possibly low-confidence) assignment.
	for _, e := range enemies {
		if usedHero[e.ID] {
			continue
		}
		bestRole := 0
		bestWeight := -1.0
		for role := 1; role <= 5; role++ {
			if usedRole[role] {
				continue
			}
			if e.Pos[role-1] > bestWeight {
				bestWeight = e.Pos[role-1]
				bestRole = role
			}
		}
		if bestRole != 0 {
			lanes[e.ID] = bestRole
			usedRole[bestRole] = true
			usedHero[e.ID] = true
		}
	}
	_ = ds
	return lanes
}

func (s *scorer) evaluate(h *Hero) Recommendation {
	counter, counterScore := s.counterScore(h)
	meta, metaScore := metaScore(h)
	synergy, needReasons, bestAlly := s.synergyScore(h)
	roleFit := h.Pos[s.role-1]
	roleScore := clamp(roleFit*100, 0, 100)

	total := s.weights.Counter*counterScore +
		s.weights.Meta*metaScore +
		s.weights.Synergy*synergy +
		s.weights.Role*roleScore
	total = clamp(total, 0, 100)

	reasons := make([]Reason, 0, 6)
	if counter.LaneDelta != nil && *counter.LaneDelta >= 1.0 && counter.LaneTarget != 0 {
		reasons = append(reasons, Reason{Code: "lane_counter", HeroID: counter.LaneTarget, Value: round1(*counter.LaneDelta)})
	}
	if counter.Best != nil && counter.Best.Delta >= 1.2 && counter.Best.HeroID != counter.LaneTarget {
		reasons = append(reasons, Reason{Code: "counter", HeroID: counter.Best.HeroID, Value: round1(counter.Best.Delta)})
	}
	reasons = append(reasons, needReasons...)
	if meta.Delta >= 0.7 {
		reasons = append(reasons, Reason{Code: "meta_good", Value: round1(meta.WinRate)})
	} else if meta.Delta <= -0.7 {
		reasons = append(reasons, Reason{Code: "meta_bad", Value: round1(meta.WinRate)})
	}
	if bestAlly != 0 {
		reasons = append(reasons, Reason{Code: "synergy_ally", HeroID: bestAlly})
	}
	if roleFit >= 0.7 {
		reasons = append(reasons, Reason{Code: "role_fit", Value: round1(roleFit * 100)})
	}
	if roleFit < 0.4 {
		reasons = append(reasons, Reason{Code: "off_role", Value: round1(roleFit * 100)})
	}
	if counter.Worst != nil && counter.Worst.Delta <= -2.0 {
		reasons = append(reasons, Reason{Code: "risky", HeroID: counter.Worst.HeroID, Value: round1(counter.Worst.Delta)})
	}
	if len(s.enemies) > 0 && counter.Games < 250 {
		reasons = append(reasons, Reason{Code: "low_data", Value: float64(counter.Games)})
	}
	if len(reasons) == 0 {
		reasons = append(reasons, Reason{Code: "solid_pick"})
	}
	if len(reasons) > 4 {
		reasons = reasons[:4]
	}

	grade := gradeFor(total)
	return Recommendation{
		HeroID: h.ID,
		Score:  round1(total),
		Grade:  grade,
		Components: ScoreComponents{
			Counter: round1(counterScore),
			Meta:    round1(metaScore),
			Synergy: round1(synergy),
			Role:    round1(roleScore),
		},
		Reasons: reasons,
		Counter: counter,
		Meta:    meta,
		Role:    RoleInfo{Fit: round2(roleFit), Primary: h.PrimaryPos},
	}
}

func (s *scorer) counterScore(h *Hero) (CounterInfo, float64) {
	info := CounterInfo{}
	if len(s.enemies) == 0 {
		return info, 50
	}
	sumW := 0.0
	sumDelta := 0.0
	sumConf := 0.0
	withData := 0
	laneSet := make(map[int]bool)
	if s.role <= 3 {
		for id, role := range s.lanes {
			if role == s.role {
				if e := s.ds.hero(id); e != nil && e.Pos[role-1] >= 0.1 {
					laneSet[id] = true
				}
			}
		}
	} else {
		for id, role := range s.lanes {
			if role == 4 || role == 5 {
				if e := s.ds.hero(id); e != nil && e.Pos[role-1] >= 0.1 {
					laneSet[id] = true
				}
			}
		}
	}

	laneW, laneSum := 0.0, 0.0
	laneBestDelta := -1e9
	laneBestID := 0
	for _, e := range s.enemies {
		delta, wr, games, ok := s.pairDelta(h, e)
		if !ok {
			continue
		}
		withData++
		conf := float64(games) / (float64(games) + priorGames)
		w := 0.35 + conf
		sumW += w
		sumDelta += delta * w
		sumConf += conf
		info.Games += games
		md := &MatchupDelta{HeroID: e.ID, Delta: round1(delta), Games: games, WinRate: round1(wr)}
		if info.Best == nil || delta > info.Best.Delta {
			info.Best = md
		}
		if info.Worst == nil || delta < info.Worst.Delta {
			info.Worst = md
		}
		if laneSet[e.ID] {
			laneW += w
			laneSum += delta * w
			if delta > laneBestDelta {
				laneBestDelta = delta
				laneBestID = e.ID
			}
		}
	}
	if sumW == 0 {
		return info, 50
	}
	info.AvgDelta = round1(sumDelta / sumW)
	info.Confidence = round2(sumConf / float64(withData))

	combined := sumDelta / sumW
	if laneW > 0 {
		laneDelta := laneSum / laneW
		info.LaneDelta = floatPtr(round1(laneDelta))
		info.LaneTarget = laneBestID
		combined = 0.55*combined + 0.45*laneDelta
	}
	score := 50 + combined*7.2
	if info.Worst != nil && info.Worst.Delta < -2.5 {
		score -= clamp((-info.Worst.Delta-2.5)*1.6, 0, 9)
	}
	if info.Best != nil && info.Best.Delta > 4 {
		score += clamp((info.Best.Delta-4)*1.1, 0, 5)
	}
	return info, clamp(score, 0, 100)
}

func (s *scorer) pairDelta(candidate, enemy *Hero) (delta, wr float64, games int, ok bool) {
	st, found := s.ds.matchup(candidate.ID, enemy.ID)
	if !found || st.Games <= 0 {
		return 0, 0, 0, false
	}
	wins := st.Wins
	if wins < 0 || wins > st.Games {
		return 0, 0, 0, false
	}
	expected := s.expectedWinRate(candidate, enemy)
	wr = (float64(wins) + priorGames*expected) / (float64(st.Games) + priorGames)
	delta = (wr - expected) * 100
	return delta, wr * 100, st.Games, true
}

func (s *scorer) expectedWinRate(candidate, enemy *Hero) float64 {
	c := heroStrength(candidate)
	e := heroStrength(enemy)
	p := 1 / (1 + math.Exp(-(c - e)))
	return clamp(p, 0.25, 0.75)
}

func heroStrength(h *Hero) float64 {
	picks, wins := h.High.Picks, h.High.Wins
	if picks < 250 {
		picks, wins = h.Pub.Picks, h.Pub.Wins
	}
	if picks <= 0 {
		return 0
	}
	p := (float64(wins) + 400*0.5) / (float64(picks) + 400)
	p = clamp(p, 0.35, 0.65)
	return math.Log(p / (1 - p))
}

func metaScore(h *Hero) (MetaInfoForHero, float64) {
	picks, wins := h.High.Picks, h.High.Wins
	source := "Ancient+Divine"
	if picks < 250 {
		picks, wins = h.Pub.Picks, h.Pub.Wins
		source = "public"
	}
	wr := 50.0
	if picks > 0 {
		wr = 100 * (float64(wins) + 400*0.5) / (float64(picks) + 400)
	}
	delta := wr - 50
	score := clamp(50+delta*8, 0, 100)
	return MetaInfoForHero{
		WinRate: round1(wr),
		Delta:   round1(delta),
		Picks:   picks,
		Source:  source,
	}, score
}

func (s *scorer) synergyScore(h *Hero) (float64, []Reason, int) {
	if len(s.allies) == 0 {
		return 50, nil, 0
	}
	counts := teamCounts(s.allies)
	fills := 0.0
	reasons := make([]Reason, 0, 3)
	for _, need := range needSpecs {
		have := counts[need.Key]
		deficit := 1 - math.Min(1, float64(have)/need.Target)
		if deficit <= 0 {
			continue
		}
		satisfies := false
		if need.Save {
			satisfies = h.Save
		} else if need.Tag != "" {
			satisfies = h.hasRole(need.Tag)
		}
		if satisfies {
			fills += deficit * need.Weight
			if deficit >= 0.5 && need.Weight >= 0.1 {
				reasons = append(reasons, Reason{Code: "need_" + need.Key})
			}
		}
	}
	needsScore := clamp(45+fills*100, 0, 100)

	pair := 50.0
	bestAlly := 0
	bestBonus := 0.0
	for _, a := range s.allies {
		bonus := 0.0
		if a.hasRole("Initiator") && (h.hasRole("Nuker") || h.hasRole("Disabler")) {
			bonus += 7
		}
		if a.hasRole("Durable") && h.isSupport() {
			bonus += 6
		}
		if a.isCarry() && h.isSupport() {
			bonus += 5
		}
		if h.isCarry() && a.Save {
			bonus += 5
		}
		if a.isCarry() && h.isCarry() {
			bonus -= 8
		}
		if a.hasRole("Pusher") && h.hasRole("Pusher") {
			bonus += 2
		}
		if a.hasRole("Initiator") && h.hasRole("Initiator") {
			bonus += 2
		}
		pair += bonus
		if bonus > bestBonus {
			bestBonus = bonus
			bestAlly = a.ID
		}
	}
	pair = clamp(pair, 0, 100)
	synergy := 0.65*needsScore + 0.35*pair
	if bestBonus < 5 {
		bestAlly = 0
	}
	if len(reasons) > 2 {
		reasons = reasons[:2]
	}
	return round1(synergy), reasons, bestAlly
}

func teamCounts(allies []*Hero) map[string]int {
	counts := map[string]int{
		"initiation": 0,
		"disable":    0,
		"frontline":  0,
		"damage":     0,
		"save":       0,
		"scaling":    0,
		"push":       0,
		"carry":      0,
		"support":    0,
	}
	for _, h := range allies {
		if h.hasRole("Initiator") {
			counts["initiation"]++
		}
		if h.hasRole("Disabler") {
			counts["disable"]++
		}
		if h.hasRole("Durable") {
			counts["frontline"]++
		}
		if h.hasRole("Nuker") {
			counts["damage"]++
		}
		if h.Save {
			counts["save"]++
		}
		if h.hasRole("Carry") {
			counts["scaling"]++
			counts["carry"]++
		}
		if h.hasRole("Pusher") {
			counts["push"]++
		}
		if h.isSupport() {
			counts["support"]++
		}
	}
	return counts
}

func analyzeTeam(allies []*Hero) TeamAnalysis {
	counts := teamCounts(allies)
	team := TeamAnalysis{Counts: counts, Needs: make([]TeamNeed, 0, len(needSpecs)), Notes: []Reason{}}
	for _, need := range needSpecs {
		have := counts[need.Key]
		fulfilled := math.Min(1, float64(have)/need.Target)
		team.Needs = append(team.Needs, TeamNeed{
			Key:       need.Key,
			Have:      have,
			Target:    need.Target,
			Fulfilled: round2(fulfilled),
		})
		if len(allies) == 0 {
			continue
		}
		if have == 0 && len(team.Notes) < 4 {
			team.Notes = append(team.Notes, Reason{Code: "missing_" + need.Key})
		}
	}
	for _, need := range needSpecs {
		if counts[need.Key] >= int(math.Ceil(need.Target)) && len(team.Notes) < 5 {
			team.Notes = append(team.Notes, Reason{Code: "have_" + need.Key})
		}
		if len(team.Notes) >= 5 {
			break
		}
	}
	return team
}

func gradeFor(score float64) string {
	switch {
	case score >= 72:
		return "S"
	case score >= 65:
		return "A"
	case score >= 58:
		return "B"
	case score >= 51:
		return "C"
	default:
		return "D"
	}
}

var presets = map[string]WeightSet{
	"balanced": {Counter: 0.42, Meta: 0.20, Synergy: 0.23, Role: 0.15},
	"counters": {Counter: 0.60, Meta: 0.12, Synergy: 0.13, Role: 0.15},
	"meta":     {Counter: 0.18, Meta: 0.50, Synergy: 0.17, Role: 0.15},
	"comfort":  {Counter: 0.32, Meta: 0.23, Synergy: 0.15, Role: 0.30},
}

func weightsFor(preset string, hasEnemies, hasAllies bool) WeightSet {
	w, ok := presets[preset]
	if !ok {
		w = presets["balanced"]
	}
	if !hasEnemies {
		w.Counter = 0
	}
	if !hasAllies {
		// Synergy is a flat 50 before allies are added, so let meta/role speak.
		w.Synergy *= 0.4
	}
	sum := w.Counter + w.Meta + w.Synergy + w.Role
	if sum <= 0 {
		return presets["balanced"]
	}
	w.Counter = round2(w.Counter / sum)
	w.Meta = round2(w.Meta / sum)
	w.Synergy = round2(w.Synergy / sum)
	w.Role = round2(w.Role / sum)
	return w
}

func floatPtr(v float64) *float64 { return &v }
