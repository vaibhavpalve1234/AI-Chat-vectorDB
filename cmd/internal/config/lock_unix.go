//go:build !windows
// +build !windows

package config

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

// WithLock executes fn while holding an exclusive file lock on the config directory.
// This prevents concurrent processes from writing to the config file at the same time.
func WithLock(fn func() error) error {
	if err := os.MkdirAll(Dir(), 0755); err != nil {
		return fmt.Errorf("creating config dir: %w", err)
	}

	lockPath := filepath.Join(Dir(), "config.lock")
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDONLY, 0644)
	if err != nil {
		return fmt.Errorf("opening lock file: %w", err)
	}
	defer f.Close()

	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX); err != nil {
		return fmt.Errorf("acquiring config lock: %w", err)
	}
	defer func() { _ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN) }()

	return fn()
}
