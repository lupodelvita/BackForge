import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useBuilderStore } from '@/store/builderStore'
import TablePanel from '@/components/panels/TablePanel'
import type { ProjectState } from '@/types/schema'

// Mock @xyflow/react - not needed for panel tests
vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
}))

const sampleProject: ProjectState = {
  meta: { name: 'proj', version: '0.1.0', created_at: '', updated_at: '' },
  schema: {
    tables: [
      {
        id: 'tbl-1',
        name: 'users',
        fields: [
          { id: 'f-1', name: 'id', field_type: 'uuid', nullable: false, unique: false, primary_key: true, default_value: null },
          { id: 'f-2', name: 'email', field_type: 'varchar', nullable: false, unique: true, primary_key: false, default_value: null },
        ],
        indexes: [],
      },
    ],
  },
}

describe('TablePanel', () => {
  beforeEach(() => {
    useBuilderStore.setState({ project: null, nodes: [], selectedNodeId: null, isDirty: false })
  })

  it('shows placeholder when no table selected', () => {
    render(<TablePanel />)
    expect(screen.getByText(/select a table/i)).toBeInTheDocument()
  })

  it('shows table name input when table is selected', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().selectNode('tbl-1')
    render(<TablePanel />)
    const input = screen.getByDisplayValue('users') as HTMLInputElement
    expect(input).toBeInTheDocument()
  })

  it('renaming table updates store', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().selectNode('tbl-1')
    render(<TablePanel />)

    const input = screen.getByDisplayValue('users') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'accounts' } })

    const projectTable = useBuilderStore.getState().project!.schema.tables[0]
    expect(projectTable.name).toBe('accounts')
  })

  it('adds a new field on button click', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().selectNode('tbl-1')
    render(<TablePanel />)

    const nameInput = screen.getByPlaceholderText('field_name') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'username' } })
    fireEvent.click(screen.getByText('+ Add field'))

    const fields = useBuilderStore.getState().project!.schema.tables[0].fields
    expect(fields.some((f) => f.name === 'username')).toBe(true)
  })

  it('removes a non-pk field on ✕ click', () => {
    useBuilderStore.getState().setProject(sampleProject)
    useBuilderStore.getState().selectNode('tbl-1')
    render(<TablePanel />)

    const removeButtons = screen.getAllByText('✕')
    // Only non-PK fields have remove buttons
    expect(removeButtons.length).toBe(1)
    fireEvent.click(removeButtons[0])

    const fields = useBuilderStore.getState().project!.schema.tables[0].fields
    expect(fields.every((f) => f.id !== 'f-2')).toBe(true)
  })
})
