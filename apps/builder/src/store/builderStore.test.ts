import { describe, it, expect, beforeEach } from 'vitest'
import { useBuilderStore } from '@/store/builderStore'
import type { ProjectState } from '@/types/schema'

const sampleProject: ProjectState = {
  meta: {
    id: 'meta-001',
    name: 'test-project',
    description: null,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  schema: {
    tables: [
      {
        id: 'tbl-001',
        name: 'users',
        fields: [
          { id: 'f-001', name: 'id', field_type: 'uuid', nullable: false, unique: false, primary_key: true, default_value: null },
          { id: 'f-002', name: 'email', field_type: 'text', nullable: false, unique: true, primary_key: false, default_value: null },
        ],
        indexes: [],
      },
    ],
  },
}

describe('useBuilderStore', () => {
  beforeEach(() => {
    useBuilderStore.setState({
      project: null,
      nodes: [],
      selectedNodeId: null,
      isDirty: false,
    })
  })

  it('setProject stores project and generates nodes', () => {
    const { setProject } = useBuilderStore.getState()
    setProject(sampleProject)

    const state = useBuilderStore.getState()
    expect(state.project).toEqual(sampleProject)
    expect(state.nodes).toHaveLength(1)
    expect(state.nodes[0].id).toBe('tbl-001')
    expect(state.isDirty).toBe(false)
  })

  it('addTable creates table with default id field', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().addTable('posts')

    const state = useBuilderStore.getState()
    expect(state.project!.schema.tables).toHaveLength(2)
    const posts = state.project!.schema.tables.find((t) => t.name === 'posts')!
    expect(posts).toBeDefined()
    expect(posts.fields.some((f) => f.primary_key)).toBe(true)
    expect(state.isDirty).toBe(true)
    // node created
    expect(state.nodes).toHaveLength(2)
  })

  it('renameTable updates name and marks dirty', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().renameTable('tbl-001', 'accounts')

    const state = useBuilderStore.getState()
    expect(state.project!.schema.tables[0].name).toBe('accounts')
    expect(state.isDirty).toBe(true)
  })

  it('removeTable removes table and its node', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().selectNode('tbl-001')
    useBuilderStore.getState().removeTable('tbl-001')

    const state = useBuilderStore.getState()
    expect(state.project!.schema.tables).toHaveLength(0)
    expect(state.nodes).toHaveLength(0)
    expect(state.selectedNodeId).toBeNull()
    expect(state.isDirty).toBe(true)
  })

  it('addField appends field to correct table', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().addField('tbl-001', {
      name: 'name',
      field_type: 'text',
      nullable: true,
      unique: false,
      primary_key: false,
      default_value: null,
    })

    const state = useBuilderStore.getState()
    const table = state.project!.schema.tables[0]
    expect(table.fields).toHaveLength(3)
    expect(table.fields[2].name).toBe('name')
    expect(state.isDirty).toBe(true)
  })

  it('updateField patches field props', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().updateField('tbl-001', 'f-002', { field_type: 'text', nullable: true })

    const field = useBuilderStore.getState().project!.schema.tables[0].fields[1]
    expect(field.field_type).toBe('text')
    expect(field.nullable).toBe(true)
  })

  it('removeField removes field from table', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().removeField('tbl-001', 'f-002')

    const table = useBuilderStore.getState().project!.schema.tables[0]
    expect(table.fields).toHaveLength(1)
    expect(table.fields.every((f) => f.id !== 'f-002')).toBe(true)
  })

  it('setNodePosition updates position', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().setNodePosition('tbl-001', { x: 500, y: 300 })

    const node = useBuilderStore.getState().nodes.find((n) => n.id === 'tbl-001')!
    expect(node.position).toEqual({ x: 500, y: 300 })
  })

  it('markSaved resets isDirty', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().addTable('orders')
    expect(useBuilderStore.getState().isDirty).toBe(true)

    useBuilderStore.getState().markSaved()
    expect(useBuilderStore.getState().isDirty).toBe(false)
  })
})
