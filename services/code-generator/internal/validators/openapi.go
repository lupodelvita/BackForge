package validators

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// ValidateOpenAPI checks that the generated OpenAPI YAML is well-formed and
// internally consistent.
func ValidateOpenAPI(yamlSrc string) []CheckResult {
	var checks []CheckResult

	// ── structural parse ───────────────────────────────────────────────────
	var doc map[string]any
	if err := yaml.Unmarshal([]byte(yamlSrc), &doc); err != nil {
		checks = append(checks, fail("openapi:parse", fmt.Sprintf("YAML parse error: %v", err)))
		return checks
	}
	checks = append(checks, pass("openapi:parse"))

	// ── openapi version ────────────────────────────────────────────────────
	version, _ := doc["openapi"].(string)
	if version == "" {
		checks = append(checks, fail("openapi:version", "missing 'openapi' field"))
	} else if !strings.HasPrefix(version, "3.") {
		checks = append(checks, fail("openapi:version",
			fmt.Sprintf("expected OpenAPI 3.x, got: %s", version)))
	} else {
		checks = append(checks, pass("openapi:version"))
	}

	// ── info block ─────────────────────────────────────────────────────────
	info, _ := doc["info"].(map[string]any)
	if info == nil {
		checks = append(checks, fail("openapi:info", "missing 'info' block"))
	} else {
		if t, _ := info["title"].(string); t == "" {
			checks = append(checks, fail("openapi:info.title", "missing info.title"))
		} else {
			checks = append(checks, pass("openapi:info.title"))
		}
		if v, _ := info["version"].(string); v == "" {
			checks = append(checks, fail("openapi:info.version", "missing info.version"))
		} else {
			checks = append(checks, pass("openapi:info.version"))
		}
	}

	// ── paths ──────────────────────────────────────────────────────────────
	paths, _ := doc["paths"].(map[string]any)
	if len(paths) == 0 {
		checks = append(checks, fail("openapi:paths", "no paths defined"))
	} else {
		checks = append(checks, pass("openapi:paths"))
	}

	// ── operationId uniqueness ─────────────────────────────────────────────
	seen := make(map[string]bool)
	duplicates := false
	for _, pathVal := range paths {
		item, ok := pathVal.(map[string]any)
		if !ok {
			continue
		}
		for _, opVal := range item {
			op, ok := opVal.(map[string]any)
			if !ok {
				continue
			}
			if oid, _ := op["operationId"].(string); oid != "" {
				if seen[oid] {
					duplicates = true
				}
				seen[oid] = true
			}
		}
	}
	if duplicates {
		checks = append(checks, fail("openapi:operationId", "duplicate operationId values"))
	} else {
		checks = append(checks, pass("openapi:operationId"))
	}

	// ── component schemas cross-reference ─────────────────────────────────
	components, _ := doc["components"].(map[string]any)
	var schemas map[string]any
	if components != nil {
		schemas, _ = components["schemas"].(map[string]any)
	}
	unresolved := false
	for pathStr, pathVal := range paths {
		item, ok := pathVal.(map[string]any)
		if !ok {
			continue
		}
		for method, opVal := range item {
			op, ok := opVal.(map[string]any)
			if !ok {
				continue
			}
			// Check request body schema refs
			if rb, ok := op["requestBody"].(map[string]any); ok {
				if refs := extractRefs(rb); len(refs) > 0 {
					for _, ref := range refs {
						name := schemaNameFromRef(ref)
						if name != "" && schemas != nil && schemas[name] == nil {
							checks = append(checks, fail("openapi:schema-ref",
								fmt.Sprintf("path %s %s references undefined schema %q",
									pathStr, method, name)))
							unresolved = true
						}
					}
				}
			}
			_ = method
		}
	}
	if !unresolved {
		checks = append(checks, pass("openapi:schema-refs"))
	}

	return checks
}

func extractRefs(v any) []string {
	var refs []string
	switch m := v.(type) {
	case map[string]any:
		if ref, ok := m["$ref"].(string); ok {
			refs = append(refs, ref)
		}
		for _, child := range m {
			refs = append(refs, extractRefs(child)...)
		}
	case []any:
		for _, item := range m {
			refs = append(refs, extractRefs(item)...)
		}
	}
	return refs
}

func schemaNameFromRef(ref string) string {
	const prefix = "#/components/schemas/"
	if strings.HasPrefix(ref, prefix) {
		return ref[len(prefix):]
	}
	return ""
}
