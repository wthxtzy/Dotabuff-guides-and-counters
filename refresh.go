package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const apiBase = "https://api.opendota.com/api"

type apiHero struct {
	ID            int      `json:"id"`
	Name          string   `json:"name"`
	LocalizedName string   `json:"localized_name"`
	PrimaryAttr   string   `json:"primary_attr"`
	AttackType    string   `json:"attack_type"`
	Roles         []string `json:"roles"`
	Img           string   `json:"img"`
	Icon          string   `json:"icon"`

	BaseHealth    int     `json:"base_health"`
	BaseMana      int     `json:"base_mana"`
	BaseArmor     float64 `json:"base_armor"`
	BaseAttackMin int     `json:"base_attack_min"`
	BaseAttackMax int     `json:"base_attack_max"`
	AttackRange   int     `json:"attack_range"`
	MoveSpeed     int     `json:"move_speed"`
	BaseStr       int     `json:"base_str"`
	BaseAgi       int     `json:"base_agi"`
	BaseInt       int     `json:"base_int"`
	StrGain       float64 `json:"str_gain"`
	AgiGain       float64 `json:"agi_gain"`
	IntGain       float64 `json:"int_gain"`

	PubPick int `json:"pub_pick"`
	PubWin  int `json:"pub_win"`
	ProPick int `json:"pro_pick"`
	ProWin  int `json:"pro_win"`
	ProBan  int `json:"pro_ban"`

	P1Pick int `json:"1_pick"`
	P1Win  int `json:"1_win"`
	P2Pick int `json:"2_pick"`
	P2Win  int `json:"2_win"`
	P3Pick int `json:"3_pick"`
	P3Win  int `json:"3_win"`
	P4Pick int `json:"4_pick"`
	P4Win  int `json:"4_win"`
	P5Pick int `json:"5_pick"`
	P5Win  int `json:"5_win"`
	P6Pick int `json:"6_pick"`
	P6Win  int `json:"6_win"`
	P7Pick int `json:"7_pick"`
	P7Win  int `json:"7_win"`
	P8Pick int `json:"8_pick"`
	P8Win  int `json:"8_win"`
}

type apiMatchup struct {
	HeroID      int `json:"hero_id"`
	GamesPlayed int `json:"games_played"`
	Wins        int `json:"wins"`
}

type RefreshStatus struct {
	Running         bool   `json:"running"`
	Phase           string `json:"phase"`
	Done            int    `json:"done"`
	Total           int    `json:"total"`
	Current         string `json:"current,omitempty"`
	Error           string `json:"error,omitempty"`
	Message         string `json:"message,omitempty"`
	StartedAt       string `json:"startedAt,omitempty"`
	FinishedAt      string `json:"finishedAt,omitempty"`
	DataGeneratedAt string `json:"dataGeneratedAt,omitempty"`
}

type Refresher struct {
	mu       sync.Mutex
	running  bool
	status   RefreshStatus
	dataset  *atomic.Pointer[Dataset]
	cacheDir string
	client   *http.Client
}

func NewRefresher(dataset *atomic.Pointer[Dataset], cacheDir string) *Refresher {
	return &Refresher{
		dataset:  dataset,
		cacheDir: cacheDir,
		client:   &http.Client{Timeout: 70 * time.Second},
	}
}

func (r *Refresher) Snapshot() RefreshStatus {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.status
}

func (r *Refresher) Start() (RefreshStatus, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.running {
		return r.status, false
	}
	r.running = true
	r.status = RefreshStatus{
		Running:   true,
		Phase:     "heroes",
		StartedAt: time.Now().UTC().Format(time.RFC3339),
	}
	status := r.status
	go r.run()
	return status, true
}

func (r *Refresher) setStatus(fn func(*RefreshStatus)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	fn(&r.status)
}

func (r *Refresher) finish(err error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.running = false
	r.status.Running = false
	r.status.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	if err != nil {
		r.status.Phase = "error"
		r.status.Error = err.Error()
		return
	}
	r.status.Phase = "done"
	r.status.Error = ""
	r.status.Current = ""
}

func (r *Refresher) run() {
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Minute)
	defer cancel()
	err := r.refresh(ctx)
	if err != nil {
		log.Printf("refresh failed: %v", err)
	}
	r.finish(err)
}

