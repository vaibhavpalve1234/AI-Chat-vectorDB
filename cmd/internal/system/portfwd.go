package system

type PortForwarder interface {
	Enable() error
	Disable() error
	IsEnabled() bool
	IsLoaded() bool
	EnsureLoaded() error
}
