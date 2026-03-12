import { useState } from 'react'
import type { FieldType } from '@/types/schema'
import { useBuilderStore } from '@/store'

const FIELD_TYPES: FieldType[] = [
  'uuid', 'integer', 'bigint', 'smallint', 'float', 'double',
  'boolean', 'text', 'varchar', 'char', 'json', 'jsonb',
  'timestamp', 'date', 'time', 'bytea', 'serial', 'bigserial',
]

const panelStyle: React.CSSProperties = {
  width: 300,
  background: '#1e1e2e',
  borderLeft: '1px solid #313244',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#cdd6f4',
  overflowY: 'auto',
}

const sectionStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #313244',
}

export default function TablePanel() {
  const { project, selectedNodeId, renameTable, addField, updateField, removeField, removeTable } =
    useBuilderStore()

  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')

  const table = project?.schema.tables.find((t) => t.id === selectedNodeId)

  if (!table) {
    return (
      <div style={{ ...panelStyle, alignItems: 'center', justifyContent: 'center', color: '#6c7086' }}>
        Select a table to edit
      </div>
    )
  }

  const handleAddField = () => {
    const name = newFieldName.trim()
    if (!name) return
    addField(table.id, {
      name,
      field_type: newFieldType,
      nullable: true,
      unique: false,
      primary_key: false,
      default_value: null,
    })
    setNewFieldName('')
    setNewFieldType('text')
  }

  return (
    <div style={panelStyle}>
      {/* Table name */}
      <div style={sectionStyle}>
        <div style={{ color: '#89dceb', fontWeight: 700, marginBottom: 8 }}>Table</div>
        <input
          value={table.name}
          onChange={(e) => renameTable(table.id, e.target.value)}
          style={inputStyle}
          placeholder="Table name"
        />
        <button
          onClick={() => removeTable(table.id)}
          style={{ ...btnStyle, marginTop: 8, background: '#45475a', color: '#f38ba8' }}
        >
          Delete table
        </button>
      </div>

      {/* Fields list */}
      <div style={{ ...sectionStyle, flex: 1 }}>
        <div style={{ color: '#a6e3a1', fontWeight: 700, marginBottom: 8 }}>
          Fields ({table.fields.length})
        </div>
        {table.fields.map((field) => (
          <div
            key={field.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '6px 8px',
              marginBottom: 6,
              background: '#181825',
              borderRadius: 6,
              border: '1px solid #313244',
            }}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={field.name}
                onChange={(e) => updateField(table.id, field.id, { name: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
                disabled={field.primary_key}
                title={field.primary_key ? 'Primary key field cannot be renamed' : undefined}
              />
              <select
                value={field.field_type}
                onChange={(e) => updateField(table.id, field.id, { field_type: e.target.value as FieldType })}
                style={{ ...inputStyle, width: 90 }}
                disabled={field.primary_key}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', opacity: field.primary_key ? 0.4 : 1 }}>
                <input
                  type="checkbox"
                  checked={field.nullable}
                  disabled={field.primary_key}
                  onChange={(e) => updateField(table.id, field.id, { nullable: e.target.checked })}
                />
                nullable
              </label>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', opacity: field.primary_key ? 0.4 : 1 }}>
                <input
                  type="checkbox"
                  checked={field.unique}
                  disabled={field.primary_key}
                  onChange={(e) => updateField(table.id, field.id, { unique: e.target.checked })}
                />
                unique
              </label>
              {!field.primary_key && (
                <button
                  onClick={() => removeField(table.id, field.id)}
                  style={{ ...btnStyle, marginLeft: 'auto', background: 'transparent', color: '#f38ba8', padding: '2px 6px' }}
                >
                  ✕
                </button>
              )}
              {field.primary_key && (
                <span style={{ marginLeft: 'auto', color: '#f9e2af', opacity: 0.7, fontSize: 10 }}>PK</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add field */}
      <div style={sectionStyle}>
        <div style={{ color: '#cba6f7', fontWeight: 700, marginBottom: 8 }}>Add field</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
            placeholder="field_name"
            style={{ ...inputStyle, flex: 1 }}
          />
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
            style={{ ...inputStyle, width: 90 }}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAddField}
          style={{ ...btnStyle, marginTop: 8, background: '#313244', color: '#a6e3a1' }}
        >
          + Add field
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#313244',
  border: '1px solid #45475a',
  borderRadius: 4,
  color: '#cdd6f4',
  padding: '4px 8px',
  fontFamily: 'monospace',
  fontSize: 12,
  boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 10px',
  border: '1px solid #45475a',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 12,
  transition: 'opacity 0.15s',
}
