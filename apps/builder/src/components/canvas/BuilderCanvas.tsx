import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useBuilderStore } from '@/store'
import TableNode, { type TableNodeType } from '@/components/nodes/TableNode'

const nodeTypes: NodeTypes = {
  table: TableNode as unknown as NodeTypes['table'],
}

export default function BuilderCanvas() {
  const { project, nodes: builderNodes, selectedNodeId, setNodePosition, selectNode } = useBuilderStore()

  // FK edges derived from uuid *_id fields
  const rfEdges: Edge[] = useMemo(() => {
    if (!project) return []
    const edges: Edge[] = []
    const tablesByName = new Map(project.schema.tables.map((t) => [t.name, t]))
    for (const table of project.schema.tables) {
      for (const field of table.fields) {
        if (field.primary_key || field.field_type !== 'uuid' || !field.name.endsWith('_id')) continue
        const base = field.name.slice(0, -3)
        const targetName =
          field.references ??
          tablesByName.get(base + 's')?.name ??
          tablesByName.get(base)?.name
        const target = targetName ? tablesByName.get(targetName) : undefined
        if (!target || target.id === table.id) continue
        edges.push({
          id: `fk-${table.id}-${field.id}`,
          source: table.id,
          target: target.id,
          label: field.name,
          type: 'smoothstep',
          style: { stroke: '#89b4fa', strokeWidth: 1.5 },
          labelStyle: { fill: '#6c7086', fontSize: 10 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#89b4fa' },
        })
      }
    }
    return edges
  }, [project])

  // Преобразуем BuilderNode[] в формат ReactFlow Node[]
  const rfNodes: TableNodeType[] = useMemo(() => {
    if (!project) return []
    return builderNodes.map((bn) => {
      const table = project.schema.tables.find((t) => t.id === bn.id)
      return {
        id: bn.id,
        type: 'table' as const,
        position: bn.position,
        selected: bn.id === selectedNodeId,
        data: { table: table! },
      }
    }).filter((n) => n.data.table !== undefined)
  }, [project, builderNodes, selectedNodeId])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, rfNodes)
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          setNodePosition(change.id, change.position)
        }
      })
      void updated // suppress lint warning — positions are synced above
    },
    [rfNodes, setNodePosition]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id)
    },
    [selectNode]
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  if (!project) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6c7086',
          fontFamily: 'monospace',
          fontSize: 14,
        }}
      >
        No project loaded — paste code or create tables to start
      </div>
    )
  }

  return (
    <div style={{ flex: 1, height: '100%' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: '#11111b' }}
      >
        <Background color="#313244" gap={24} lineWidth={0.5} />
        <Controls style={{ background: '#1e1e2e', border: '1px solid #313244' }} />
        <MiniMap
          nodeColor={(n) => (n.selected ? '#89b4fa' : '#313244')}
          style={{ background: '#1e1e2e', border: '1px solid #313244' }}
        />
      </ReactFlow>
    </div>
  )
}
