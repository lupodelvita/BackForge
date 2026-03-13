import { create } from 'zustand'
import type { ProjectState, CIReport, MigrateResult, MigrateStatusResult } from '@/types/schema'

interface ProjectApiState {
  loading: boolean
  generateLoading: boolean
  migrateLoading: boolean
  error: string | null
  ciReport: CIReport | null
  generateFiles: Record<string, string> | null
  migrateResult: MigrateResult | null

  clearCIReport: () => void
  analyzeCode: (code: string, filename: string) => Promise<ProjectState | null>
  loadProject: (name: string) => Promise<ProjectState | null>
  saveProject: (project: ProjectState) => Promise<boolean>
  generateAll: (project: ProjectState) => Promise<Record<string, string> | null>
  validateCI: (project: ProjectState) => Promise<CIReport | null>
  runMigrations: (projectName: string) => Promise<MigrateResult | null>
  getMigrateStatus: (projectName: string) => Promise<MigrateStatusResult | null>
}

export const useProjectApi = create<ProjectApiState>()(() => ({
  loading: false,
  generateLoading: false,
  migrateLoading: false,
  error: null,
  ciReport: null,
  generateFiles: null,
  migrateResult: null,

  clearCIReport: () => useProjectApi.setState({ ciReport: null, generateFiles: null }),

  analyzeCode: async (code: string, filename: string): Promise<ProjectState | null> => {
    useProjectApi.setState({ loading: true, error: null })
    try {
      const res = await fetch('/api/analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, filename }),
      })
      if (!res.ok) throw new Error(`Analyzer error ${res.status}: ${await res.text()}`)
      const data: ProjectState = await res.json()
      useProjectApi.setState({ loading: false })
      return data
    } catch (err) {
      useProjectApi.setState({ loading: false, error: String(err) })
      return null
    }
  },

  loadProject: async (name: string): Promise<ProjectState | null> => {
    useProjectApi.setState({ loading: true, error: null })
    try {
      const res = await fetch(`/api/gateway/projects/${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error(`Load error ${res.status}: ${await res.text()}`)
      const data: ProjectState = await res.json()
      useProjectApi.setState({ loading: false })
      return data
    } catch (err) {
      useProjectApi.setState({ loading: false, error: String(err) })
      return null
    }
  },

  saveProject: async (project: ProjectState): Promise<boolean> => {
    useProjectApi.setState({ loading: true, error: null })
    try {
      const res = await fetch(`/api/gateway/projects/${encodeURIComponent(project.meta.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      })
      if (!res.ok) throw new Error(`Save error ${res.status}`)
      useProjectApi.setState({ loading: false })
      return true
    } catch (err) {
      useProjectApi.setState({ loading: false, error: String(err) })
      return false
    }
  },

  generateAll: async (project: ProjectState): Promise<Record<string, string> | null> => {
    useProjectApi.setState({ generateLoading: true, error: null })
    try {
      const res = await fetch('/api/codegen/generate/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: project }),
      })
      if (!res.ok) throw new Error(`Generate error ${res.status}: ${await res.text()}`)
      const data: Record<string, string> = await res.json()
      useProjectApi.setState({ generateLoading: false, generateFiles: data })
      return data
    } catch (err) {
      useProjectApi.setState({ generateLoading: false, error: String(err) })
      return null
    }
  },

  validateCI: async (project: ProjectState): Promise<CIReport | null> => {
    useProjectApi.setState({ loading: true, error: null })
    try {
      const res = await fetch('/api/codegen/generate/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: project }),
      })
      if (!res.ok) throw new Error(`CI validate error ${res.status}: ${await res.text()}`)
      const data: { report: CIReport; files: Record<string, string> } = await res.json()
      useProjectApi.setState({ loading: false, ciReport: data.report, generateFiles: data.files ?? null })
      return data.report
    } catch (err) {
      useProjectApi.setState({ loading: false, error: String(err) })
      return null
    }
  },

  runMigrations: async (projectName: string): Promise<MigrateResult | null> => {
    useProjectApi.setState({ migrateLoading: true, error: null })
    try {
      const res = await fetch(`/api/gateway/migrate/${encodeURIComponent(projectName)}/run`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`Migrate error ${res.status}: ${await res.text()}`)
      const data: MigrateResult = await res.json()
      useProjectApi.setState({ migrateLoading: false, migrateResult: data })
      return data
    } catch (err) {
      useProjectApi.setState({ migrateLoading: false, error: String(err) })
      return null
    }
  },

  getMigrateStatus: async (projectName: string): Promise<MigrateStatusResult | null> => {
    try {
      const res = await fetch(`/api/gateway/migrate/${encodeURIComponent(projectName)}/status`)
      if (!res.ok) return null
      return await res.json() as MigrateStatusResult
    } catch {
      return null
    }
  },
}))

