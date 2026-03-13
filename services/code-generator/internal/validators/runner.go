package validators

// RunAll chains every validator against the generated file set and returns a
// consolidated ValidationReport.
func RunAll(project string, files map[string]string) ValidationReport {
	var checks []CheckResult

	// SQL DDL checks
	checks = append(checks, ValidateSQLFiles(files)...)

	// Go syntax checks
	checks = append(checks, ValidateGoFiles(files)...)

	// OpenAPI spec checks
	if spec, ok := files["openapi.yaml"]; ok {
		checks = append(checks, ValidateOpenAPI(spec)...)
	} else {
		checks = append(checks, fail("openapi:present", "openapi.yaml was not generated"))
	}

	valid := true
	for _, c := range checks {
		if !c.Passed {
			valid = false
			break
		}
	}

	return ValidationReport{
		Project: project,
		Valid:   valid,
		Checks:  checks,
	}
}
