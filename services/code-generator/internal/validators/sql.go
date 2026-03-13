package validators

import (
	"fmt"
	"strings"
)

// ValidateSQLFiles checks the SQL DDL files for common safety issues.
func ValidateSQLFiles(files map[string]string) []CheckResult {
	var checks []CheckResult

	for name, src := range files {
		if !strings.HasSuffix(name, ".sql") {
			continue
		}
		if strings.TrimSpace(src) == "" {
			checks = append(checks, fail("sql:not-empty:"+name, "file is empty"))
			continue
		}
		checks = append(checks, pass("sql:not-empty:"+name))

		upper := strings.ToUpper(src)

		// DROP TABLE without IF EXISTS triggers in production are dangerous
		if strings.Contains(upper, "DROP TABLE") &&
			!strings.Contains(upper, "DROP TABLE IF EXISTS") {
			checks = append(checks, fail("sql:safe-drop:"+name,
				"DROP TABLE used without IF EXISTS"))
		} else {
			checks = append(checks, pass("sql:safe-drop:"+name))
		}

		// Every CREATE TABLE should have at least one PRIMARY KEY
		if strings.Contains(upper, "CREATE TABLE") &&
			!strings.Contains(upper, "PRIMARY KEY") {
			checks = append(checks, fail("sql:has-pk:"+name,
				fmt.Sprintf("CREATE TABLE in %s has no PRIMARY KEY", name)))
		} else {
			checks = append(checks, pass("sql:has-pk:"+name))
		}
	}

	if len(checks) == 0 {
		checks = append(checks, pass("sql:no-files"))
	}
	return checks
}
