import { create } from 'zustand'

export interface ProjectInfo {
  name: string
  description: string
  tables: number
  endpoints: number
  status: 'active' | 'draft' | 'archived'
  lastDeploy?: string
}

interface AppState {
  currentProject: string | null
  sidebarCollapsed: boolean
  projects: ProjectInfo[]
  setCurrentProject: (name: string | null) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentProject: 'my-saas-app',
  sidebarCollapsed: false,
  projects: [
    {
      name: 'my-saas-app',
      description: 'Основной SaaS проект',
      tables: 12,
      endpoints: 34,
      status: 'active',
      lastDeploy: '2 мин. назад',
    },
    {
      name: 'mobile-backend',
      description: 'Backend для мобильного приложения',
      tables: 8,
      endpoints: 22,
      status: 'active',
      lastDeploy: '1 час назад',
    },
    {
      name: 'iot-gateway',
      description: 'IoT gateway для умного дома',
      tables: 5,
      endpoints: 14,
      status: 'draft',
    },
  ],
  setCurrentProject: (name) => set({ currentProject: name }),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
