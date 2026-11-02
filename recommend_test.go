package main

import (
	"math"
	"testing"
)

func testHero(id int, name string, pos [5]float64, roles ...string) *Hero {
	h := &Hero{
		ID:     id,
		Key:    name,
		Name:   name,
		Attr:   "all",
		Attack: "Melee",
		Roles:  roles,
		Pos:    pos,
		Pub:    WinStat{Picks: 1000, Wins: 500},
		High:   WinStat{Picks: 1000, Wins: 500},
	}
	h.recompute()
	return h
}

func testDataset() *Dataset {
	heroes := []*Hero{
		testHero(1, "carry_a", [5]float64{1, 0, 0, 0, 0}, "Carry", "Nuker"),
		testHero(2, "carry_b", [5]float64{1, 0, 0, 0, 0}, "Carry"),
		testHero(3, "carry_c", [5]float64{1, 0, 0, 0, 0}, "Carry"),
		testHero(4, "support_a", [5]float64{0, 0, 0, 0, 1}, "Support", "Disabler"),
		testHero(5, "support_b", [5]float64{0, 0, 0, 1, 0}, "Support", "Initiator"),
		testHero(6, "enemy_off", [5]float64{0, 0, 1, 0, 0}, "Initiator", "Durable", "Disabler"),
	}
	ds := &Dataset{
		Heroes:    heroes,
		ByID:      make(map[int]*Hero, len(heroes)),
		ByKey:     make(map[string]*Hero, len(heroes)),
		Matchups:  make(map[int]map[int]Matchup),
		Positions: make(map[string][5]float64),
		Meta:      MetaInfo{GeneratedAt: "2026-01-01T00:00:00Z", Source: "test"},
	}
	for _, h := range heroes {
		ds.ByID[h.ID] = h
		ds.ByKey[h.Key] = h
	}
	ds.Matchups[1] = map[int]Matchup{6: {Games: 1000, Wins: 600}}
	ds.Matchups[2] = map[int]Matchup{6: {Games: 1000, Wins: 450}}
	ds.Matchups[3] = map[int]Matchup{6: {Games: 1000, Wins: 500}}
	return ds
}

func TestCounterRecommendation(t *testing.T) {
	ds := testDataset()
	resp, err := Recommend(ds, RecommendRequest{Role: 1, Enemies: []int{6}})
	if err != nil {
		t.Fatalf("Recommend: %v", err)
	}
	if len(resp.Recommendations) == 0 {
		t.Fatal("no recommendations")
	}
	if resp.Recommendations[0].HeroID != 1 {
		t.Fatalf("expected carry_a first, got hero %d", resp.Recommendations[0].HeroID)
	}
	if resp.Recommendations[0].Counter.AvgDelta <= 0 {
		t.Fatalf("expected positive counter delta, got %v", resp.Recommendations[0].Counter.AvgDelta)
	}
	for _, rec := range resp.Recommendations {
		if rec.Score < 0 || rec.Score > 100 {
			t.Fatalf("score out of range: %+v", rec)
		}
	}
}

func TestLaneCounterUsesSamePosition(t *testing.T) {
	ds := testDataset()
	ds.Matchups[1][6] = Matchup{Games: 1000, Wins: 620}
	ds.ByID[6].Pos = [5]float64{1, 0, 0, 0, 0}
	ds.ByID[6].PrimaryPos = 1
	resp, err := Recommend(ds, RecommendRequest{Role: 1, Enemies: []int{6}})
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.LaneMap) != 1 || resp.LaneMap[0].Role != 1 {
		t.Fatalf("expected lane role 1, got %+v", resp.LaneMap)
	}
	top := resp.Recommendations[0]
	if top.Counter.LaneDelta == nil {
		t.Fatal("expected lane delta")
	}
	if *top.Counter.LaneDelta <= 0 {
		t.Fatalf("expected positive lane delta, got %v", *top.Counter.LaneDelta)
	}
}

func TestRoleFiltering(t *testing.T) {
	ds := testDataset()
	resp, err := Recommend(ds, RecommendRequest{Role: 1, Enemies: []int{6}})
	if err != nil {
		t.Fatal(err)
	}
	for _, rec := range resp.Recommendations {
		if rec.HeroID == 4 {
			t.Fatal("position 5 support should not be in position 1 recommendations")
		}
	}
}

func TestEmptyDraft(t *testing.T) {
	ds := testDataset()
	resp, err := Recommend(ds, RecommendRequest{Role: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Recommendations) == 0 {
		t.Fatal("expected recommendations even with an empty draft")
	}
	if resp.Weights.Counter != 0 {
		t.Fatalf("counter weight should be zero without enemies: %+v", resp.Weights)
	}
}

func TestDuplicateHeroRejected(t *testing.T) {
	ds := testDataset()
	if _, err := Recommend(ds, RecommendRequest{Role: 1, Allies: []int{1}, Enemies: []int{1}}); err == nil {
		t.Fatal("expected duplicate hero error")
	}
	if _, err := Recommend(ds, RecommendRequest{Role: 1, Allies: []int{1, 2, 3, 4, 5, 6}}); err == nil {
		t.Fatal("expected too many allies error")
	}
}

func TestWeightsNormalized(t *testing.T) {
	for _, preset := range []string{"balanced", "counters", "meta", "comfort", "unknown"} {
		w := weightsFor(preset, true, true)
		sum := w.Counter + w.Meta + w.Synergy + w.Role
		if math.Abs(sum-1) > 0.02 {
			t.Fatalf("preset %s weights sum to %v: %+v", preset, sum, w)
		}
	}
}

func TestSeedDatasetLoads(t *testing.T) {
	ds, err := loadSeedDataset()
	if err != nil {
		t.Fatal(err)
	}
	if len(ds.Heroes) < 100 {
		t.Fatalf("expected the bundled hero list, got %d", len(ds.Heroes))
	}
	if len(ds.Matchups) < 100 || len(ds.Matchups[1]) == 0 {
		t.Fatal("matchup matrix is empty")
	}
	for _, h := range ds.Heroes {
		sum := 0.0
		for _, w := range h.Pos {
			sum += w
		}
		if math.Abs(sum-1) > 0.01 {
			t.Fatalf("%s positions sum to %v", h.Name, sum)
		}
	}
	resp, err := Recommend(ds, RecommendRequest{Role: 1, Enemies: []int{2, 14, 17}})
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Recommendations) == 0 || len(resp.Roles) != 5 {
		t.Fatalf("unexpected response size: recs=%d roles=%d", len(resp.Recommendations), len(resp.Roles))
	}
}
