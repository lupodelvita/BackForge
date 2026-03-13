import {
  Table2,
  Zap,
  Workflow,
  HardDrive,
  Shield,
  Key,
  Webhook,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const palette = [
  { category: 'Данные', items: [
    { icon: Table2, label: 'Table', color: 'text-accent' },
    { icon: HardDrive, label: 'Storage', color: 'text-info' },
  ]},
  { category: 'API', items: [
    { icon: Zap, label: 'Endpoint', color: 'text-ember' },
    { icon: Webhook, label: 'Webhook', color: 'text-warning' },
  ]},
  { category: 'Логика', items: [
    { icon: Workflow, label: 'Workflow', color: 'text-success' },
    { icon: Timer, label: 'Cron Job', color: 'text-text-secondary' },
  ]},
  { category: 'Безопасность', items: [
    { icon: Shield, label: 'Auth Rule', color: 'text-danger' },
    { icon: Key, label: 'Permission', color: 'text-warning' },
  ]},
]

export function EntityPalette() {
  return (
    <div className="flex h-full w-56 flex-col border-r border-edge bg-bg-surface/80 overflow-y-auto">
      <div className="border-b border-edge px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Компоненты
        </h3>
      </div>
      <div className="flex flex-col gap-4 p-3">
        {palette.map((group) => (
          <div key={group.category}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              {group.category}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <button
                  key={item.label}
                  draggable
                  className={cn(
                    'flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-all cursor-grab active:cursor-grabbing',
                    'text-text-secondary hover:text-text-primary hover:bg-bg-raised border border-transparent hover:border-edge'
                  )}
                >
                  <item.icon className={cn('size-4', item.color)} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
