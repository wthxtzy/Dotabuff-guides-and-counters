package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Source struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	URL  string `json:"url"`
}

type AppState struct {
	App             string        `json:"app"`
	Version         string        `json:"version"`
	Platform        string        `json:"platform"`
	StartedAt       string        `json:"startedAt"`
	Meta            MetaInfo      `json:"meta"`
	Heroes          []*Hero       `json:"heroes"`
	Refresh         RefreshStatus `json:"refresh"`
	Sources         []Source      `json:"sources"`
	MaxTeamSize     int           `json:"maxTeamSize"`
	DefaultPreset   string        `json:"defaultPreset"`
	ServerTime      string        `json:"serverTime"`
	ShutdownEnabled bool          `json:"shutdownEnabled"`
}

type App struct {
	dataset      *atomic.Pointer[Dataset]
	refresher    *Refresher
	version      string
	port         int
	started      time.Time
	shutdown     func()
	shutdownOnce sync.Once
}

func NewApp(dataset *atomic.Pointer[Dataset], refresher *Refresher, version string, port int, shutdown func()) *App {
	return &App{
		dataset:   dataset,
		refresher: refresher,
		version:   version,
		port:      port,
		started:   time.Now(),
		shutdown:  shutdown,
	}
}

func (a *App) datasetSnapshot() *Dataset {
	if a.dataset == nil {
		return nil
	}
	return a.dataset.Load()
}

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", a.handleHealth)
	mux.HandleFunc("GET /api/state", a.handleState)
	mux.HandleFunc("POST /api/recommend", a.handleRecommend)
	mux.HandleFunc("GET /api/refresh", a.handleRefreshStatus)
	mux.HandleFunc("POST /api/refresh", a.handleRefreshStart)
	mux.HandleFunc("POST /api/shutdown", a.handleShutdown)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "unknown API endpoint")
	})
	mux.Handle("/", a.staticHandler())
	return a.security(mux)
}

func (a *App) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{
		"app":     "dota-draft-assistant",
		"version": a.version,
		"status":  "ok",
		"pid":     os.Getpid(),
	})
}

func (a *App) handleState(w http.ResponseWriter, r *http.Request) {
	ds := a.datasetSnapshot()
	if ds == nil {
		writeError(w, http.StatusServiceUnavailable, "dataset is not loaded")
		return
	}
	state := AppState{
		App:       "dota-draft-assistant",
		Version:   a.version,
		Platform:  runtime.GOOS,
		StartedAt: a.started.UTC().Format(time.RFC3339),
		Meta:      ds.Meta,
		Heroes:    ds.Heroes,
		Refresh:   a.refresher.Snapshot(),
		Sources: []Source{
			{ID: "opendota", Name: "OpenDota", URL: "https://www.opendota.com/"},
			{ID: "dotabuff", Name: "Dotabuff", URL: "https://www.dotabuff.com/heroes"},
			{ID: "stratz", Name: "Stratz", URL: "https://stratz.com/heroes"},
			{ID: "valve", Name: "Valve / Steam CDN", URL: "https://www.dota2.com/heroes"},
		},
		MaxTeamSize:     5,
		DefaultPreset:   "balanced",
		ServerTime:      time.Now().UTC().Format(time.RFC3339),
		ShutdownEnabled: a.shutdown != nil,
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, state)
}

func (a *App) handleRecommend(w http.ResponseWriter, r *http.Request) {
	var req RecommendRequest
	if err := readJSON(w, r, &req, 64<<10); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ds := a.datasetSnapshot()
	if ds == nil {
		writeError(w, http.StatusServiceUnavailable, "dataset is not loaded")
		return
	}
	resp, err := Recommend(ds, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}

func (a *App) handleRefreshStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, a.refresher.Snapshot())
}

func (a *App) handleRefreshStart(w http.ResponseWriter, r *http.Request) {
	status, started := a.refresher.Start()
	code := http.StatusOK
	if started {
		code = http.StatusAccepted
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, code, map[string]any{
		"started": started,
		"status":  status,
	})
}

func (a *App) handleShutdown(w http.ResponseWriter, r *http.Request) {
	if a.shutdown == nil {
		writeError(w, http.StatusNotImplemented, "shutdown is not available")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	// Give the response a moment to reach the browser before the listener dies.
	go func() {
		time.Sleep(200 * time.Millisecond)
		a.shutdownOnce.Do(a.shutdown)
	}()
}

func (a *App) staticHandler() http.Handler {
	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		panic(err)
	}
	files := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		clean := path.Clean(r.URL.Path)
		if clean == "." || clean == "/" {
			clean = "/index.html"
		}
		if strings.Contains(clean, "..") {
			http.NotFound(w, r)
			return
		}
		// No SPA routing: unknown extension-less paths are 404s rather than
		// silently returning index.html (which hides typos).
		if path.Ext(clean) == "" {
			http.NotFound(w, r)
			return
		}
		if clean == "/index.html" || clean == "/app.js" || clean == "/style.css" {
			w.Header().Set("Cache-Control", "no-cache")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=86400")
		}
		if strings.HasPrefix(clean, "/heroes/") {
			w.Header().Set("Cache-Control", "public, max-age=604800, immutable")
		}
		if clean == "/index.html" {
			data, readErr := fs.ReadFile(sub, "index.html")
			if readErr != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			_, _ = w.Write(data)
			return
		}
		r2 := r.Clone(r.Context())
		r2.URL.Path = clean
		files.ServeHTTP(w, r2)
	})
}

func (a *App) security(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; img-src 'self' data: https://cdn.cloudflare.steamstatic.com; "+
				"style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; "+
				"font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
		if !isLoopbackHost(r.Host) {
			writeError(w, http.StatusForbidden, "this server only accepts loopback connections")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if r.Header.Get("X-Dota-Draft") != "1" {
				writeError(w, http.StatusForbidden, "missing request marker")
				return
			}
			if origin := r.Header.Get("Origin"); origin != "" && !isLoopbackOrigin(origin) {
				writeError(w, http.StatusForbidden, "cross-origin request rejected")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func isLoopbackHost(hostport string) bool {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	switch strings.ToLower(host) {
	case "127.0.0.1", "localhost", "::1":
		return true
	}
	return false
}

func isLoopbackOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	switch strings.ToLower(u.Hostname()) {
	case "127.0.0.1", "localhost", "::1":
		return true
	}
	return false
}

func readJSON(w http.ResponseWriter, r *http.Request, dst any, max int64) error {
	defer r.Body.Close()
	r.Body = http.MaxBytesReader(w, r.Body, max)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		var syntax *json.SyntaxError
		var typeErr *json.UnmarshalTypeError
		switch {
		case errors.As(err, &syntax):
			return fmt.Errorf("invalid JSON at byte %d", syntax.Offset)
		case errors.As(err, &typeErr):
			return fmt.Errorf("invalid field %q", typeErr.Field)
		case errors.Is(err, io.EOF):
			return errors.New("request body is empty")
		default:
			return errors.New("invalid JSON body")
		}
	}
	if dec.Decode(&struct{}{}) != io.EOF {
		return errors.New("request body must contain one JSON object")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		log.Printf("write JSON: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}
