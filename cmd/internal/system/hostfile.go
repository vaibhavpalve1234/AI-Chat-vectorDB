package system

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

var hostsPath = defaultHostsPath()

const marker = "# slim"

func defaultHostsPath() string {
	if runtime.GOOS == "windows" {
		systemRoot := os.Getenv("SystemRoot")
		if systemRoot == "" {
			systemRoot = "C:\\Windows"
		}
		return filepath.Join(systemRoot, "System32", "drivers", "etc", "hosts")
	}
	return "/etc/hosts"
}

// HostsPath returns the host file path used by this OS.
func HostsPath() string {
	return hostsPath
}

var (
	readFileHostFn          = os.ReadFile
	writeFileElevatedHostFn = writeFileElevated
)

func AddHost(name string) error {
	entry := fmt.Sprintf("127.0.0.1 %s %s", name, marker)

	content, err := readFileHostFn(hostsPath)
	if err != nil {
		return fmt.Errorf("reading hosts file: %w", err)
	}

	if HasMarkedEntry(string(content), name) {
		return nil
	}

	updated := strings.TrimRight(string(content), "\n") + "\n" + entry + "\n"
	return writeFileElevatedHostFn(hostsPath, updated)
}

func RemoveHost(name string) error {
	content, err := readFileHostFn(hostsPath)
	if err != nil {
		return fmt.Errorf("reading hosts file: %w", err)
	}

	lines := strings.Split(string(content), "\n")
	var filtered []string
	for _, line := range lines {
		if lineHasHost(line, name) && strings.Contains(line, marker) {
			continue
		}
		filtered = append(filtered, line)
	}

	return writeFileElevatedHostFn(hostsPath, strings.Join(filtered, "\n"))
}

func RemoveAllHosts() error {
	content, err := readFileHostFn(hostsPath)
	if err != nil {
		return fmt.Errorf("reading hosts file: %w", err)
	}

	lines := strings.Split(string(content), "\n")
	var filtered []string
	for _, line := range lines {
		if strings.Contains(line, marker) {
			continue
		}
		filtered = append(filtered, line)
	}

	return writeFileElevatedHostFn(hostsPath, strings.Join(filtered, "\n"))
}

func HasMarkedEntry(content, hostname string) bool {
	for _, line := range strings.Split(content, "\n") {
		if lineHasHost(line, hostname) && strings.Contains(line, marker) {
			return true
		}
	}
	return false
}

func lineHasHost(line, hostname string) bool {
	for _, field := range strings.Fields(line) {
		if field == hostname {
			return true
		}
	}
	return false
}
