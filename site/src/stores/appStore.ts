import { create } from 'zustand'
import type { ProjectState } from '../lib/types'

export interface ProjectInfo {
  name: string
  description: string
  tables: number
  endpoints: number
  status: 'active' | 'draft' | 'archived'
  lastDeploy?: string
}

interface AppState {
  // Current project name (persists across pages)
  currentProject: string | null
  // Full loaded state from the API for the current project
  currentProjectState: ProjectState | null
  sidebarCollapsed: boolean
  // Cache of project list from /projects endpoint
  projectNames: string[]
  setCurrentProject: (name: string | null) => void
  setCurrentProjectState: (state: ProjectState | null) => void
  setProjectNames: (names: string[]) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentProject: localStorage.getItem('backforge_project') || null,
  currentProjectState: null,
  sidebarCollapsed: false,
  projectNames: [],

  setCurrentProject: (name) => {
    if (name) localStorage.setItem('backforge_project', name)
    else localStorage.removeItem('backforge_project')
    set({ currentProject: name, currentProjectState: null })
  },

  setCurrentProjectState: (state) => set({ currentProjectState: state }),

  setProjectNames: (names) => set({ projectNames: Array.isArray(names) ? names : [] }),

  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
