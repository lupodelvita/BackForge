import { create } from 'zustand'
import type { ProjectState } from '@/types/schema'

interface ProjectApiState {
  loading: boolean
  error: string | null
  analyzeCode: (code: string, filename: string) => Promise<ProjectState | null>
  saveProject: (project: ProjectState) => Promise<boolean>
}

export const useProjectApi = create<ProjectApiState>()(() => ({
  loading: false,
  error: null,

  analyzeCode: async (code: string, filename: string): Promise<ProjectState | null> => {
    useProjectApi.setState({ loading: true, error: null })
    try {
      const res = await fetch('/api/analyzer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, filename }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Analyzer error ${res.status}: ${text}`)
      }
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
      const res = await fetch(`/api/gateway/projects/${project.meta.name}`, {
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
}))
