// Package validators validates generated artifacts for correctness and safety.
package validators

// CheckResult is the outcome of a single validation check.
type CheckResult struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Message string `json:"message,omitempty"`
}

// ValidationReport summarises all checks for a generated project.
type ValidationReport struct {
	Project string        `json:"project"`
	Valid   bool          `json:"valid"`
	Checks  []CheckResult `json:"checks"`
}

func pass(name string) CheckResult {
	return CheckResult{Name: name, Passed: true}
}

func fail(name, msg string) CheckResult {
	return CheckResult{Name: name, Passed: false, Message: msg}
}
