package validators

import (
	"go/parser"
	"go/token"
	"strings"
)

// ValidateGoFiles syntax-checks every *.go entry in files using the stdlib
// go/parser.  No external dependencies required.
func ValidateGoFiles(files map[string]string) []CheckResult {
	var checks []CheckResult
	fset := token.NewFileSet()

	for name, src := range files {
		if !strings.HasSuffix(name, ".go") {
			continue
		}
		if _, err := parser.ParseFile(fset, name, src, parser.AllErrors); err != nil {
			checks = append(checks, fail("go:syntax:"+name, err.Error()))
		} else {
			checks = append(checks, pass("go:syntax:"+name))
		}
	}

	if len(checks) == 0 {
		checks = append(checks, pass("go:syntax"))
	}
	return checks
}
