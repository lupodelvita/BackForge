import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useBuilderStore } from '@/store'
import TableNode, { type TableNodeData } from '@/components/nodes/TableNode'

const nodeTypes: NodeTypes = {
  table: TableNode as unknown as NodeTypes['table'],
}

export default function BuilderCanvas() {
  const { project, nodes: builderNodes, selectedNodeId, setNodePosition, selectNode } = useBuilderStore()

  // Преобразуем BuilderNode[] в формат ReactFlow Node[]
  const rfNodes: Node<TableNodeData>[] = useMemo(() => {
    if (!project) return []
    return builderNodes.map((bn) => {
      const table = project.schema.tables.find((t) => t.id === bn.id)
      return {
        id: bn.id,
        type: 'table',
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
        edges={[]}
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