func (r *Refresher) refresh(ctx context.Context) error {
	log.Printf("refreshing dataset from OpenDota")
	var heroes []apiHero
	if err := r.getJSON(ctx, apiBase+"/heroStats", &heroes); err != nil {
		return fmt.Errorf("hero stats: %w", err)
	}
	if len(heroes) < 20 {
		return fmt.Errorf("unexpected hero count: %d", len(heroes))
	}
	// Stable order makes the progress bar and retries predictable.
	sortAPIHeroes(heroes)

	patch := ""
	var patches []struct {
		Name string `json:"name"`
	}
	if err := r.getJSON(ctx, apiBase+"/constants/patch", &patches); err == nil && len(patches) > 0 {
		patch = patches[len(patches)-1].Name
	}

	r.setStatus(func(s *RefreshStatus) {
		s.Phase = "matchups"
		s.Total = len(heroes)
		s.Done = 0
	})

	now := time.Now().UTC().Format(time.RFC3339)
	hd := HeroDoc{
		Schema:      2,
		GeneratedAt: now,
		Patch:       patch,
		Source:      "OpenDota public matches",
		Attribution: dataAttribution,
		Heroes:      make([]Hero, 0, len(heroes)),
	}
	pairs := make(map[string][][3]int, len(heroes))
	known := make(map[int]bool, len(heroes))
	for _, h := range heroes {
		known[h.ID] = true
	}

	totalPairs := 0
	for index, h := range heroes {
		if err := ctx.Err(); err != nil {
			return err
		}
		r.setStatus(func(s *RefreshStatus) {
			s.Done = index
			s.Current = h.LocalizedName
		})
		var rows []apiMatchup
		endpoint := fmt.Sprintf("%s/heroes/%d/matchups", apiBase, h.ID)
		if err := r.getJSON(ctx, endpoint, &rows); err != nil {
			return fmt.Errorf("matchups for %s: %w", h.LocalizedName, err)
		}
		heroPairs := make([][3]int, 0, len(rows))
		for _, row := range rows {
			if row.HeroID <= 0 || row.HeroID == h.ID || !known[row.HeroID] || row.GamesPlayed <= 0 {
				continue
			}
			if row.Wins < 0 {
				continue
			}
			heroPairs = append(heroPairs, [3]int{row.HeroID, row.GamesPlayed, row.Wins})
		}
		pairs[strconv.Itoa(h.ID)] = heroPairs
		totalPairs += len(heroPairs)

		brackets := make([][2]int, 8)
		brackets[0] = [2]int{h.P1Pick, h.P1Win}
		brackets[1] = [2]int{h.P2Pick, h.P2Win}
		brackets[2] = [2]int{h.P3Pick, h.P3Win}
		brackets[3] = [2]int{h.P4Pick, h.P4Win}
		brackets[4] = [2]int{h.P5Pick, h.P5Win}
		brackets[5] = [2]int{h.P6Pick, h.P6Win}
		brackets[6] = [2]int{h.P7Pick, h.P7Win}
		brackets[7] = [2]int{h.P8Pick, h.P8Win}
		highPick := h.P6Pick + h.P7Pick
		highWin := h.P6Win + h.P7Win

		hd.Heroes = append(hd.Heroes, Hero{
			ID:        h.ID,
			Key:       strings.TrimPrefix(h.Name, "npc_dota_hero_"),
			Name:      h.LocalizedName,
			Attr:      h.PrimaryAttr,
			Attack:    h.AttackType,
			Roles:     h.Roles,
			Img:       fmt.Sprintf("heroes/%d.webp", h.ID),
			Icon:      fmt.Sprintf("heroes/icons/%d.webp", h.ID),
			RemoteImg: "https://cdn.cloudflare.steamstatic.com" + strings.TrimSuffix(h.Img, "?"),
			Pub:       WinStat{Picks: h.PubPick, Wins: h.PubWin},
			High:      WinStat{Picks: highPick, Wins: highWin},
			Pro:       ProStat{Picks: h.ProPick, Wins: h.ProWin, Bans: h.ProBan},
			Brackets:  brackets,
			Base: BaseStat{
				HP: h.BaseHealth, Mana: h.BaseMana, Armor: h.BaseArmor,
				AttackMin: h.BaseAttackMin, AttackMax: h.BaseAttackMax,
				Range: h.AttackRange, Speed: h.MoveSpeed,
				Str: h.BaseStr, Agi: h.BaseAgi, Int: h.BaseInt,
				StrGain: h.StrGain, AgiGain: h.AgiGain, IntGain: h.IntGain,
			},
		})

		if index != len(heroes)-1 {
			if err := sleepCtx(ctx, 1150*time.Millisecond); err != nil {
				return err
			}
		}
	}

	r.setStatus(func(s *RefreshStatus) {
		s.Phase = "saving"
		s.Done = len(heroes)
		s.Current = ""
	})
	md := MatchupDoc{Schema: 2, GeneratedAt: now, Pairs: pairs}
	meta := MetaInfo{
		Schema:        2,
		GeneratedAt:   now,
		Patch:         patch,
		Source:        "OpenDota public matches",
		TotalMatchups: totalPairs,
		Heroes:        len(hd.Heroes),
	}
	positionsB, err := dataFS.ReadFile("data/positions.json")
	if err != nil {
		return err
	}
	heroesB, err := json.Marshal(hd)
	if err != nil {
		return err
	}
	matchupsB, err := json.Marshal(md)
	if err != nil {
		return err
	}
	metaB, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	ds, err := parseDataset(heroesB, matchupsB, metaB, positionsB, "OpenDota live refresh")
	if err != nil {
		return fmt.Errorf("build refreshed dataset: %w", err)
	}
	if r.cacheDir != "" {
		if err := ds.writeCache(r.cacheDir); err != nil {
			log.Printf("could not persist refreshed dataset: %v", err)
			r.setStatus(func(s *RefreshStatus) {
				s.Message = "Data updated in memory, but the cache could not be written: " + err.Error()
			})
		}
	}
	r.dataset.Store(ds)
	r.mu.Lock()
	r.status.DataGeneratedAt = ds.Meta.GeneratedAt
	r.mu.Unlock()
	log.Printf("refresh complete: %d heroes, %d matchup rows, generated %s", len(ds.Heroes), ds.Meta.TotalMatchups, ds.Meta.GeneratedAt)
	return nil
}

