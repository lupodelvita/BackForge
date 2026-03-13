import {
  Search,
  Bell,
  Terminal,
  Moon,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { Badge } from '@/components/ui/badge'

export function Header() {
  const { currentProject } = useAppStore()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-edge bg-bg-root/70 backdrop-blur-xl px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-muted">BackForge</span>
        <span className="text-text-muted">/</span>
        <span className="font-medium text-text-primary">{currentProject}</span>
        <Badge variant="success" className="ml-2">
          <span className="mr-0.5 inline-block size-1.5 rounded-full bg-success animate-pulse-glow" />
          Online
        </Badge>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button className="flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-edge bg-bg-raised px-3 text-xs text-text-muted hover:border-edge-strong transition-colors cursor-pointer">
          <Search className="size-3.5" />
          <span>Поиск...</span>
          <kbd className="ml-4 rounded border border-edge bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
            ⌘K
          </kbd>
        </button>

        <div className="mx-2 h-5 w-px bg-edge" />

        {/* Sync indicator */}
        <StatusButton
          icon={Wifi}
          offIcon={WifiOff}
          online
          tooltip="Синхронизация"
        />

        {/* Terminal */}
        <IconBtn icon={Terminal} tooltip="Терминал" />

        {/* Notifications */}
        <div className="relative">
          <IconBtn icon={Bell} tooltip="Уведомления" />
          <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-danger" />
        </div>

        {/* Theme */}
        <IconBtn icon={Moon} tooltip="Тема" />
      </div>
    </header>
  )
}

function IconBtn({
  icon: Icon,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>
  tooltip: string
}) {
  return (
    <button
      title={tooltip}
      className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-raised transition-colors cursor-pointer"
    >
      <Icon className="size-4" />
    </button>
  )
}

function StatusButton({
  icon: OnIcon,
  offIcon: OffIcon,
  online,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>
  offIcon: React.ComponentType<{ className?: string }>
  online: boolean
  tooltip: string
}) {
  const Icon = online ? OnIcon : OffIcon
  return (
    <button
      title={tooltip}
      className={cn(
        'flex size-8 items-center justify-center rounded-[var(--radius-md)] transition-colors cursor-pointer',
        online
          ? 'text-success hover:bg-success/10'
          : 'text-danger hover:bg-danger/10'
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
