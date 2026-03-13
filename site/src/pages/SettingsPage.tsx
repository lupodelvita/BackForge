import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plug,
  GitBranch,
  Shield,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Key,
  Users,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Save,
  Globe,
  Check,
  Play,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { gatewayApi } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import { SUPPORTED_LANGUAGES } from '@/i18n'

/* ─── Migrations Panel ─── */

function MigrationsPanel() {
  const { t } = useTranslation()
  const { currentProject } = useAppStore()
  const qc = useQueryClient()

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ['migration-status', currentProject],
    queryFn: () => currentProject ? gatewayApi.getMigrationStatus(currentProject) : null,
    enabled: !!currentProject,
  })

  const runMutation = useMutation({
    mutationFn: () => gatewayApi.runMigrations(currentProject!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['migration-status', currentProject] }),
  })

  if (!currentProject) {
    return <p className="text-sm text-text-muted p-4">No project selected.</p>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{t('settings.migrations.title')}</CardTitle>
            <Button
              size="sm"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
            >
              {runMutation.isPending ? (
                <RefreshCw className="size-3 animate-spin" />
              ) : (
                <Play className="size-3" />
              )}
              {t('settings.migrations.run')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-text-muted">Loading…</p>}
          {isError && (
            <div className="flex items-center gap-2 text-danger text-sm">
              <AlertCircle className="size-4" />
              Failed to fetch migration status
            </div>
          )}
          {runMutation.isError && (
            <div className="flex items-center gap-2 text-danger text-sm mt-2">
              <AlertCircle className="size-4" />
              Migration failed: {String((runMutation.error as Error)?.message)}
            </div>
          )}
          {status && (
            <div className="space-y-2 mt-2">
              <div className="flex gap-4 text-sm">
                <span className="text-text-muted">{t('settings.migrations.applied')}:
                  <span className="ml-1 font-mono text-success">{status.data.applied?.length ?? 0}</span>
                </span>
                <span className="text-text-muted">{t('settings.migrations.pending')}:
                  <span className="ml-1 font-mono text-warning">{status.data.pending?.length ?? 0}</span>
                </span>
              </div>
              {(status.data.pending?.length ?? 0) === 0 && (
                <p className="text-xs text-text-muted">{t('settings.migrations.noMigrations')}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── General Settings ─── */

function GeneralPanel() {
  const { t } = useTranslation()
  const { currentProject, currentProjectState, setCurrentProjectState } = useAppStore()
  const qc = useQueryClient()

  const [name, setName] = useState(currentProjectState?.meta?.name ?? currentProject ?? '')
  const [description, setDescription] = useState(currentProjectState?.meta?.description ?? '')

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!currentProject || !currentProjectState) return Promise.resolve()
      const updated = {
        ...currentProjectState,
        meta: { ...currentProjectState.meta, name, description },
      }
      return gatewayApi.saveProject(currentProject, updated).then(() => {
        setCurrentProjectState(updated)
        qc.invalidateQueries({ queryKey: ['projects'] })
      })
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('settings.general')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">
              {t('settings.projectName')}
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">
              {t('settings.projectDescription')}
            </label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">
              {t('settings.apiUrl')} (Gateway)
            </label>
            <Input
              readOnly
              value={import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:8080'}
              className="font-mono text-xs bg-bg-surface"
            />
          </div>
          <Button
            className="mt-2"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !currentProject}
          >
            {saveMutation.isPending ? <RefreshCw className="size-3 animate-spin" /> : <Save className="size-3.5" />}
            {t('settings.saveSettings')}
          </Button>
          {saveMutation.isSuccess && (
            <p className="text-xs text-success">{t('common.saved')}</p>
          )}
        </CardContent>
      </Card>

      <MigrationsPanel />
    </div>
  )
}

/* ─── Language Panel ─── */

function LanguagePanel() {
  const { t, i18n } = useTranslation()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="size-4" />
            {t('settings.language')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-all cursor-pointer',
                  i18n.language === lang.code
                    ? 'border-accent/60 bg-accent/10 text-accent'
                    : 'border-edge bg-bg-raised/50 text-text-secondary hover:border-edge-strong hover:text-text-primary'
                )}
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="font-medium">{lang.label}</span>
                {i18n.language === lang.code && (
                  <Check className="ml-auto size-4" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Integrations ─── */

const integrations = [
  { name: 'Auth0', description: 'Authentication & user management', category: 'Auth', connected: true, color: 'text-ember' },
  { name: 'Stripe', description: 'Payments & subscriptions', category: 'Payments', connected: false, color: 'text-info' },
  { name: 'GitHub', description: 'Repositories & CI/CD', category: 'DevOps', connected: true, color: 'text-text-primary' },
  { name: 'Twilio', description: 'SMS & push notifications', category: 'Messaging', connected: false, color: 'text-danger' },
  { name: 'Redis', description: 'Caching & message queues', category: 'Data', connected: true, color: 'text-danger' },
  { name: 'S3 / MinIO', description: 'Object storage', category: 'Storage', connected: true, color: 'text-ember' },
]

function IntegrationsPanel() {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {integrations.map((int) => (
        <div
          key={int.name}
          className="flex items-center gap-3 rounded-lg border border-edge bg-bg-raised/50 p-4 hover:border-edge-strong transition-all"
        >
          <div className={cn('flex size-10 items-center justify-center rounded-lg bg-bg-surface font-display font-bold text-sm', int.color)}>
            {int.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">{int.name}</span>
              <Badge variant={int.connected ? 'success' : 'muted'}>
                {int.connected ? 'connected' : 'not connected'}
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted truncate">{int.description}</p>
          </div>
          <Button variant={int.connected ? 'ghost' : 'outline'} size="sm">
            {int.connected ? t('common.edit') : t('common.connect')}
          </Button>
        </div>
      ))}
    </div>
  )
}

/* ─── CI/CD ─── */

const pipelines = [
  { name: 'GitHub Actions', enabled: true, trigger: 'on push to main' },
  { name: 'GitLab CI', enabled: false, trigger: 'manual' },
  { name: 'Auto-test on deploy', enabled: true, trigger: 'pre-deploy hook' },
  { name: 'Auto-migration', enabled: true, trigger: 'on schema change' },
]

function CICDPanel() {
  const [states, setStates] = useState(pipelines.map((p) => p.enabled))

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {pipelines.map((pipeline, i) => (
          <div key={pipeline.name} className="flex items-center justify-between rounded-lg border border-edge bg-bg-raised/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">{pipeline.name}</p>
              <p className="text-[11px] text-text-muted">Trigger: {pipeline.trigger}</p>
            </div>
            <button
              onClick={() => setStates((s) => s.map((v, j) => (j === i ? !v : v)))}
              className={cn('transition-colors cursor-pointer', states[i] ? 'text-accent' : 'text-text-muted')}
            >
              {states[i] ? <ToggleRight className="size-7" /> : <ToggleLeft className="size-7" />}
            </button>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Webhook URL</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value="https://backforge.local/hooks/deploy/abc123" className="font-mono text-xs" />
            <Button variant="secondary" size="md">Copy</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Security ─── */

const rbacRoles = [
  { name: 'admin', permissions: ['read', 'write', 'delete', 'manage'], users: 1 },
  { name: 'developer', permissions: ['read', 'write'], users: 3 },
  { name: 'viewer', permissions: ['read'], users: 5 },
]

function SecurityPanel() {
  const [showKeys, setShowKeys] = useState(false)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">RBAC — Roles & Permissions</CardTitle>
            <Button variant="secondary" size="sm"><Plus className="size-3" />New Role</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-edge">
            {rbacRoles.map((role) => (
              <div key={role.name} className="flex items-center gap-4 px-5 py-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-bg-raised">
                  <Users className="size-4 text-text-muted" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-text-primary">{role.name}</span>
                    <span className="text-[11px] text-text-muted">({role.users} user{role.users !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {role.permissions.map((perm) => <Badge key={perm} variant="muted">{perm}</Badge>)}
                  </div>
                </div>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">API Keys</CardTitle>
            <button onClick={() => setShowKeys(!showKeys)} className="text-text-muted hover:text-text-primary cursor-pointer">
              {showKeys ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Production', key: 'bf_prod_a1b2c3d4e5f6g7h8i9j0', active: true },
            { name: 'Development', key: 'bf_dev_k1l2m3n4o5p6q7r8s9t0', active: true },
          ].map((apiKey) => (
            <div key={apiKey.name} className="flex items-center gap-3 rounded-lg border border-edge bg-bg-raised/50 px-4 py-3">
              <Key className="size-4 text-text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{apiKey.name}</p>
                <p className="text-xs font-mono text-text-muted truncate">
                  {showKeys ? apiKey.key : '••••••••••••••••••••••'}
                </p>
              </div>
              <Badge variant={apiKey.active ? 'success' : 'muted'}>{apiKey.active ? 'active' : 'revoked'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Security Checks</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[
            'SQL Injection Protection', 'XSS Prevention', 'CSRF Tokens',
            'Rate Limiting', 'Audit Logging', 'Input Validation',
          ].map((label) => (
            <div key={label} className="flex items-center justify-between rounded-md px-3 py-2 bg-success/5 border border-success/15">
              <div className="flex items-center gap-2">
                <Lock className="size-3.5 text-success" />
                <span className="text-sm text-text-primary">{label}</span>
              </div>
              <Badge variant="success">enabled</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Page ─── */

export function SettingsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('general')

  const tabs = [
    { id: 'general', label: t('settings.general'), icon: Sliders },
    { id: 'language', label: t('settings.language'), icon: Globe },
    { id: 'integrations', label: t('settings.integrations'), icon: Plug },
    { id: 'cicd', label: t('settings.cicd'), icon: GitBranch },
    { id: 'security', label: t('settings.security'), icon: Shield },
  ]

  const panels: Record<string, React.ReactNode> = {
    general: <GeneralPanel />,
    language: <LanguagePanel />,
    integrations: <IntegrationsPanel />,
    cicd: <CICDPanel />,
    security: <SecurityPanel />,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Project config, CI/CD, security, language
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-edge bg-bg-surface p-1 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all cursor-pointer',
              activeTab === tab.id
                ? 'bg-accent/12 text-accent shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-raised'
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">{panels[activeTab]}</div>
    </div>
  )
}
