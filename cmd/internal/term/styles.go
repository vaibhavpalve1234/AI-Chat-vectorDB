package term

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"charm.land/lipgloss/v2"
)

var (
	Green   = lipgloss.NewStyle().Foreground(lipgloss.ANSIColor(2))
	Red     = lipgloss.NewStyle().Foreground(lipgloss.ANSIColor(1))
	Yellow  = lipgloss.NewStyle().Foreground(lipgloss.ANSIColor(3))
	Cyan    = lipgloss.NewStyle().Foreground(lipgloss.ANSIColor(6))
	Magenta = lipgloss.NewStyle().Foreground(lipgloss.ANSIColor(5))
	Dim     = lipgloss.NewStyle().Faint(true)
	Bold    = lipgloss.NewStyle().Bold(true)

	CheckMark = Green.Render("✓")
	CrossMark = Red.Render("✗")
	WarnMark  = Yellow.Render("!")
)

func ConfirmPrompt(msg string) bool {
	fmt.Printf("%s [y/N] ", msg)
	scanner := bufio.NewScanner(os.Stdin)
	if !scanner.Scan() {
		return false
	}
	answer := strings.TrimSpace(strings.ToLower(scanner.Text()))
	return answer == "y" || answer == "yes"
}

func StyleForStatus(code int) lipgloss.Style {
	switch {
	case code >= 500:
		return Red
	case code >= 400:
		return Yellow
	case code >= 300:
		return Cyan
	default:
		return Green
	}
}