func sortAPIHeroes(heroes []apiHero) {
	// Insertion sort is fine for ~130 rows and avoids pulling in another import
	// just for a one-off deterministic order.
	for i := 1; i < len(heroes); i++ {
		for j := i; j > 0 && heroes[j].ID < heroes[j-1].ID; j-- {
			heroes[j], heroes[j-1] = heroes[j-1], heroes[j]
		}
	}
}

func (r *Refresher) getJSON(ctx context.Context, endpoint string, out any) error {
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return err
		}
		req.Header.Set("User-Agent", "DotaDraftAssistant/2.0 (+https://github.com/wthxtzy/Dotabuff-guides-and-counters)")
		req.Header.Set("Accept", "application/json")
		resp, err := r.client.Do(req)
		if err != nil {
			lastErr = err
			if err := sleepCtx(ctx, backoff(attempt)); err != nil {
				return err
			}
			continue
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			if err := sleepCtx(ctx, backoff(attempt)); err != nil {
				return err
			}
			continue
		}
		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("HTTP %d from %s", resp.StatusCode, endpoint)
			delay := backoff(attempt)
			if ra := resp.Header.Get("Retry-After"); ra != "" {
				if secs, err := strconv.Atoi(ra); err == nil && secs > 0 && secs < 120 {
					delay = time.Duration(secs) * time.Second
				}
			}
			if err := sleepCtx(ctx, delay); err != nil {
				return err
			}
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("HTTP %d from %s", resp.StatusCode, endpoint)
		}
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("decode %s: %w", endpoint, err)
		}
		return nil
	}
	if lastErr == nil {
		lastErr = errors.New("unknown error")
	}
	return lastErr
}

func sleepCtx(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func backoff(attempt int) time.Duration {
	d := time.Duration(1<<uint(attempt)) * time.Second
	if d > 30*time.Second {
		d = 30 * time.Second
	}
	return d
}
