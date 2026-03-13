import { useState } from 'react'
import { Save, Code2, Rocket, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EntityPalette } from '@/components/builder/EntityPalette'
import { Canvas, type CanvasNode } from '@/components/builder/Canvas'
import { Inspector } from '@/components/builder/Inspector'
import { AIPanel } from '@/components/builder/AIPanel'

export function BuilderPage() {
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col -m-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-edge bg-bg-surface/60 px-4 py-2">
        <h1 className="text-sm font-display font-bold tracking-tight">
          Visual Builder
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Play className="size-3" />
            Preview
          </Button>
          <Button variant="secondary" size="sm">
            <Code2 className="size-3" />
            Генерировать код
          </Button>
          <Button variant="secondary" size="sm">
            <Save className="size-3" />
            Сохранить
          </Button>
          <Button size="sm">
            <Rocket className="size-3" />
            Деплой
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <EntityPalette />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Canvas
            onSelectNode={setSelectedNode}
            selectedNodeId={selectedNode?.id ?? null}
          />
          <AIPanel />
        </div>
        <Inspector node={selectedNode} />
      </div>
    </div>
  )
}
