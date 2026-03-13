import { useState, useRef, useCallback } from 'react'
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

interface CanvasNode {
  id: string
  type: 'table' | 'endpoint' | 'workflow'
  label: string
  x: number
  y: number
  fields?: string[]
}

const demoNodes: CanvasNode[] = [
  {
    id: '1',
    type: 'table',
    label: 'users',
    x: 120,
    y: 80,
    fields: ['id: UUID (PK)', 'email: TEXT', 'name: TEXT', 'created_at: TIMESTAMP'],
  },
  {
    id: '2',
    type: 'table',
    label: 'posts',
    x: 420,
    y: 60,
    fields: ['id: UUID (PK)', 'title: TEXT', 'body: TEXT', 'user_id: UUID (FK)'],
  },
  {
    id: '3',
    type: 'endpoint',
    label: 'POST /api/users',
    x: 120,
    y: 320,
    fields: ['Create user', 'Auth: public', 'Rate limit: 10/min'],
  },
  {
    id: '4',
    type: 'endpoint',
    label: 'GET /api/posts',
    x: 420,
    y: 300,
    fields: ['List posts', 'Auth: bearer', 'Pagination: cursor'],
  },
  {
    id: '5',
    type: 'workflow',
    label: 'onUserCreated',
    x: 750,
    y: 160,
    fields: ['Trigger: user.created', 'Send welcome email', 'Init defaults'],
  },
]

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

interface CanvasProps {
  onSelectNode: (node: CanvasNode | null) => void
  selectedNodeId: string | null
}

export function Canvas({ onSelectNode, selectedNodeId }: CanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(2, z + 0.1)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.3, z - 0.1)), [])
  const handleFit = useCallback(() => setZoom(1), [])

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
        {/* SVG connection lines */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="oklch(45% 0.1 190)" />
            </marker>
          </defs>
          {/* users → POST /api/users */}
          <line x1="220" y1="170" x2="220" y2="320" stroke="oklch(45% 0.1 190)" strokeWidth="1.5" strokeDasharray="6 3" markerEnd="url(#arrowhead)" />
          {/* posts → GET /api/posts */}
          <line x1="520" y1="150" x2="520" y2="300" stroke="oklch(45% 0.1 55)" strokeWidth="1.5" strokeDasharray="6 3" markerEnd="url(#arrowhead)" />
          {/* users → posts FK */}
          <line x1="320" y1="120" x2="420" y2="100" stroke="oklch(55% 0.08 260)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
          {/* posts → workflow */}
          <line x1="620" y1="120" x2="750" y2="180" stroke="oklch(45% 0.1 148)" strokeWidth="1.5" strokeDasharray="6 3" markerEnd="url(#arrowhead)" />
        </svg>

        {/* Nodes */}
        <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          {demoNodes.map((node) => {
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
                    {node.fields.map((f, i) => (
                      <p
                        key={i}
                        className="text-[11px] font-mono text-text-muted truncate"
                      >
                        {f}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
