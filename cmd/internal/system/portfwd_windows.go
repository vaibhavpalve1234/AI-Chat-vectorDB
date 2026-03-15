//go:build windows
// +build windows

package system

// windowsPortFwd is a no-op implementation of PortForwarder for Windows.
// The upstream tool currently only supports port forwarding setup on macOS/Linux.
// This implementation exists so the project can build on Windows.

type windowsPortFwd struct{}

func NewPortForwarder() PortForwarder {
	return &windowsPortFwd{}
}

func (w *windowsPortFwd) Enable() error       { return nil }
func (w *windowsPortFwd) Disable() error      { return nil }
func (w *windowsPortFwd) IsEnabled() bool     { return false }
func (w *windowsPortFwd) IsLoaded() bool      { return false }
func (w *windowsPortFwd) EnsureLoaded() error { return nil }
