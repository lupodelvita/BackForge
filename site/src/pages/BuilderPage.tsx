import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Save, Code2, Rocket, AlertCircle, CheckCircle2,
  Loader2, Download, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EntityPalette } from '@/components/builder/EntityPalette'
import { Canvas, type CanvasNode } from '@/components/builder/Canvas'
import { Inspector } from '@/components/builder/Inspector'
import { AIPanel } from '@/components/builder/AIPanel'
import { useAppStore } from '@/stores/appStore'
import { gatewayApi, codegenApi } from '@/lib/api'
import type { ProjectState, SchemaTable } from '@/lib/types'

// Download generated files as a zip-like blob (or individual files)
function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function BuilderPage() {
  const { t } = useTranslation()
  const { currentProject, currentProjectState, setCurrentProjectState } = useAppStore()
  const qc = useQueryClient()
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string> | null>(null)

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg })
    setTimeout(() => setNotification(null), 3500)
  }

  // Load project state from gateway
  const { isLoading: projectLoading } = useQuery({
    queryKey: ['project', currentProject],
    queryFn: async () => {
      if (!currentProject) return null
      const res = await gatewayApi.getProject(currentProject)
      setCurrentProjectState(res.data)
      return res.data
    },
    enabled: !!currentProject,
    retry: false,
    staleTime: 30_000,
  })

  // Save project state
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject || !currentProjectState) throw new Error('No project')
      await gatewayApi.saveProject(currentProject, currentProjectState)
    },
    onSuccess: () => {
      notify('success', t('builder.projectSaved'))
      qc.invalidateQueries({ queryKey: ['project', currentProject] })
    },
    onError: (e: Error) => notify('error', e.message),
  })

  // Generate all code
  const genMutation = useMutation({
    mutationFn: async () => {
      if (!currentProjectState) throw new Error('No project state')
      const res = await codegenApi.generateAll({ state: currentProjectState })
      return res.data.files
    },
    onSuccess: (files) => {
      setGeneratedFiles(files)
      notify('success', t('builder.codeGenerated'))
    },
    onError: (e: Error) => notify('error', e.message),
  })

  // Validate
  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!currentProjectState) throw new Error('No project state')
      const res = await codegenApi.validate({ state: currentProjectState })
      return res.data
    },
    onSuccess: (data) => {
      notify(data.report.valid ? 'success' : 'error',
        data.report.valid ? t('builder.validationPassed') : `${t('builder.validationFailed')}: ${data.report.errors.join(', ')}`)
    },
    onError: (e: Error) => notify('error', e.message),
  })

  // Update project state when inspector changes a table
  const updateTable = useCallback((table: SchemaTable) => {
    if (!currentProjectState) return
    const updated: ProjectState = {
      ...currentProjectState,
      schema: {
        tables: currentProjectState.schema.tables.map((t_) =>
          t_.id === table.id ? table : t_,
        ),
      },
    }
    setCurrentProjectState(updated)
  }, [currentProjectState, setCurrentProjectState])

  // Add a new table from entity palette
  const addTable = useCallback((tableName: string) => {
    if (!currentProjectState) return
    const newTable: SchemaTable = {
      id: crypto.randomUUID(),
      name: tableName.toLowerCase().replace(/\s+/g, '_'),
      fields: [
        { id: crypto.randomUUID(), name: 'id', field_type: 'uuid', nullable: false, unique: true, primary_key: true },
        { id: crypto.randomUUID(), name: 'created_at', field_type: 'timestamp', nullable: false, unique: false, primary_key: false },
      ],
      indexes: [],
    }
    setCurrentProjectState({
      ...currentProjectState,
      schema: { tables: [...currentProjectState.schema.tables, newTable] },
    })
  }, [currentProjectState, setCurrentProjectState])

  if (!currentProject) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-text-muted animate-fade-in">
        <div className="text-center">
          <p className="text-sm">{t('builder.noProject')}</p>
          <p className="text-xs mt-1 text-text-muted">Select a project from the sidebar or Dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col -m-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-edge bg-bg-surface/60 px-4 py-2 gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-display font-bold tracking-tight">{t('builder.title')}</h1>
          {currentProject && (
            <Badge variant="muted" className="font-mono">{currentProject}</Badge>
          )}
          {projectLoading && <Loader2 className="size-3.5 animate-spin text-text-muted" />}
          {currentProjectState && (
            <span className="text-xs text-text-muted">
              {currentProjectState.schema.tables.length} tables
            </span>
          )}
        </div>

        {/* Notification */}
        {notification && (
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
            notification.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {notification.type === 'success'
              ? <CheckCircle2 className="size-3.5" />
              : <AlertCircle className="size-3.5" />}
            {notification.msg}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending || !currentProjectState}
          >
            {validateMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
            {t('builder.preview')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => genMutation.mutate()}
            disabled={genMutation.isPending || !currentProjectState}
          >
            {genMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Code2 className="size-3" />}
            {t('builder.generate')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !currentProjectState}
          >
            {saveMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {t('common.save')}
          </Button>
          <a
            href="/deploy"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-accent/15 px-3 py-1.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors"
          >
              <Rocket className="size-3" />
              {t('common.deploy')}
            </a>
        </div>
      </div>

      {/* Generated files panel */}
      {generatedFiles && (
        <div className="border-b border-edge bg-bg-raised/80 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">{t('builder.codeGenerated')}:</span>
            {Object.keys(generatedFiles).map((fname) => (
              <button
                key={fname}
                onClick={() => downloadFile(fname, generatedFiles[fname] ?? '')}
                className="flex items-center gap-1 rounded border border-edge bg-bg-root px-2 py-0.5 text-xs font-mono text-accent hover:border-accent/40 transition-colors"
              >
                <Download className="size-2.5" />
                {fname}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <EntityPalette onAddTable={addTable} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Canvas
            onSelectNode={setSelectedNode}
            selectedNodeId={selectedNode?.id ?? null}
            projectState={currentProjectState ?? undefined}
          />
          <AIPanel
            projectState={currentProjectState ?? undefined}
            onApply={(state) => setCurrentProjectState(state)}
          />
        </div>
        <Inspector
          node={selectedNode}
          projectState={currentProjectState ?? undefined}
          onUpdateTable={updateTable}
        />
      </div>
    </div>
  )
}
