package generators

import (
	"fmt"
	"strings"

	"github.com/backforge/code-generator/internal/schema"
	"gopkg.in/yaml.v3"
)

// OpenAPISpec represents the top-level OpenAPI 3.0 document (subset used for generation).
type OpenAPISpec struct {
	OpenAPI    string                    `yaml:"openapi"`
	Info       OpenAPIInfo               `yaml:"info"`
	Paths      map[string]PathItem       `yaml:"paths"`
	Components OpenAPIComponents         `yaml:"components"`
}

type OpenAPIInfo struct {
	Title   string `yaml:"title"`
	Version string `yaml:"version"`
}

type OpenAPIComponents struct {
	Schemas map[string]OpenAPISchema `yaml:"schemas"`
}

type OpenAPISchema struct {
	Type        string                     `yaml:"type"`
	Properties  map[string]OpenAPIProperty `yaml:"properties,omitempty"`
	Required    []string                   `yaml:"required,omitempty"`
}

type OpenAPIProperty struct {
	Type        string `yaml:"type"`
	Format      string `yaml:"format,omitempty"`
	Description string `yaml:"description,omitempty"`
	Nullable    bool   `yaml:"nullable,omitempty"`
}

type PathItem struct {
	Get    *Operation `yaml:"get,omitempty"`
	Post   *Operation `yaml:"post,omitempty"`
	Put    *Operation `yaml:"put,omitempty"`
	Delete *Operation `yaml:"delete,omitempty"`
}

type Operation struct {
	Summary     string              `yaml:"summary"`
	OperationID string              `yaml:"operationId"`
	Parameters  []Parameter         `yaml:"parameters,omitempty"`
	RequestBody *RequestBody        `yaml:"requestBody,omitempty"`
	Responses   map[string]Response `yaml:"responses"`
	Tags        []string            `yaml:"tags,omitempty"`
}

type Parameter struct {
	Name     string `yaml:"name"`
	In       string `yaml:"in"`
	Required bool   `yaml:"required"`
	Schema   struct {
		Type string `yaml:"type"`
	} `yaml:"schema"`
}

type RequestBody struct {
	Required bool                       `yaml:"required"`
	Content  map[string]MediaTypeObject `yaml:"content"`
}

type MediaTypeObject struct {
	Schema SchemaRef `yaml:"schema"`
}

type SchemaRef struct {
	Ref string `yaml:"$ref,omitempty"`
}

type Response struct {
	Description string                     `yaml:"description"`
	Content     map[string]MediaTypeObject `yaml:"content,omitempty"`
}

