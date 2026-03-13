import { Table2, Zap, Workflow, X, Pencil, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CanvasNode } from './Canvas'

const typeConfig = {
  table: { icon: Table2, color: 'text-accent', badge: 'default' as const, label: 'Table' },
  endpoint: { icon: Zap, color: 'text-ember', badge: 'ember' as const, label: 'API Endpoint' },
  workflow: { icon: Workflow, color: 'text-success', badge: 'success' as const, label: 'Workflow' },
}

interface InspectorProps {
  node: CanvasNode | null
}

export function Inspector({ node }: InspectorProps) {
  if (!node) {
    return (
      <div className="flex h-full w-64 flex-col border-l border-edge bg-bg-surface/80">
        <div className="border-b border-edge px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Inspector
          </h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-text-muted">
            Выберите элемент на Canvas для просмотра свойств
          </p>
        </div>
      </div>
    )
  }

  const config = typeConfig[node.type]

  return (
    <div className="flex h-full w-64 flex-col border-l border-edge bg-bg-surface/80 animate-slide-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Inspector
        </h3>
        <button className="text-text-muted hover:text-text-primary cursor-pointer">
          <X className="size-3.5" />
        </button>
      </div>

      {/* Node info */}
      <div className="border-b border-edge p-4 space-y-3">
        <div className="flex items-center gap-2">
          <config.icon className={cn('size-4', config.color)} />
          <Badge variant={config.badge}>{config.label}</Badge>
        </div>
        <div>
          <label className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted block">
            Название
          </label>
          <Input defaultValue={node.label} className="font-mono text-xs" />
        </div>
      </div>

      {/* Fields / Properties */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {node.type === 'table' ? 'Поля' : 'Свойства'}
          </span>
          <Button variant="ghost" size="icon-sm">
            <Pencil className="size-3" />
          </Button>
        </div>
        {node.fields?.map((field, i) => (
          <div
            key={i}
            className="group flex items-center gap-2 rounded-md border border-edge bg-bg-raised px-3 py-2"
          >
            <span className="flex-1 text-xs font-mono text-text-secondary truncate">
              {field}
            </span>
            <button className="invisible group-hover:visible text-text-muted hover:text-danger cursor-pointer">
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        <Button variant="secondary" size="sm" className="w-full">
          + Добавить {node.type === 'table' ? 'поле' : 'свойство'}
        </Button>
      </div>

      {/* Actions */}
      <div className="border-t border-edge p-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1">
          <Copy className="size-3" />
          Дублировать
        </Button>
        <Button variant="danger" size="sm" className="flex-1">
          <Trash2 className="size-3" />
          Удалить
        </Button>
      </div>
    </div>
  )
}
