//go:build windows
// +build windows

package config

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

// WithLock executes fn while holding an exclusive file lock on the config directory.
// On Windows this uses LockFileEx/UnlockFileEx.
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

	if err := lockFile(f); err != nil {
		return fmt.Errorf("acquiring config lock: %w", err)
	}
	defer func() { _ = unlockFile(f) }()

	return fn()
}

func lockFile(f *os.File) error {
	// Lock the first byte of the file.
	overlapped := &windows.Overlapped{}
	return windows.LockFileEx(windows.Handle(f.Fd()), windows.LOCKFILE_EXCLUSIVE_LOCK, 0, 1, 0, overlapped)
}

func unlockFile(f *os.File) error {
	overlapped := &windows.Overlapped{}
	return windows.UnlockFileEx(windows.Handle(f.Fd()), 0, 1, 0, overlapped)
}
