package cmd

import "testing"

func TestNormalizeName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "myapp", want: "myapp.test"},
		{input: "myapp.test", want: "myapp.test"},
		{input: "myapp.test.", want: "myapp.test"},
		{input: "MYAPP.TEST", want: "myapp.test"},
		{input: "  myapp.test  ", want: "myapp.test"},
		{input: "my-app", want: "my-app.test"},
		{input: "app.loc", want: "app.loc"},
		{input: "APP.LOC", want: "app.loc"},
		{input: "my.custom.domain", want: "my.custom.domain"},
	}

	for _, tt := range tests {
		got := normalizeName(tt.input)
		if got != tt.want {
			t.Fatalf("normalizeName(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
