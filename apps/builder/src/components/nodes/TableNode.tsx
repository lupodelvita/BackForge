import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import clsx from 'clsx'
import type { Table } from '@/types/schema'
import { useBuilderStore } from '@/store'

export type TableNodeData = {
  table: Table
}

export type TableNodeType = Node<TableNodeData, 'table'>

function TableNode({ id, data, selected }: NodeProps<TableNodeType>) {
  const selectNode = useBuilderStore((s) => s.selectNode)
  const { table } = data as TableNodeData

  return (
    <div
      className={clsx(
        'table-node',
        (selected as boolean) && 'table-node--selected'
      )}
      onClick={() => selectNode(id as string)}
      style={{
        minWidth: 220,
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#89b4fa' : '#313244'}`,
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#cdd6f4',
        boxShadow: selected ? '0 0 0 2px #89b4fa44' : '0 2px 8px #00000066',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          background: selected ? '#313244' : '#181825',
          borderBottom: '1px solid #313244',
          borderRadius: '6px 6px 0 0',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 0.3,
          color: '#89dceb',
        }}
      >
        {table.name}
      </div>

      {/* Fields */}
      <div style={{ padding: '4px 0 8px' }}>
        {(table as Table).fields.map((field) => (
          <div
            key={field.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 12px',
              color: field.primary_key ? '#f9e2af' : '#cdd6f4',
            }}
          >
            <span style={{ opacity: 0.5, fontSize: 10 }}>
              {field.primary_key ? '🔑' : field.unique ? '◆' : '·'}
            </span>
            <span style={{ flex: 1 }}>{field.name}</span>
            <span style={{ opacity: 0.55, color: '#a6e3a1', fontSize: 11 }}>
              {field.field_type}
              {field.nullable ? '?' : ''}
            </span>
          </div>
        ))}

        {table.fields.length === 0 && (
          <div style={{ padding: '4px 12px', opacity: 0.4 }}>no fields</div>
        )}
      </div>

      {/* ReactFlow connection handles — top & bottom */}
      <Handle type="target" position={Position.Top} style={{ background: '#89b4fa' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#a6e3a1' }} />
    </div>
  )
}

export default memo(TableNode)
