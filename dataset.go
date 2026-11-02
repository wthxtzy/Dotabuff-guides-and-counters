package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Matchup struct {
	Games int
	Wins  int
}

type Dataset struct {
	Heroes    []*Hero
	ByID      map[int]*Hero
	ByKey     map[string]*Hero
	Matchups  map[int]map[int]Matchup
	Positions map[string][5]float64
	Meta      MetaInfo
	Source    string
	LoadedAt  time.Time
}

const dataAttribution = "Data: OpenDota (odota.ai) · portraits: Valve / Steam CDN · Dotabuff and Stratz are linked as external guides"

func loadSeedDataset() (*Dataset, error) {
	read := func(name string) ([]byte, error) {
		return dataFS.ReadFile("data/" + name)
	}
	heroesB, err := read("heroes.json")
	if err != nil {
		return nil, fmt.Errorf("read embedded heroes: %w", err)
	}
	matchupsB, err := read("matchups.json")
	if err != nil {
		return nil, fmt.Errorf("read embedded matchups: %w", err)
	}
	metaB, err := read("meta.json")
	if err != nil {
		return nil, fmt.Errorf("read embedded meta: %w", err)
	}
	positionsB, err := read("positions.json")
	if err != nil {
		return nil, fmt.Errorf("read embedded positions: %w", err)
	}
	return parseDataset(heroesB, matchupsB, metaB, positionsB, "embedded seed")
}

func loadCachedDataset(dir string) (*Dataset, error) {
	read := func(name string) ([]byte, error) {
		return os.ReadFile(filepath.Join(dir, name))
	}
	heroesB, err := read("heroes.json")
	if err != nil {
		return nil, err
	}
	matchupsB, err := read("matchups.json")
	if err != nil {
		return nil, err
	}
	metaB, err := read("meta.json")
	if err != nil {
		return nil, err
	}
	positionsB, err := dataFS.ReadFile("data/positions.json")
	if err != nil {
		return nil, err
	}
	return parseDataset(heroesB, matchupsB, metaB, positionsB, "user cache")
}

func parseDataset(heroesB, matchupsB, metaB, positionsB []byte, source string) (*Dataset, error) {
	var hd HeroDoc
	if err := json.Unmarshal(heroesB, &hd); err != nil {
		return nil, fmt.Errorf("parse heroes: %w", err)
	}
	if len(hd.Heroes) < 20 {
		return nil, fmt.Errorf("hero dataset is too small (%d)", len(hd.Heroes))
	}
	var md MatchupDoc
	if err := json.Unmarshal(matchupsB, &md); err != nil {
		return nil, fmt.Errorf("parse matchups: %w", err)
	}
	var meta MetaInfo
	if err := json.Unmarshal(metaB, &meta); err != nil {
		return nil, fmt.Errorf("parse meta: %w", err)
	}
	var pd PositionsDoc
	if len(positionsB) > 0 {
		if err := json.Unmarshal(positionsB, &pd); err != nil {
			return nil, fmt.Errorf("parse positions: %w", err)
		}
	}

	ds := &Dataset{
		ByID:      make(map[int]*Hero, len(hd.Heroes)),
		ByKey:     make(map[string]*Hero, len(hd.Heroes)),
		Matchups:  make(map[int]map[int]Matchup, len(hd.Heroes)),
		Positions: make(map[string][5]float64, len(pd.Positions)),
		Meta:      meta,
		Source:    source,
		LoadedAt:  time.Now(),
	}
	if ds.Meta.GeneratedAt == "" {
		ds.Meta.GeneratedAt = hd.GeneratedAt
	}
	if ds.Meta.Patch == "" {
		ds.Meta.Patch = hd.Patch
	}
	if ds.Meta.Source == "" {
		ds.Meta.Source = hd.Source
	}
	for key, raw := range pd.Positions {
		var pos [5]float64
		for i := 0; i < 5 && i < len(raw); i++ {
			if raw[i] > 0 {
				pos[i] = raw[i]
			}
		}
		ds.Positions[key] = pos
	}

	totalPub := 0
	for i := range hd.Heroes {
		totalPub += hd.Heroes[i].Pub.Picks
	}
	for i := range hd.Heroes {
		h := &hd.Heroes[i]
		if h.ID <= 0 || h.Key == "" || h.Name == "" {
			return nil, fmt.Errorf("invalid hero row: %+v", *h)
		}
		if h.Pub.PickShare == 0 && totalPub > 0 {
			h.Pub.PickShare = 100 * float64(h.Pub.Picks) / float64(totalPub)
		}
		h.PickRate = round2(h.Pub.PickShare)
		if pos, ok := ds.Positions[h.Key]; ok {
			h.Pos = pos
		} else {
			h.Pos = heuristicPositions(h)
		}
		h.recompute()
		ds.Heroes = append(ds.Heroes, h)
		ds.ByID[h.ID] = h
		ds.ByKey[h.Key] = h
	}
	sort.Slice(ds.Heroes, func(i, j int) bool {
		return strings.ToLower(ds.Heroes[i].Name) < strings.ToLower(ds.Heroes[j].Name)
	})

	for key, pairs := range md.Pairs {
		heroID, err := strconv.Atoi(key)
		if err != nil || ds.ByID[heroID] == nil {
			continue
		}
		m := make(map[int]Matchup, len(pairs))
		for _, pair := range pairs {
			enemy, games, wins := pair[0], pair[1], pair[2]
			if ds.ByID[enemy] == nil || enemy == heroID || games <= 0 || wins < 0 || wins > games {
				continue
			}
			m[enemy] = Matchup{Games: games, Wins: wins}
		}
		ds.Matchups[heroID] = m
	}

	// Make the matrix usable from both directions. OpenDota exposes each pair
	// once per hero, but a cached/refreshed dataset can be missing a side.
	type missing struct {
		a, b int
		st   Matchup
	}
	var fill []missing
	for a, opponents := range ds.Matchups {
		for b, st := range opponents {
			if ds.Matchups[b] == nil {
				ds.Matchups[b] = make(map[int]Matchup)
			}
			if _, ok := ds.Matchups[b][a]; !ok {
				fill = append(fill, missing{a: b, b: a, st: Matchup{Games: st.Games, Wins: st.Games - st.Wins}})
			}
		}
	}
	for _, f := range fill {
		ds.Matchups[f.a][f.b] = f.st
	}

	ds.Meta.Heroes = len(ds.Heroes)
	if ds.Meta.TotalMatchups == 0 {
		for _, m := range ds.Matchups {
			ds.Meta.TotalMatchups += len(m)
		}
	}
	if ds.Meta.GeneratedAt == "" {
		ds.Meta.GeneratedAt = time.Now().UTC().Format(time.RFC3339)
	}
	return ds, nil
}

