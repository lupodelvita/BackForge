import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ProjectState, Table, Field, BuilderNode, NodePosition } from '@/types/schema'

function nanoid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

interface BuilderState {
  project: ProjectState | null
  nodes: BuilderNode[]
  selectedNodeId: string | null
  isDirty: boolean

  // Проект
  setProject: (project: ProjectState) => void

  // Таблицы
  addTable: (name: string) => void
  removeTable: (tableId: string) => void
  renameTable: (tableId: string, name: string) => void

  // Поля
  addField: (tableId: string, field: Omit<Field, 'id'>) => void
  updateField: (tableId: string, fieldId: string, patch: Partial<Field>) => void
  removeField: (tableId: string, fieldId: string) => void
  moveFieldUp: (tableId: string, fieldId: string) => void
  moveFieldDown: (tableId: string, fieldId: string) => void
  setFieldRef: (tableId: string, fieldId: string, references: string | null) => void

  // Canvas
  setNodePosition: (nodeId: string, position: NodePosition) => void
  selectNode: (nodeId: string | null) => void

  // Синхронизация
  markSaved: () => void
}

function makeDefaultTable(name: string): Table {
  return {
    id: nanoid(),
    name,
    fields: [
      {
        id: nanoid(),
        name: 'id',
        field_type: 'uuid',
        nullable: false,
        unique: false,
        primary_key: true,
        default_value: null,
      },
      {
        id: nanoid(),
        name: 'created_at',
        field_type: 'timestamp',
        nullable: true,
        unique: false,
        primary_key: false,
        default_value: null,
      },
    ],
    indexes: [],
  }
}

export const useBuilderStore = create<BuilderState>()(
  immer((set) => ({
    project: null,
    nodes: [],
    selectedNodeId: null,
    isDirty: false,

    setProject: (project) =>
      set((state) => {
        state.project = project
        state.isDirty = false
        // Расставить ноды по сетке если их ещё нет
        if (state.nodes.length === 0) {
          state.nodes = project.schema.tables.map((table, i) => ({
            id: table.id,
            type: 'table',
            position: { x: 80 + (i % 4) * 280, y: 80 + Math.floor(i / 4) * 320 },
          }))
        }
      }),

    addTable: (name) =>
      set((state) => {
        if (!state.project) return
        const table = makeDefaultTable(name)
        state.project.schema.tables.push(table)
        const existingCount = state.nodes.length
        state.nodes.push({
          id: table.id,
          type: 'table',
          position: { x: 80 + (existingCount % 4) * 280, y: 80 + Math.floor(existingCount / 4) * 320 },
        })
        state.isDirty = true
      }),

    removeTable: (tableId) =>
      set((state) => {
        if (!state.project) return
        state.project.schema.tables = state.project.schema.tables.filter((t) => t.id !== tableId)
        state.nodes = state.nodes.filter((n) => n.id !== tableId)
        if (state.selectedNodeId === tableId) state.selectedNodeId = null
        state.isDirty = true
      }),

    renameTable: (tableId, name) =>
      set((state) => {
        if (!state.project) return
        const table = state.project.schema.tables.find((t) => t.id === tableId)
        if (table) { table.name = name; state.isDirty = true }
      }),

    addField: (tableId, field) =>
      set((state) => {
        if (!state.project) return
        const table = state.project.schema.tables.find((t) => t.id === tableId)
        if (table) { table.fields.push({ ...field, id: nanoid() }); state.isDirty = true }
      }),

    updateField: (tableId, fieldId, patch) =>
      set((state) => {
        if (!state.project) return
        const table = state.project.schema.tables.find((t) => t.id === tableId)
        if (!table) return
        const field = table.fields.find((f) => f.id === fieldId)
        if (field) { Object.assign(field, patch); state.isDirty = true }
      }),

    removeField: (tableId, fieldId) =>
      set((state) => {
        if (!state.project) return
        const table = state.project.schema.tables.find((t) => t.id === tableId)
        if (table) { table.fields = table.fields.filter((f) => f.id !== fieldId); state.isDirty = true }
      }),

    moveFieldUp: (tableId, fieldId) =>
      set((state) => {
        if (!state.project) return
        const table = state.project.schema.tables.find((t) => t.id === tableId)
        if (!table) return
        const idx = table.fields.findIndex((f) => f.id === fieldId)
        if (idx <= 0) return
        const tmp = table.fields[idx - 1]
        table.fields[idx - 1] = table.fields[idx]
        table.fields[idx] = tmp
        state.isDirty = true
      }),

    moveFieldDown: (tableId, fieldId) =>
      set((state) => {
        if (!state.project) return
        const table = state.project.schema.tables.find((t) => t.id === tableId)
        if (!table) return
        const idx = table.fields.findIndex((f) => f.id === fieldId)
        if (idx < 0 || idx >= table.fields.length - 1) return
        const tmp = table.fields[idx + 1]
        table.fields[idx + 1] = table.fields[idx]
        table.fields[idx] = tmp
        state.isDirty = true
      }),

    setFieldRef: (tableId, fieldId, references) =>
      set((state) => {
        if (!state.project) return
        const table = state.project.schema.tables.find((t) => t.id === tableId)
        if (!table) return
        const field = table.fields.find((f) => f.id === fieldId)
        if (field) { field.references = references; state.isDirty = true }
      }),

    setNodePosition: (nodeId, position) =>
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId)
        if (node) node.position = position
      }),

    selectNode: (nodeId) =>
      set((state) => { state.selectedNodeId = nodeId }),

    markSaved: () =>
      set((state) => { state.isDirty = false }),
  }))
)
