import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Table2,
  Zap,
  Workflow,
  HardDrive,
  Shield,
  Key,
  Webhook,
  Timer,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaletteItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
  addable?: boolean
}

const palette: { category: string; items: PaletteItem[] }[] = [
  { category: 'Data', items: [
    { icon: Table2, label: 'Table', color: 'text-accent', addable: true },
    { icon: HardDrive, label: 'Storage', color: 'text-info' },
  ]},
  { category: 'API', items: [
    { icon: Zap, label: 'Endpoint', color: 'text-ember' },
    { icon: Webhook, label: 'Webhook', color: 'text-warning' },
  ]},
  { category: 'Logic', items: [
    { icon: Workflow, label: 'Workflow', color: 'text-success' },
    { icon: Timer, label: 'Cron Job', color: 'text-text-secondary' },
  ]},
  { category: 'Security', items: [
    { icon: Shield, label: 'Auth Rule', color: 'text-danger' },
    { icon: Key, label: 'Permission', color: 'text-warning' },
  ]},
]

interface EntityPaletteProps {
  onAddTable?: (name: string) => void
}

export function EntityPalette({ onAddTable }: EntityPaletteProps) {
  const { t } = useTranslation()
  const [newTableName, setNewTableName] = useState('')
  const [showNewTable, setShowNewTable] = useState(false)

  const handleAddTable = () => {
    const name = newTableName.trim() || 'new_table'
    onAddTable?.(name)
    setNewTableName('')
    setShowNewTable(false)
  }

  return (
    <div className="flex h-full w-56 flex-col border-r border-edge bg-bg-surface/80 overflow-y-auto">
      <div className="border-b border-edge px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          {t('builder.entities')}
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
                  onClick={item.addable && onAddTable ? () => setShowNewTable(true) : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-all cursor-grab active:cursor-grabbing',
                    'text-text-secondary hover:text-text-primary hover:bg-bg-raised border border-transparent hover:border-edge'
                  )}
                >
                  <item.icon className={cn('size-4', item.color)} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.addable && onAddTable && (
                    <Plus className="size-3 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {showNewTable && (
          <div className="rounded-lg border border-accent/40 bg-bg-raised p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              New Table
            </p>
            <input
              autoFocus
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTable()
                if (e.key === 'Escape') setShowNewTable(false)
              }}
              placeholder="table_name"
              className="w-full rounded border border-edge bg-bg-root px-2 py-1 text-xs font-mono text-text-primary outline-none focus:border-accent"
            />
            <div className="flex gap-1">
              <button
                onClick={handleAddTable}
                className="flex-1 rounded bg-accent/15 px-2 py-1 text-[10px] text-accent hover:bg-accent/25"
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => setShowNewTable(false)}
                className="flex-1 rounded bg-bg-root px-2 py-1 text-[10px] text-text-muted hover:text-text-primary"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
