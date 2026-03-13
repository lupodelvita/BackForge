// ============================================================
// API Client — connects to all BackForge backend services
// ============================================================
import axios, { type AxiosInstance } from 'axios'
import type {
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

// Base URLs — all proxied through the site dev server (see vite.config.ts)
// In production replace with actual service URLs via env vars
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080'
const ANALYZER_URL = import.meta.env.VITE_ANALYZER_URL || 'http://localhost:8081'
const DEPLOY_URL = import.meta.env.VITE_DEPLOY_URL || 'http://localhost:8082'
const SYNC_URL = import.meta.env.VITE_SYNC_URL || 'http://localhost:8083'
const CODEGEN_URL = import.meta.env.VITE_CODEGEN_URL || 'http://localhost:8084'
const METRICS_URL = import.meta.env.VITE_METRICS_URL || 'http://localhost:8085'

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
