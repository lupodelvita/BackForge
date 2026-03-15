// ============================================================
// Shared data models — mirrors backend Go/Rust structs exactly
// ============================================================

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  github_username?: string
  github_email?: string
  has_password: boolean
  has_github: boolean
}

export interface AuthResponse {
  user: User
  token: string
}

export type GitHubOAuthMode = 'login' | 'register'

export interface PlatformOAuthStatus {
  provider: 'github'
  configured: boolean
  scope: 'platform'
}

export interface GitHubProviderConfig {
  provider: 'github'
  scope_type: 'account' | 'project'
  project_id?: string
  configured: boolean
  client_id?: string
  callback_url?: string
  has_secret: boolean
  platform_configured: boolean
}

// ── Schema ───────────────────────────────────────────────────────────────────

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

export interface SchemaField {
  id: string
  name: string
  field_type: FieldType
  nullable: boolean
  unique: boolean
  primary_key: boolean
  default_value?: string
}

export interface SchemaIndex {
  id: string
  name: string
  fields: string[]
  unique: boolean
}

export interface SchemaTable {
  id: string
  name: string
  fields: SchemaField[]
  indexes: SchemaIndex[]
}

export interface ProjectMeta {
  id: string
  name: string
  description: string
  version: number
}

export interface ProjectSchema {
  tables: SchemaTable[]
}

export interface ProjectState {
  meta: ProjectMeta
  schema: ProjectSchema
}

// ---- Deployment ----
export type DeployTarget = 'local' | 'cloud' | 'edge'
export type DeployStatus = 'pending' | 'running' | 'stopped' | 'failed'

export interface DeploymentRecord {
  id: string
  project_name: string
  target: DeployTarget
  status: DeployStatus
  port: number
  container_id: string
  image_tag: string
  url: string
  created_at: string
  updated_at: string
  error: string
}

// ---- Metrics ----
export interface RouteStats {
  project: string
  method: string
  route: string
  requests: number
  errors: number
  total_duration_ms: number
  min_duration_ms: number
  max_duration_ms: number
  last_seen_at: string
}

export interface MetricEvent {
  project: string
  route: string
  method: string
  status_code: number
  duration_ms: number
  timestamp: string
}

// ---- Sync ----
export interface VectorClock {
  [nodeId: string]: number
}

export interface Snapshot {
  id: string
  project_name: string
  node_id: string
  clock: VectorClock
  sha256: string
  content: string // base64-encoded ProjectState JSON
  created_at: string
}

export interface SnapshotMeta {
  id: string
  project_name: string
  node_id: string
  clock: VectorClock
  sha256: string
  created_at: string
}

// ---- Migration ----
export interface MigrationStatus {
  project: string
  applied: string[]
  pending: string[]
}

// ---- Code Generator ----
export interface GenerateRequest {
  state: ProjectState
}

export interface GenerateResponse {
  files: Record<string, string>
}

export interface ValidationCheck {
  name: string
  passed: boolean
}

export interface ValidationReport {
  valid: boolean
  errors: string[]
  checks: ValidationCheck[]
}

export interface ValidateResponse {
  report: ValidationReport
  files: Record<string, string>
}

// ---- Analyzer ----
export type AnalyzerLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'dart'
  | 'swift'
  | 'kotlin'

export interface AnalyzeRequest {
  code: string
  language: AnalyzerLanguage
  project_name: string
  use_ai: boolean
}

export interface AnalyzedTable {
  name: string
  fields: SchemaField[]
  reason: string
}

export interface AnalyzedEndpoint {
  path: string
  method: string
  table_name: string
  description: string
}

export interface AnalyzeResult {
  tables: AnalyzedTable[]
  endpoints: AnalyzedEndpoint[]
  confidence: number
  raw_findings: unknown[]
  ai_enhanced: boolean
}

export interface AnalyzeResponse {
  project_name: string
  language: string
  result: AnalyzeResult
  project_state_json: ProjectState
}
