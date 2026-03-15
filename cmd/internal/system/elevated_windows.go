//go:build windows
// +build windows

package system

import (
	"os"
)

// writeFileElevated on Windows just attempts to write the file directly.
// If the process isn't running elevated, it will return a permission error.
func writeFileElevated(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}
