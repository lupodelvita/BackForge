import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Blocks,
  Activity,
  Rocket,
  Settings,
  ChevronLeft,
  Sparkles,
  FolderPlus,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarCollapsed, toggleSidebar, currentProject, projectNames, setCurrentProject } =
    useAppStore()
  const location = useLocation()

  const mainNav = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/builder', icon: Blocks, label: t('nav.builder') },
    { to: '/metrics', icon: Activity, label: t('nav.metrics') },
    { to: '/deploy', icon: Rocket, label: t('nav.deploy') },
    { to: '/settings', icon: Settings, label: t('nav.settings') },
  ]

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-edge bg-bg-surface/80 backdrop-blur-xl transition-all duration-300',
        sidebarCollapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-edge px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path
              d="M8 24V8l8 4v4l8-4v12l-8-4v-4l-8 4z"
              fill="currentColor"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {!sidebarCollapsed && (
          <span className="font-display text-base font-bold tracking-tight text-gradient-accent">
            BackForge
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'ml-auto flex size-6 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-raised transition-all cursor-pointer',
            sidebarCollapsed && 'ml-0 rotate-180'
          )}
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex flex-col gap-0.5 p-2">
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-accent/12 text-accent shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-raised'
              )
            }
          >
            <item.icon
              className={cn(
                'size-[18px] shrink-0 transition-colors',
                location.pathname === item.to
                  ? 'text-accent'
                  : 'text-text-muted group-hover:text-text-secondary'
              )}
            />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-1.5 h-px bg-edge" />

      {/* Projects list */}
      {!sidebarCollapsed && projectNames.length > 0 && (
        <div className="flex flex-col gap-0.5 p-2">
          <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Projects
          </span>
          {projectNames.map((name) => (
            <button
              key={name}
              onClick={() => setCurrentProject(name)}
              className={cn(
                'flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm transition-all cursor-pointer',
                currentProject === name
                  ? 'bg-accent/12 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-raised'
              )}
            >
              <FolderOpen className="size-4 text-text-muted" />
              <span className="truncate">{name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick actions */}
      <div className="flex flex-col gap-1 border-t border-edge p-2">
        {!sidebarCollapsed ? (
          <>
            <button className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm text-accent hover:bg-accent/10 transition-all cursor-pointer">
              <Sparkles className="size-4" />
              AI Ассистент
            </button>
            <button className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm text-ember hover:bg-ember/10 transition-all cursor-pointer">
              <FolderPlus className="size-4" />
              Новый проект
            </button>
          </>
        ) : (
          <>
            <button className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-accent hover:bg-accent/10 transition-all cursor-pointer mx-auto">
              <Sparkles className="size-4" />
            </button>
            <button className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-ember hover:bg-ember/10 transition-all cursor-pointer mx-auto">
              <FolderPlus className="size-4" />
            </button>
          </>
        )}
      </div>

      {/* Active project indicator */}
      {!sidebarCollapsed && currentProject && (
        <div className="border-t border-edge p-3">
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-bg-raised px-3 py-2">
            <div className="size-2 rounded-full bg-success animate-pulse-glow" />
            <div className="flex-1 truncate">
              <p className="truncate text-xs font-medium text-text-primary">
                {currentProject}
              </p>
              <p className="text-[10px] text-text-muted">Active</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
