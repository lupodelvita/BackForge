import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Rocket,
  XCircle, Loader2,
  RefreshCw, Cloud, HardDrive, Cpu,
  RotateCcw, GitBranch, ArrowLeftRight, Terminal, ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/stores/appStore'
import { deployApi, syncApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { DeploymentRecord, DeployTarget } from '@/lib/types'

const TARGET_ICONS: Record<DeployTarget, typeof HardDrive> = {
  local: HardDrive,
  cloud: Cloud,
  edge: Cpu,
}

/* в”Ђв”Ђв”Ђ New Deployment Modal в”Ђв”Ђв”Ђ */

function NewDeployModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation()
  const { currentProject } = useAppStore()
  const [target, setTarget] = useState<DeployTarget>('local')
  const [port, setPort] = useState(3000)
  const [projectName, setProjectName] = useState(currentProject ?? '')

  const mutation = useMutation({
    mutationFn: () => deployApi.create(projectName, target, port),
    onSuccess: () => { onCreated(); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-edge bg-bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-display font-semibold mb-4">{t('deploy.createDeployment')}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">{t('common.project')}</label>
            <input
              className="w-full rounded-lg border border-edge bg-bg-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-project"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">{t('deploy.target')}</label>
            <div className="flex gap-2">
              {(['local', 'cloud', 'edge'] as DeployTarget[]).map((t_) => (
                <button
                  key={t_}
                  onClick={() => setTarget(t_)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-xs transition-all',
                    target === t_
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-edge bg-bg-raised text-text-muted hover:border-accent/40',
                  )}
                >
                  {t_}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">{t('deploy.port')}</label>
            <input
              type="number"
              className="w-full rounded-lg border border-edge bg-bg-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !projectName}
          >
            {mutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
            {t('deploy.createDeployment')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* в”Ђв”Ђв”Ђ Deployment Card в”Ђв”Ђв”Ђ */

function DeploymentCard({ dep, onStop }: { dep: DeploymentRecord; onStop: (id: string) => void }) {
  const { t } = useTranslation()
  const [showDockerfile, setShowDockerfile] = useState(false)
  const { data: dockerfile } = useQuery({
    queryKey: ['dockerfile', dep.id],
    queryFn: async () => (await deployApi.getDockerfile(dep.id)).data,
    enabled: showDockerfile,
  })

  const TargetIcon = TARGET_ICONS[dep.target]
  const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
    pending: 'warning',
    running: 'default',
    stopped: 'muted',
    failed: 'danger',
  }
  const progress = dep.status === 'running' ? 66 : dep.status === 'pending' ? 20 : dep.status === 'stopped' ? 100 : 0

  return (
    <div className="rounded-lg border border-edge bg-bg-raised/50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <TargetIcon className="size-5 text-text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">{dep.project_name}</span>
            <Badge variant={statusVariant[dep.status] ?? 'muted'}>{t(`deploy.status.${dep.status}`)}</Badge>
            <Badge variant="muted" className="font-mono">{dep.target}</Badge>
          </div>
          <p className="text-[11px] text-text-muted font-mono mt-0.5">
            ID: {dep.id.slice(0, 14)}вЂ¦
            {dep.container_id && ` В· container: ${dep.container_id.slice(0, 12)}`}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {dep.url && (
            <a
              href={dep.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-7 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-raised transition-colors"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => setShowDockerfile(!showDockerfile)}>
            <Terminal className="size-3.5" />
          </Button>
          {(dep.status === 'running' || dep.status === 'pending') && (
            <Button variant="ghost" size="icon-sm" onClick={() => onStop(dep.id)}>
              <XCircle className="size-3.5 text-red-400" />
            </Button>
          )}
        </div>
      </div>
      <Progress value={progress} variant={dep.status === 'failed' ? 'danger' : dep.status === 'stopped' ? 'success' : 'accent'} size="sm" />
      {dep.error && <p className="text-xs text-red-400 font-mono">{dep.error}</p>}
      {showDockerfile && dockerfile && (
        <pre className="mt-2 rounded-lg bg-bg-root p-3 text-[10px] font-mono text-text-secondary overflow-x-auto max-h-48 overflow-y-auto">
          {dockerfile}
        </pre>
      )}
      <p className="text-[10px] text-text-muted">
        {dep.port > 0 && `port ${dep.port} В· `}
        {new Date(dep.created_at).toLocaleString()}
      </p>
    </div>
  )
}

/* в”Ђв”Ђв”Ђ Sync Panel в”Ђв”Ђв”Ђ */

function SyncPanel({ project }: { project: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data: latest, isLoading } = useQuery({
    queryKey: ['sync-latest', project],
    queryFn: async () => (await syncApi.latest(project)).data,
    enabled: !!project,
    retry: false,
  })
  const { data: history = [] } = useQuery({
    queryKey: ['sync-history', project],
    queryFn: async () => (await syncApi.history(project)).data,
    enabled: !!project,
    retry: false,
  })

  const { currentProjectState } = useAppStore()

  const pushMutation = useMutation({
    mutationFn: async () => {
      if (!currentProjectState) throw new Error('No project state')
      const content = btoa(JSON.stringify(currentProjectState))
      const sha = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
        .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''))
      return syncApi.push(project, {
        id: crypto.randomUUID(),
        project_name: project,
        node_id: localStorage.getItem('backforge_node_id') ?? 'browser',
        clock: {},
        sha256: sha,
        content,
        created_at: new Date().toISOString(),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-latest', project] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-edge bg-bg-raised/50 p-4">
        <div className="flex items-center gap-3">
          <HardDrive className="size-5 text-accent" />
          <div>
            <p className="text-sm font-medium text-text-primary">Local</p>
            <p className="text-xs font-mono text-text-muted">
              {currentProjectState
                ? `${currentProjectState.schema.tables.length} tables`
                : 'not loaded'}
            </p>
          </div>
        </div>
        <ArrowLeftRight className="size-5 text-text-muted" />
        <div className="text-right">
          {isLoading ? (
            <p className="text-xs text-text-muted">{t('common.loading')}</p>
          ) : latest ? (
            <>
              <p className="text-sm font-medium text-text-primary">Synced</p>
              <p className="text-xs font-mono text-text-muted truncate max-w-[120px]">
                {latest.sha256.slice(0, 10)}вЂ¦
              </p>
            </>
          ) : (
            <p className="text-xs text-text-muted">No snapshots</p>
          )}
        </div>
      </div>
      {history.length > 0 && (
        <p className="text-xs text-text-muted">{history.length} snapshots in history</p>
      )}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => pushMutation.mutate()}
        disabled={pushMutation.isPending || !currentProjectState}
      >
        {pushMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        {t('deploy.syncPush')}
      </Button>
    </div>
  )
}

/* в”Ђв”Ђв”Ђ Page в”Ђв”Ђв”Ђ */

export function DeployPage() {
  const { t } = useTranslation()
  const { currentProject } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

  const { data: deployments = [], isLoading, refetch } = useQuery({
    queryKey: ['deployments'],
    queryFn: async () => (await deployApi.list()).data,
    refetchInterval: 5_000,
    retry: false,
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => deployApi.stop(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  })

  const filtered: DeploymentRecord[] = currentProject
    ? deployments.filter((d: DeploymentRecord) => d.project_name === currentProject)
    : deployments

  const running = filtered.filter((d: DeploymentRecord) => d.status === 'running').length

  return (
    <div className="space-y-6 animate-fade-in">
      {showModal && (
        <NewDeployModal
          onClose={() => setShowModal(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['deployments'] }) }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{t('deploy.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('deploy.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {running > 0 && (
            <Badge variant="default">
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-accent animate-pulse" />
              {running} running
            </Badge>
          )}
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Rocket className="size-4" />
            {t('deploy.createDeployment')}
          </Button>
        </div>
      </div>

      {/* Active deployments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{t('deploy.activeDeployments')}</CardTitle>
            <span className="text-xs text-text-muted">{filtered.length} total</span>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">{t('deploy.noDeployments')}</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((dep: DeploymentRecord) => (
                <DeploymentCard key={dep.id} dep={dep} onStop={(id) => stopMutation.mutate(id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync + rollback */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('deploy.sync')}</CardTitle>
          </CardHeader>
          <CardContent>
            {currentProject ? (
              <SyncPanel project={currentProject} />
            ) : (
              <p className="text-sm text-text-muted">{t('builder.noProject')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('deploy.rollback')}</CardTitle>
          </CardHeader>
          <CardContent>
            {currentProject ? <SyncHistory project={currentProject} /> : (
              <p className="text-sm text-text-muted">{t('builder.noProject')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SyncHistory({ project }: { project: string }) {
  const { t } = useTranslation()
  const { data: history = [] } = useQuery({
    queryKey: ['sync-history', project],
    queryFn: async () => (await syncApi.history(project)).data,
    enabled: !!project,
    retry: false,
  })

  if (history.length === 0) {
    return <p className="text-sm text-text-muted py-4 text-center">{t('deploy.noDeployments')}</p>
  }

  return (
    <div className="divide-y divide-edge">
      {history.map((snap, i) => (
        <div key={snap.id} className="flex items-center gap-3 py-3 px-1">
          <GitBranch className={cn('size-4 shrink-0', i === 0 ? 'text-accent' : 'text-text-muted')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-medium text-text-primary">
                {snap.sha256.slice(0, 8)}
              </span>
              {i === 0 && <Badge variant="default">latest</Badge>}
            </div>
            <p className="text-[11px] text-text-muted">
              {new Date(snap.created_at).toLocaleString()} В· {snap.node_id}
            </p>
          </div>
          {i > 0 && (
            <Button variant="ghost" size="sm" className="shrink-0" disabled>
              <RotateCcw className="size-3" />
              {t('deploy.rollbackTo')}
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}