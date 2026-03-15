// ============================================================
// API Client — connects to all BackForge backend services
// ============================================================
import axios, { type AxiosInstance } from 'axios'
import type {
  User,
  AuthResponse,
  GitHubOAuthMode,
  PlatformOAuthStatus,
  GitHubProviderConfig,
  ProjectState,
  DeploymentRecord,
  DeployTarget,
  RouteStats,
  MetricEvent,
  MigrationStatus,
  Snapshot,
  SnapshotMeta,
  GenerateRequest,
  GenerateResponse,
  ValidateResponse,
  AnalyzeRequest,
  AnalyzeResponse,
} from './types'

// Production URLs — all services on Railway
const GATEWAY_URL = 'https://backforge.up.railway.app'
const ANALYZER_URL = 'https://backforge.up.railway.app'
const DEPLOY_URL = 'https://backforge.up.railway.app'
const SYNC_URL = 'https://backforge.up.railway.app'
const CODEGEN_URL = 'https://backforge.up.railway.app'
const METRICS_URL = 'https://backforge.up.railway.app'

function makeClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  })

  // Attach JWT from localStorage if present
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('backforge_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  return client
}

// ============================================================
// Auth — all on the API Gateway (port 8080)
// ============================================================
export const authApi = {
  register: (username: string, email: string, password: string) =>
    gateway.post<AuthResponse>('/auth/register', { username, email, password }),

  login: (email: string, password: string) =>
    gateway.post<AuthResponse>('/auth/login', { email, password }),

  me: () => gateway.get<User>('/auth/me'),

  platformGitHubStatus: () =>
    gateway.get<PlatformOAuthStatus>('/auth/platform/github'),

  /** Returns the GitHub OAuth URL so the frontend can redirect the user. */
  githubConnectInit: () =>
    gateway.post<{ url: string }>('/auth/github/connect'),

  getGitHubProviderConfig: (projectId?: string) =>
    gateway.get<GitHubProviderConfig>('/auth/providers/github', {
      params: projectId ? { project_id: projectId } : undefined,
    }),

  saveGitHubProviderConfig: (payload: {
    project_id?: string
    client_id: string
    client_secret: string
    callback_url: string
  }) => gateway.put<GitHubProviderConfig>('/auth/providers/github', payload),

  /** Builds the GitHub authorize URL for login or register flows. */
  githubUrl: (mode: GitHubOAuthMode) =>
    `${GATEWAY_URL}/auth/github?mode=${mode}`,
}

// ============================================================
// API Gateway — port 8080
// ============================================================
const gateway = makeClient(GATEWAY_URL)

export const gatewayApi = {
  health: () => gateway.get<{ status: string; timestamp: string; version: string }>('/health'),

  listProjects: () => gateway.get<{ projects: string[] }>('/projects'),

  getProject: (name: string) => gateway.get<ProjectState>(`/projects/${name}`),

  saveProject: (name: string, state: ProjectState) =>
    gateway.put<{ status: string; project: string }>(`/projects/${name}`, state),

  getMigrationStatus: (project: string) =>
    gateway.get<MigrationStatus>(`/migrate/${project}/status`),

  runMigrations: (project: string) =>
    gateway.post<{ project: string; applied_count: number; migrations: string[] }>(
      `/migrate/${project}/run`
    ),

  listBuckets: (project: string) =>
    gateway.get<{ project: string; buckets: string[] }>(`/storage/${project}`),

  createBucket: (project: string, bucket: string) =>
    gateway.put<{ status: string; project: string; bucket: string }>(
      `/storage/${project}/${bucket}`
    ),

  deleteBucket: (project: string, bucket: string) =>
    gateway.delete(`/storage/${project}/${bucket}`),

  listObjects: (project: string, bucket: string) =>
    gateway.get(`/storage/${project}/${bucket}`),

  uploadObject: (project: string, bucket: string, key: string, data: Blob, contentType: string) =>
    gateway.put(`/storage/${project}/${bucket}/${key}`, data, {
      headers: { 'Content-Type': contentType },
    }),

  getObjectUrl: (project: string, bucket: string, key: string) =>
    `${GATEWAY_URL}/storage/${project}/${bucket}/${key}`,

  deleteObject: (project: string, bucket: string, key: string) =>
    gateway.delete(`/storage/${project}/${bucket}/${key}`),
}

// ============================================================
// Deployment Engine — port 8082
// ============================================================
const deployer = makeClient(DEPLOY_URL)

export const deployApi = {
  health: () => deployer.get<{ status: string; service: string }>('/health'),

  create: (projectName: string, target: DeployTarget = 'local', port = 3000) =>
    deployer.post<DeploymentRecord>('/deployments', {
      project_name: projectName,
      target,
      port,
    }),

  list: () => deployer.get<DeploymentRecord[]>('/deployments'),

  get: (id: string) => deployer.get<DeploymentRecord>(`/deployments/${id}`),

  stop: (id: string) => deployer.delete(`/deployments/${id}`),

  getDockerfile: (id: string) =>
    deployer.get<string>(`/deployments/${id}/dockerfile`, {
      responseType: 'text',
      transformResponse: [(d) => d],
    }),
}

// ============================================================
// Sync Server — port 8083
// ============================================================
const syncer = makeClient(SYNC_URL)

export const syncApi = {
  push: (project: string, snapshot: Snapshot) =>
    syncer.put<{ status: string; id: string }>(`/sync/${project}`, snapshot),

  latest: (project: string) => syncer.get<Snapshot>(`/sync/${project}`),

  history: (project: string) => syncer.get<SnapshotMeta[]>(`/sync/${project}/history`),

  delete: (project: string) => syncer.delete(`/sync/${project}`),
}

// ============================================================
// Code Generator — port 8084
// ============================================================
const codegen = makeClient(CODEGEN_URL)

export const codegenApi = {
  generateSql: (req: GenerateRequest) =>
    codegen.post<GenerateResponse>('/generate/sql', req),

  generateHandlers: (req: GenerateRequest) =>
    codegen.post<GenerateResponse>('/generate/handlers', req),

  generateOpenApi: (req: GenerateRequest) =>
    codegen.post<GenerateResponse>('/generate/openapi', req),

  generateAll: (req: GenerateRequest) =>
    codegen.post<GenerateResponse>('/generate/all', req),

  validate: (req: GenerateRequest) =>
    codegen.post<ValidateResponse>('/generate/validate', req),
}

// ============================================================
// Metrics — port 8085
// ============================================================
const metrics = makeClient(METRICS_URL)

export const metricsApi = {
  health: () => metrics.get<{ status: string; service: string }>('/health'),

  allStats: () => metrics.get<{ stats: RouteStats[] }>('/metrics/json'),

  summary: () => metrics.get<{ projects: Record<string, unknown> }>('/metrics/summary'),

  projectStats: (project: string) =>
    metrics.get<{ project: string; stats: RouteStats[] }>(`/metrics/project/${project}`),

  record: (event: MetricEvent) => metrics.post('/metrics/record', event),
}

// ============================================================
// Frontend Analyzer — port 8081
// ============================================================
const analyzer = makeClient(ANALYZER_URL)

export const analyzerApi = {
  health: () => analyzer.get<{ status: string; version: string }>('/health'),

  analyze: (req: AnalyzeRequest) => analyzer.post<AnalyzeResponse>('/analyze', req),

  plugins: () => analyzer.get<{ plugins: string[] }>('/plugins'),

  detectPlugin: (code: string) =>
    analyzer.post<{ framework: string }>('/plugins/detect', { code }),
}