// GenerateOpenAPI generates an OpenAPI 3.0 YAML spec for all tables in the project.
func GenerateOpenAPI(state *schema.ProjectState) (string, error) {
	spec := OpenAPISpec{
		OpenAPI: "3.0.3",
		Info: OpenAPIInfo{
			Title:   state.Meta.Name,
			Version: fmt.Sprintf("%d.0.0", state.Meta.Version),
		},
		Paths:      make(map[string]PathItem),
		Components: OpenAPIComponents{Schemas: make(map[string]OpenAPISchema)},
	}

	for _, table := range state.Schema.Tables {
		singular := toSingular(toPascalCase(table.Name))
		schemaName := singular
		spec.Components.Schemas[schemaName] = tableToOpenAPISchema(table)

		pkField := primaryKeyField(table)
		pkParam := "id"
		pkType := "string"
		if pkField != nil {
			pkParam = pkField.Name
			pkType = fieldTypeToOpenAPIType(pkField.FieldType)
		}

		ref := schemaRef(schemaName)

		// Collection path: /{table}
		collectionPath := "/" + table.Name
		spec.Paths[collectionPath] = PathItem{
			Get: &Operation{
				Summary:     fmt.Sprintf("List all %s", table.Name),
				OperationID: fmt.Sprintf("list%s", toPascalCase(table.Name)),
				Tags:        []string{table.Name},
				Responses: map[string]Response{
					"200": {
						Description: "List of " + table.Name,
						Content: map[string]MediaTypeObject{
							"application/json": {Schema: SchemaRef{Ref: "#/components/schemas/" + schemaName + "List"}},
						},
					},
				},
			},
			Post: &Operation{
				Summary:     fmt.Sprintf("Create a %s", singular),
				OperationID: fmt.Sprintf("create%s", singular),
				Tags:        []string{table.Name},
				RequestBody: &RequestBody{
					Required: true,
					Content: map[string]MediaTypeObject{
						"application/json": {Schema: ref},
					},
				},
				Responses: map[string]Response{
					"201": {
						Description: singular + " created",
						Content: map[string]MediaTypeObject{
							"application/json": {Schema: ref},
						},
					},
					"400": {Description: "Invalid input"},
				},
			},
		}

		// Build pk parameter
		pkParamObj := Parameter{Name: pkParam, In: "path", Required: true}
		pkParamObj.Schema.Type = pkType

		// Item path: /{table}/{pk}
		itemPath := fmt.Sprintf("/%s/{%s}", table.Name, pkParam)
		spec.Paths[itemPath] = PathItem{
			Get: &Operation{
				Summary:     fmt.Sprintf("Get %s by %s", singular, pkParam),
				OperationID: fmt.Sprintf("get%s", singular),
				Tags:        []string{table.Name},
				Parameters:  []Parameter{pkParamObj},
				Responses: map[string]Response{
					"200": {
						Description: singular + " found",
						Content: map[string]MediaTypeObject{
							"application/json": {Schema: ref},
						},
					},
					"404": {Description: singular + " not found"},
				},
			},
			Put: &Operation{
				Summary:     fmt.Sprintf("Update %s by %s", singular, pkParam),
				OperationID: fmt.Sprintf("update%s", singular),
				Tags:        []string{table.Name},
				Parameters:  []Parameter{pkParamObj},
				RequestBody: &RequestBody{
					Required: true,
					Content: map[string]MediaTypeObject{
						"application/json": {Schema: ref},
					},
				},
				Responses: map[string]Response{
					"200": {
						Description: singular + " updated",
						Content: map[string]MediaTypeObject{
							"application/json": {Schema: ref},
						},
					},
					"404": {Description: singular + " not found"},
				},
			},
			Delete: &Operation{
				Summary:     fmt.Sprintf("Delete %s by %s", singular, pkParam),
				OperationID: fmt.Sprintf("delete%s", singular),
				Tags:        []string{table.Name},
				Parameters:  []Parameter{pkParamObj},
				Responses: map[string]Response{
					"204": {Description: singular + " deleted"},
					"404": {Description: singular + " not found"},
				},
			},
		}

		// Array schema alias
		spec.Components.Schemas[schemaName+"List"] = OpenAPISchema{
			Type: "array",
		}
	}

	out, err := yaml.Marshal(spec)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func tableToOpenAPISchema(t schema.Table) OpenAPISchema {
	props := make(map[string]OpenAPIProperty)
	var required []string

	for _, f := range t.Fields {
		prop := OpenAPIProperty{
			Type:     fieldTypeToOpenAPIType(f.FieldType),
			Format:   fieldTypeToOpenAPIFormat(f.FieldType),
			Nullable: f.Nullable,
		}
		props[f.Name] = prop
		if !f.Nullable {
			required = append(required, f.Name)
		}
	}

	return OpenAPISchema{
		Type:       "object",
		Properties: props,
		Required:   required,
	}
}

func schemaRef(name string) SchemaRef {
	return SchemaRef{Ref: "#/components/schemas/" + name}
}

func mediaTypeRef(name string) MediaTypeObject {
	return MediaTypeObject{Schema: schemaRef(name)}
}

func fieldTypeToOpenAPIType(ft schema.FieldType) string {
	switch ft {
	case schema.FieldTypeText, schema.FieldTypeUUID, schema.FieldTypeTimestamp:
		return "string"
	case schema.FieldTypeInteger:
		return "integer"
	case schema.FieldTypeBigInt:
		return "integer"
	case schema.FieldTypeFloat:
		return "number"
	case schema.FieldTypeBoolean:
		return "boolean"
	case schema.FieldTypeJSON:
		return "object"
	case schema.FieldTypeBytes:
		return "string"
	default:
		return "string"
	}
}

func fieldTypeToOpenAPIFormat(ft schema.FieldType) string {
	switch ft {
	case schema.FieldTypeUUID:
		return "uuid"
	case schema.FieldTypeTimestamp:
		return "date-time"
	case schema.FieldTypeBigInt:
		return "int64"
	case schema.FieldTypeFloat:
		return "double"
	case schema.FieldTypeBytes:
		return "byte"
	default:
		return ""
	}
}

// GenerateOpenAPIAsString is a convenience wrapper that panics on error (for use in tests).
func mustGenerateOpenAPI(state *schema.ProjectState) string {
	out, err := GenerateOpenAPI(state)
	if err != nil {
		panic(err)
	}
	return out
}

// Ensure mustGenerateOpenAPI isn't dead code by exposing it for testing.
var _ = strings.Contains // keep import