func (ds *Dataset) matchup(a, b int) (Matchup, bool) {
	if m, ok := ds.Matchups[a]; ok {
		if st, ok := m[b]; ok {
			return st, true
		}
	}
	return Matchup{}, false
}

func (ds *Dataset) hero(id int) *Hero {
	return ds.ByID[id]
}

func (ds *Dataset) generatedTime() time.Time {
	if t, err := time.Parse(time.RFC3339, ds.Meta.GeneratedAt); err == nil {
		return t
	}
	return time.Time{}
}

// loadBestDataset prefers a user-refreshed cache, but only when it is actually
// newer than the bundled snapshot.
func loadBestDataset(cacheDir string) (*Dataset, error) {
	seed, err := loadSeedDataset()
	if err != nil {
		return nil, err
	}
	if cacheDir == "" {
		return seed, nil
	}
	cached, err := loadCachedDataset(cacheDir)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Printf("cache dataset ignored: %v", err)
		}
		return seed, nil
	}
	seedTime := seed.generatedTime()
	cacheTime := cached.generatedTime()
	if !cacheTime.IsZero() && cacheTime.After(seedTime) {
		log.Printf("using cached dataset %s (seed %s)", cached.Meta.GeneratedAt, seed.Meta.GeneratedAt)
		return cached, nil
	}
	return seed, nil
}

func (ds *Dataset) writeCache(dir string) error {
	hd := HeroDoc{
		Schema:      2,
		GeneratedAt: ds.Meta.GeneratedAt,
		Patch:       ds.Meta.Patch,
		Source:      ds.Meta.Source,
		Attribution: dataAttribution,
		Heroes:      make([]Hero, 0, len(ds.Heroes)),
	}
	for _, h := range ds.Heroes {
		hd.Heroes = append(hd.Heroes, *h)
	}
	pairs := make(map[string][][3]int, len(ds.Matchups))
	for heroID, opponents := range ds.Matchups {
		ids := make([]int, 0, len(opponents))
		for enemy := range opponents {
			ids = append(ids, enemy)
		}
		sort.Ints(ids)
		rows := make([][3]int, 0, len(ids))
		for _, enemy := range ids {
			st := opponents[enemy]
			rows = append(rows, [3]int{enemy, st.Games, st.Wins})
		}
		pairs[strconv.Itoa(heroID)] = rows
	}
	md := MatchupDoc{Schema: 2, GeneratedAt: ds.Meta.GeneratedAt, Pairs: pairs}
	meta := ds.Meta
	meta.Schema = 2
	meta.Heroes = len(ds.Heroes)
	meta.Source = ds.Source

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	files := []struct {
		name string
		doc  any
	}{
		{"heroes.json", hd},
		{"matchups.json", md},
		{"meta.json", meta},
	}
	for _, f := range files {
		var buf bytes.Buffer
		enc := json.NewEncoder(&buf)
		enc.SetEscapeHTML(false)
		if err := enc.Encode(f.doc); err != nil {
			return err
		}
		if err := writeFileAtomic(filepath.Join(dir, f.name), buf.Bytes()); err != nil {
			return err
		}
	}
	return nil
}

func writeFileAtomic(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
