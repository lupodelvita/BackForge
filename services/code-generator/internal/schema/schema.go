// Package schema defines the Go representation of BackForge's project_state.json.
// Must stay in sync with crates/backforge-core/src/project/schema.rs and state.rs.
package schema

// FieldType mirrors FieldType in Rust core.
type FieldType string

const (
	FieldTypeText      FieldType = "text"
	FieldTypeInteger   FieldType = "integer"
	FieldTypeBigInt    FieldType = "big_int"
	FieldTypeFloat     FieldType = "float"
	FieldTypeBoolean   FieldType = "boolean"
	FieldTypeUUID      FieldType = "uuid"
	FieldTypeTimestamp FieldType = "timestamp"
	FieldTypeJSON      FieldType = "json"
	FieldTypeBytes     FieldType = "bytes"
)

type Field struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	FieldType    FieldType  `json:"field_type"`
	Nullable     bool       `json:"nullable"`
	Unique       bool       `json:"unique"`
	PrimaryKey   bool       `json:"primary_key"`
	DefaultValue *string    `json:"default_value,omitempty"`
}

type Index struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Fields []string `json:"fields"`
	Unique bool     `json:"unique"`
}

type Table struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Fields  []Field `json:"fields"`
	Indexes []Index `json:"indexes"`
}

type ProjectSchema struct {
	Tables []Table `json:"tables"`
}

type ProjectMeta struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Version     uint32 `json:"version"`
}

type ProjectState struct {
	Meta   ProjectMeta    `json:"meta"`
	Schema ProjectSchema  `json:"schema"`
	OAuth  *OAuthProviders `json:"oauth,omitempty"`
}

// OAuthProviders holds optional OAuth provider credentials to inject into generated code.
type OAuthProviders struct {
	GitHub *GitHubOAuthConfig `json:"github,omitempty"`
}

// GitHubOAuthConfig contains the non-secret GitHub OAuth App values stored per-project.
// The client_secret is intentionally excluded and must be supplied at runtime via env var.
type GitHubOAuthConfig struct {
	ClientID    string `json:"client_id"`
	CallbackURL string `json:"callback_url"`
}
