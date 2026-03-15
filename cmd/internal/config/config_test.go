package config

import (
	"strings"
	"testing"
)

func TestNormalizeDomain(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"myapp", "myapp.test"},
		{"api", "api.test"},
		{"myapp.test", "myapp.test"},
		{"app.loc", "app.loc"},
		{"my.custom.domain", "my.custom.domain"},
		{"app.local", "app.local"},
		{"web.dev", "web.dev"},
	}

	for _, tt := range tests {
		got := NormalizeDomain(tt.input)
		if got != tt.want {
			t.Errorf("NormalizeDomain(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestLoadMigratesBareDomainNames(t *testing.T) {
	baseDir = t.TempDir()

	cfg := &Config{
		Domains: []Domain{
			{Name: "myapp", Port: 3000},
			{Name: "api", Port: 8080},
			{Name: "app.loc", Port: 9000},
		},
	}
	if err := cfg.Save(); err != nil {
		t.Fatalf("Save: %v", err)
	}

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if loaded.Domains[0].Name != "myapp.test" {
		t.Errorf("expected myapp.test, got %q", loaded.Domains[0].Name)
	}
	if loaded.Domains[1].Name != "api.test" {
		t.Errorf("expected api.test, got %q", loaded.Domains[1].Name)
	}
	if loaded.Domains[2].Name != "app.loc" {
		t.Errorf("expected app.loc (unchanged), got %q", loaded.Domains[2].Name)
	}

	reloaded, err := Load()
	if err != nil {
		t.Fatalf("Load after migration: %v", err)
	}
	if reloaded.Domains[0].Name != "myapp.test" {
		t.Errorf("expected persisted migration, got %q", reloaded.Domains[0].Name)
	}
}

func TestValidateDomain(t *testing.T) {
	tests := []struct {
		name    string
		port    int
		wantErr bool
	}{
		{"myapp", 3000, false},
		{"my-app", 8080, false},
		{"a", 1, false},
		{"abc123", 65535, false},
		{"a-b-c", 3000, false},
		{"123", 3000, false},
		{"", 3000, true},
		{"-abc", 3000, true},
		{"abc-", 3000, true},
		{"ABC", 3000, true},
		{"my_app", 3000, true},
		{"my.app", 3000, false},
		{"web.roadmap", 3000, false},
		{"a.b.c", 3000, false},
		{"my..app", 3000, true},
		{".myapp", 3000, true},
		{"myapp.", 3000, true},
		{"web.-bad", 3000, true},
		{"my app", 3000, true},
		{strings.Repeat("a", 63), 3000, false},
		{strings.Repeat("a", 64), 3000, true},
		{strings.Repeat("a", 63) + "." + strings.Repeat("b", 63), 3000, false},
		{"myapp", 0, true},
		{"myapp", -1, true},
		{"myapp", 65536, true},
	}

	for _, tt := range tests {
		err := ValidateDomain(tt.name, tt.port)
		if (err != nil) != tt.wantErr {
			t.Errorf("ValidateDomain(%q, %d) error = %v, wantErr %v", tt.name, tt.port, err, tt.wantErr)
		}
	}
}

func TestConfigLifecycle(t *testing.T) {
	baseDir = t.TempDir()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load empty: %v", err)
	}
	if len(cfg.Domains) != 0 {
		t.Fatalf("expected 0 domains, got %d", len(cfg.Domains))
	}

	if err := cfg.SetDomain("myapp.test", 3000, nil); err != nil {
		t.Fatalf("SetDomain: %v", err)
	}

	cfg, err = Load()
	if err != nil {
		t.Fatalf("Load after set: %v", err)
	}
	if len(cfg.Domains) != 1 {
		t.Fatalf("expected 1 domain, got %d", len(cfg.Domains))
	}
	if cfg.Domains[0].Name != "myapp.test" || cfg.Domains[0].Port != 3000 {
		t.Fatalf("unexpected domain: %+v", cfg.Domains[0])
	}

	d, idx := cfg.FindDomain("myapp.test")
	if d == nil || idx != 0 {
		t.Fatalf("FindDomain: got %v at %d", d, idx)
	}

	d, idx = cfg.FindDomain("nonexistent")
	if d != nil || idx != -1 {
		t.Fatalf("FindDomain nonexistent: got %v at %d", d, idx)
	}

	if err := cfg.SetDomain("myapp.test", 4000, nil); err != nil {
		t.Fatalf("SetDomain update: %v", err)
	}
	cfg, _ = Load()
	if cfg.Domains[0].Port != 4000 {
		t.Fatalf("expected port 4000, got %d", cfg.Domains[0].Port)
	}

	if err := cfg.SetDomain("api.test", 8080, nil); err != nil {
		t.Fatalf("SetDomain second: %v", err)
	}
	cfg, _ = Load()
	if len(cfg.Domains) != 2 {
		t.Fatalf("expected 2 domains, got %d", len(cfg.Domains))
	}

	if err := cfg.RemoveDomain("myapp.test"); err != nil {
		t.Fatalf("RemoveDomain: %v", err)
	}
	cfg, _ = Load()
	if len(cfg.Domains) != 1 || cfg.Domains[0].Name != "api.test" {
		t.Fatalf("unexpected domains after remove: %+v", cfg.Domains)
	}

	if err := cfg.RemoveDomain("nonexistent"); err == nil {
		t.Fatal("expected error removing nonexistent domain")
	}
}

func TestValidateRoute(t *testing.T) {
	tests := []struct {
		path    string
		port    int
		wantErr bool
	}{
		{"/api", 8080, false},
		{"/", 3000, false},
		{"/api/v1", 9000, false},
		{"", 8080, true},
		{"api", 8080, true},
		{"/api", 0, true},
		{"/api", 65536, true},
	}

	for _, tt := range tests {
		err := ValidateRoute(tt.path, tt.port)
		if (err != nil) != tt.wantErr {
			t.Errorf("ValidateRoute(%q, %d) error = %v, wantErr %v", tt.path, tt.port, err, tt.wantErr)
		}
	}
}

func TestMatchRoute(t *testing.T) {
	d := Domain{
		Name: "myapp",
		Port: 3000,
		Routes: []Route{
			{Path: "/api", Port: 8080},
			{Path: "/api/v2", Port: 9090},
			{Path: "/ws", Port: 9000},
		},
	}

	tests := []struct {
		reqPath  string
		wantPort int
	}{
		{"/", 3000},
		{"/about", 3000},
		{"/api", 8080},
		{"/api/users", 8080},
		{"/api/v2", 9090},
		{"/api/v2/items", 9090},
		{"/apikeys", 3000},
		{"/ws", 9000},
		{"/ws/chat", 9000},
	}

	for _, tt := range tests {
		got := d.MatchRoute(tt.reqPath)
		if got != tt.wantPort {
			t.Errorf("MatchRoute(%q) = %d, want %d", tt.reqPath, got, tt.wantPort)
		}
	}
}

func TestSetDomainWithRoutes(t *testing.T) {
	baseDir = t.TempDir()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	routes := []Route{{Path: "/api", Port: 8080}}
	if err := cfg.SetDomain("myapp.test", 3000, routes); err != nil {
		t.Fatalf("SetDomain with routes: %v", err)
	}

	cfg, _ = Load()
	if len(cfg.Domains[0].Routes) != 1 || cfg.Domains[0].Routes[0].Path != "/api" {
		t.Fatalf("unexpected routes: %+v", cfg.Domains[0].Routes)
	}

	if err := cfg.SetDomain("myapp.test", 3000, nil); err != nil {
		t.Fatalf("SetDomain clear routes: %v", err)
	}

	cfg, _ = Load()
	if len(cfg.Domains[0].Routes) != 0 {
		t.Fatalf("expected routes to be cleared, got %+v", cfg.Domains[0].Routes)
	}
}

func TestLogMode(t *testing.T) {
	cfg := &Config{}
	if got := cfg.EffectiveLogMode(); got != LogModeFull {
		t.Fatalf("expected default log mode %q, got %q", LogModeFull, got)
	}

	valid := []string{"", "full", "minimal", "off", " Full "}
	for _, mode := range valid {
		if err := ValidateLogMode(mode); err != nil {
			t.Fatalf("ValidateLogMode(%q) error: %v", mode, err)
		}
	}

	if err := ValidateLogMode("verbose"); err == nil {
		t.Fatal("expected error for invalid log mode")
	}
}
