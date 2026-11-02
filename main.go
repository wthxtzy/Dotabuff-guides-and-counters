package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

var version = "2.0.0"

const defaultPort = 27890

type sessionFile struct {
	URL       string `json:"url"`
	Port      int    `json:"port"`
	PID       int    `json:"pid"`
	Version   string `json:"version"`
	StartedAt string `json:"startedAt"`
}

func main() {
	portFlag := flag.Int("port", defaultPort, "preferred localhost port")
	noBrowser := flag.Bool("no-browser", false, "do not open the browser automatically")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("Dota Draft Assistant", version)
		return
	}

	cfgDir, err := prepareConfigDir()
	if err != nil {
		log.Fatalf("config dir: %v", err)
	}
	logFile := setupLogging(cfgDir)
	if logFile != nil {
		defer logFile.Close()
	}
	log.Printf("Dota Draft Assistant %s starting on %s/%s", version, runtime.GOOS, runtime.GOARCH)

	if existing := findExistingInstance(*portFlag, cfgDir); existing != "" {
		log.Printf("another instance is already running at %s", existing)
		if !*noBrowser && os.Getenv("DOTA_DRAFT_NO_BROWSER") == "" {
			if err := openBrowser(existing); err != nil {
				log.Printf("could not open browser: %v", err)
			}
		}
		return
	}

	dataDir := filepath.Join(cfgDir, "data")
	ds, err := loadBestDataset(dataDir)
	if err != nil {
		log.Fatalf("load dataset: %v", err)
	}
	log.Printf("dataset: %d heroes, %d matchup rows, generated %s (%s)",
		len(ds.Heroes), ds.Meta.TotalMatchups, ds.Meta.GeneratedAt, ds.Source)

	var dsPtr atomic.Pointer[Dataset]
	dsPtr.Store(ds)

	ln, port, err := listenLocal(*portFlag)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/", port)

	shutdownCh := make(chan struct{})
	var shutdownOnce sync.Once
	shutdown := func() {
		shutdownOnce.Do(func() {
			log.Printf("shutdown requested through the web UI")
			close(shutdownCh)
		})
	}

	refresher := NewRefresher(&dsPtr, dataDir)
	app := NewApp(&dsPtr, refresher, version, port, shutdown)
	srv := &http.Server{
		Handler:           app.routes(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    32 << 10,
	}

	sess := sessionFile{
		URL:       url,
		Port:      port,
		PID:       os.Getpid(),
		Version:   version,
		StartedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := writeSession(cfgDir, sess); err != nil {
		log.Printf("could not write session file: %v", err)
	}
	defer removeSession(cfgDir, port)

	serveErr := make(chan error, 1)
	go func() {
		log.Printf("listening on %s", url)
		serveErr <- srv.Serve(ln)
	}()

	if !*noBrowser && os.Getenv("DOTA_DRAFT_NO_BROWSER") == "" {
		go func() {
			time.Sleep(250 * time.Millisecond)
			if err := openBrowser(url); err != nil {
				log.Printf("could not open browser automatically: %v (open %s manually)", err, url)
			}
		}()
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	select {
	case <-shutdownCh:
	case sig := <-sigCh:
		log.Printf("received signal %s", sig)
	case err := <-serveErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("server stopped: %v", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
		_ = srv.Close()
	}
	log.Printf("server stopped")
}

func prepareConfigDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil || base == "" {
		home, homeErr := os.UserHomeDir()
		if homeErr != nil {
			return "", fmt.Errorf("no config directory: %w", err)
		}
		base = filepath.Join(home, ".config")
	}
	dir := filepath.Join(base, "DotaDraft")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func setupLogging(dir string) *os.File {
	logPath := filepath.Join(dir, "server.log")
	if st, err := os.Stat(logPath); err == nil && st.Size() > 8<<20 {
		_ = os.Rename(logPath, logPath+".old")
	}
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		log.SetOutput(os.Stderr)
		return nil
	}
	if isTerminal() {
		log.SetOutput(io.MultiWriter(f, os.Stderr))
	} else {
		log.SetOutput(f)
	}
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds | log.Lshortfile)
	return f
}

func isTerminal() bool {
	st, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return st.Mode()&os.ModeCharDevice != 0
}

func listenLocal(preferred int) (net.Listener, int, error) {
	if preferred <= 0 || preferred > 65535 {
		preferred = defaultPort
	}
	var lastErr error
	for port := preferred; port < preferred+10 && port <= 65535; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			return ln, port, nil
		}
		lastErr = err
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, 0, fmt.Errorf("no free loopback port: %w (last error: %v)", err, lastErr)
	}
	return ln, ln.Addr().(*net.TCPAddr).Port, nil
}

func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		if err := exec.Command("xdg-open", url).Start(); err == nil {
			return nil
		}
		return exec.Command("gio", "open", url).Start()
	}
}

func findExistingInstance(preferred int, cfgDir string) string {
	if sess, err := readSession(cfgDir); err == nil && sess.URL != "" {
		if healthOK(sess.URL) {
			return sess.URL
		}
	}
	for port := preferred; port < preferred+3 && port <= 65535; port++ {
		url := fmt.Sprintf("http://127.0.0.1:%d", port)
		if healthOK(url) {
			return url
		}
	}
	return ""
}

func healthOK(base string) bool {
	client := &http.Client{Timeout: 450 * time.Millisecond}
	resp, err := client.Get(strings.TrimRight(base, "/") + "/api/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}
	var payload struct {
		App string `json:"app"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&payload); err != nil {
		return false
	}
	return payload.App == "dota-draft-assistant"
}

func writeSession(dir string, sess sessionFile) error {
	b, err := json.MarshalIndent(sess, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "session.json")
	if err := writeFileAtomic(path, append(b, '\n')); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func readSession(dir string) (sessionFile, error) {
	var sess sessionFile
	b, err := os.ReadFile(filepath.Join(dir, "session.json"))
	if err != nil {
		return sess, err
	}
	err = json.Unmarshal(b, &sess)
	return sess, err
}

func removeSession(dir string, port int) {
	sess, err := readSession(dir)
	if err != nil {
		return
	}
	if sess.Port == port && sess.PID == os.Getpid() {
		_ = os.Remove(filepath.Join(dir, "session.json"))
	}
}
