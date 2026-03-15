import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Table2, Zap, Workflow, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CanvasNode } from './Canvas'
import type { ProjectState, SchemaTable, SchemaField, FieldType } from '@/lib/types'

const FIELD_TYPES: FieldType[] = ['text', 'integer', 'big_int', 'float', 'boolean', 'uuid', 'timestamp', 'json', 'bytes']

const typeConfig = {
  table: { icon: Table2, color: 'text-accent', badge: 'default' as const, label: 'Table' },
  endpoint: { icon: Zap, color: 'text-ember', badge: 'ember' as const, label: 'API Endpoint' },
  workflow: { icon: Workflow, color: 'text-success', badge: 'success' as const, label: 'Workflow' },
}

interface InspectorProps {
  node: CanvasNode | null
  projectState?: ProjectState
  onUpdateTable?: (table: SchemaTable) => void
}

export function Inspector({ node, projectState, onUpdateTable }: InspectorProps) {
  const { t } = useTranslation()

  // Find the real table from ProjectState if node is a table type
  const realTable = node?.type === 'table'
    ? projectState?.schema.tables.find((tbl) => tbl.id === node.id || tbl.name === node.label)
    : undefined

  const [editTable, setEditTable] = useState<SchemaTable | null>(realTable ?? null)

  useEffect(() => {
    setEditTable(realTable ?? null)
  }, [realTable])

  const updateField = (idx: number, patch: Partial<SchemaField>) => {
    if (!editTable) return
    const fields = editTable.fields.map((f, i) => i === idx ? { ...f, ...patch } : f)
    const updated = { ...editTable, fields }
    setEditTable(updated)
    onUpdateTable?.(updated)
  }

  const addField = () => {
    if (!editTable) return
    const field: SchemaField = {
      id: crypto.randomUUID(),
      name: 'new_field',
      field_type: 'text',
      nullable: true,
      unique: false,
      primary_key: false,
    }
    const updated = { ...editTable, fields: [...editTable.fields, field] }
    setEditTable(updated)
    onUpdateTable?.(updated)
  }

  const removeField = (idx: number) => {
    if (!editTable) return
    const updated = { ...editTable, fields: editTable.fields.filter((_, i) => i !== idx) }
    setEditTable(updated)
    onUpdateTable?.(updated)
  }

  if (!node) {
    return (
      <div className="flex h-full w-64 flex-col border-l border-edge bg-bg-surface/80">
        <div className="border-b border-edge px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Inspector</h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-text-muted">{t('builder.selectNode')}</p>
        </div>
      </div>
    )
  }

  const config = typeConfig[node.type]

  return (
    <div className="flex h-full w-64 flex-col border-l border-edge bg-bg-surface/80 animate-slide-right">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Inspector</h3>
        <config.icon className={cn('size-3.5', config.color)} />
      </div>

      <div className="border-b border-edge p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={config.badge}>{config.label}</Badge>
        </div>
        <p className="text-sm font-mono font-medium text-text-primary">{node.label}</p>
        {editTable && (
          <p className="text-[10px] text-text-muted">ID: {editTable.id.slice(0, 14)}…</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {node.type === 'table' ? t('builder.fieldName') : 'Properties'}
          </span>
        </div>

        {editTable ? (
          <>
            {editTable.fields.map((field, i) => (
              <div key={field.id} className="group rounded-md border border-edge bg-bg-raised p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    className="flex-1 bg-transparent text-xs font-mono text-text-primary outline-none min-w-0"
                    value={field.name}
                    onChange={(e) => updateField(i, { name: e.target.value })}
                  />
                  <button
                    onClick={() => removeField(i)}
                    className="invisible group-hover:visible text-text-muted hover:text-red-400 cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={field.field_type}
                    onChange={(e) => updateField(i, { field_type: e.target.value as FieldType })}
                    className="rounded border border-edge bg-bg-root px-1.5 py-0.5 text-[10px] text-text-secondary"
                  >
                    {FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
                  </select>
                  {field.primary_key && <Badge variant="default" className="text-[9px] py-0 px-1">PK</Badge>}
                  {field.unique && <Badge variant="muted" className="text-[9px] py-0 px-1">unique</Badge>}
                  {field.nullable && <Badge variant="muted" className="text-[9px] py-0 px-1">null</Badge>}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-text-muted">
                  {[
                    { key: 'nullable', label: 'null' },
                    { key: 'unique', label: 'uniq' },
                    { key: 'primary_key', label: 'PK' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field[key as keyof SchemaField] as boolean}
                        onChange={(e) => updateField(i, { [key]: e.target.checked } as Partial<SchemaField>)}
                        className="accent-accent"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" className="w-full" onClick={addField}>
              <Plus className="size-3" />
              {t('builder.addField')}
            </Button>
          </>
        ) : (
          node.fields?.map((field, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-edge bg-bg-raised px-3 py-2">
              <span className="flex-1 text-xs font-mono text-text-secondary truncate">{field}</span>
            </div>
          ))
        )}
      </div>

      {editTable && (
        <div className="border-t border-edge p-3">
          <Button
            variant="danger"
            size="sm"
            className="w-full"
            onClick={() => {
              const updated: SchemaTable = { ...editTable, fields: [] }
              onUpdateTable?.(updated)
            }}
          >
            <Trash2 className="size-3" />
            {t('common.delete')} table
          </Button>
        </div>
      )}
    </div>
  )
}


