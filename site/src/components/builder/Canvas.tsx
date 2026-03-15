import { useState, useRef, useCallback, useMemo } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  MousePointer2,
  Hand,
  Table2,
  Zap,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectState } from '@/lib/types'

interface CanvasNode {
  id: string
  type: 'table' | 'endpoint' | 'workflow'
  label: string
  x: number
  y: number
  fields?: string[]
}

const nodeIcons = {
  table: Table2,
  endpoint: Zap,
  workflow: Workflow,
}

const nodeColors = {
  table: { border: 'border-accent/40', bg: 'bg-accent/8', icon: 'text-accent', glow: 'hover:shadow-[0_0_20px_oklch(78%_0.155_190/0.15)]' },
  endpoint: { border: 'border-ember/40', bg: 'bg-ember/8', icon: 'text-ember', glow: 'hover:shadow-[0_0_20px_oklch(76%_0.14_55/0.15)]' },
  workflow: { border: 'border-success/40', bg: 'bg-success/8', icon: 'text-success', glow: 'hover:shadow-[0_0_20px_oklch(72%_0.19_148/0.15)]' },
}

// Lay out tables in a grid left-to-right
function buildNodesFromState(projectState: ProjectState): CanvasNode[] {
  return projectState.schema.tables.map((tbl, i) => ({
    id: tbl.id,
    type: 'table' as const,
    label: tbl.name,
    x: 80 + (i % 4) * 220,
    y: 80 + Math.floor(i / 4) * 180,
    fields: tbl.fields.map((f) =>
      `${f.name}: ${f.field_type}${f.primary_key ? ' (PK)' : ''}${f.nullable ? '' : ' NOT NULL'}`
    ),
  }))
}

interface CanvasProps {
  onSelectNode: (node: CanvasNode | null) => void
  selectedNodeId: string | null
  projectState?: ProjectState
}

export function Canvas({ onSelectNode, selectedNodeId, projectState }: CanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(2, z + 0.1)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.3, z - 0.1)), [])
  const handleFit = useCallback(() => setZoom(1), [])

  const nodes: CanvasNode[] = useMemo(() => {
    if (projectState && projectState.schema.tables.length > 0) {
      return buildNodesFromState(projectState)
    }
    return []
  }, [projectState])

  return (
    <div className="relative flex-1 overflow-hidden bg-bg-root">
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-edge bg-bg-surface/90 backdrop-blur-sm p-1 shadow-card">
        <ToolBtn
          icon={MousePointer2}
          active={tool === 'select'}
          onClick={() => setTool('select')}
          tooltip="Выбор"
        />
        <ToolBtn
          icon={Hand}
          active={tool === 'pan'}
          onClick={() => setTool('pan')}
          tooltip="Перемещение"
        />
        <div className="mx-1 h-5 w-px bg-edge" />
        <ToolBtn icon={ZoomIn} onClick={handleZoomIn} tooltip="Приблизить" />
        <ToolBtn icon={ZoomOut} onClick={handleZoomOut} tooltip="Отдалить" />
        <ToolBtn icon={Maximize2} onClick={handleFit} tooltip="Вписать" />
        <div className="mx-1 h-5 w-px bg-edge" />
        <ToolBtn
          icon={Grid3x3}
          active={showGrid}
          onClick={() => setShowGrid(!showGrid)}
          tooltip="Сетка"
        />
        <span className="ml-1 text-[10px] text-text-muted font-mono px-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>

        {/* Canvas area */}
      <div
        ref={canvasRef}
        className={cn(
          'relative h-full w-full',
          tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        )}
        style={{
          backgroundImage: showGrid
            ? 'radial-gradient(circle, oklch(28% 0.015 260) 1px, transparent 1px)'
            : 'none',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        }}
        onClick={() => onSelectNode(null)}
      >
        {/* SVG connection lines — rendered only when there are real tables */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="oklch(45% 0.1 190)" />
            </marker>
          </defs>
        </svg>

        {/* Nodes */}
        <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center pointer-events-none">
              <div className="text-center opacity-40 mt-32">
                <Table2 className="size-10 mx-auto mb-3 text-text-muted" />
                <p className="text-sm text-text-muted">No tables yet — add one from the palette</p>
              </div>
            </div>
          ) : (
            nodes.map((node) => {
              const colors = nodeColors[node.type]
              const Icon = nodeIcons[node.type]
              const isSelected = selectedNodeId === node.id
              return (
                <div
                  key={node.id}
                  className={cn(
                    'absolute w-52 rounded-lg border bg-bg-surface/95 backdrop-blur-sm shadow-card transition-all duration-150 cursor-pointer select-none',
                    colors.border,
                    colors.glow,
                    isSelected && 'ring-2 ring-accent/50 shadow-glow'
                  )}
                  style={{ left: node.x, top: node.y }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectNode(node)
                  }}
                >
                  {/* Node header */}
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-t-lg border-b px-3 py-2',
                      colors.border,
                      colors.bg
                    )}
                  >
                    <Icon className={cn('size-3.5', colors.icon)} />
                    <span className="text-xs font-semibold font-mono text-text-primary truncate">
                      {node.label}
                    </span>
                  </div>
                  {/* Fields */}
                  {node.fields && (
                    <div className="px-3 py-2 space-y-0.5">
                      {node.fields.slice(0, 6).map((f, i) => (
                        <p
                          key={i}
                          className="text-[11px] font-mono text-text-muted truncate"
                        >
                          {f}
                        </p>
                      ))}
                      {node.fields.length > 6 && (
                        <p className="text-[10px] text-text-muted opacity-60">+{node.fields.length - 6} more…</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function ToolBtn({
  icon: Icon,
  active,
  onClick,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>
  active?: boolean
  onClick?: () => void
  tooltip: string
}) {
  return (
    <button
      title={tooltip}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer',
        active
          ? 'bg-accent/15 text-accent'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-raised'
      )}
    >
      <Icon className="size-3.5" />
    </button>
  )
}

export type { CanvasNode }
