// Типы синхронизированы с Rust ProjectState (crates/backforge-core/src/project/schema.rs)

export type FieldType =
  | 'text'
  | 'integer'
  | 'big_int'
  | 'float'
  | 'boolean'
  | 'uuid'
  | 'timestamp'
  | 'json'
  | 'bytes'

export interface Field {
  id: string
  name: string
  field_type: FieldType
  nullable: boolean
  unique: boolean
  primary_key: boolean
  default_value: string | null
  /** Optional explicit FK reference: name of the target table */
  references?: string | null
}

export interface Index {
  id: string
  name: string
  fields: string[]
  unique: boolean
}

export interface Table {
  id: string
  name: string
  fields: Field[]
  indexes: Index[]
}

export interface ProjectSchema {
  tables: Table[]
}

export interface ProjectMeta {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  version: number
}

export interface ProjectState {
  meta: ProjectMeta
  schema: ProjectSchema
}

// Canvas node position (хранится только в builder, не в project_state.json)
export interface NodePosition {
  x: number
  y: number
}

export type BuilderNodeType = 'table'

export interface BuilderNode {
  id: string       // = table.id
  type: BuilderNodeType
  position: NodePosition
}

// ── CI Validation types ────────────────────────────────────────────────────────

export interface CICheckResult {
  name: string
  passed: boolean
  message: string
}

export interface CIReport {
  project: string
  valid: boolean
  checks: CICheckResult[]
}

// ── Migration response types ───────────────────────────────────────────────────

export interface MigrateResult {
  project: string
  applied_count: number
  migrations: string[]
  message?: string
}

export interface MigrateStatusResult {
  project: string
  applied: string[]
  pending: string[]
}

