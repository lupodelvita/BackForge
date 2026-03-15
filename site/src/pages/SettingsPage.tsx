import { useEffect, useState } from 'react'
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
  Plus,
  Save,
  Globe,
  Check,
  Play,
  RefreshCw,
  AlertCircle,
  Github,
  UserCircle,
  CheckCircle2,
  XCircle,
  ShieldHalf,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { gatewayApi, authApi } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
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
  { name: 'Auth0', description: 'Authentication & user management', category: 'Auth', connected: false, color: 'text-ember' },
  { name: 'Stripe', description: 'Payments & subscriptions', category: 'Payments', connected: false, color: 'text-info' },
  { name: 'GitHub', description: 'Repositories & CI/CD', category: 'DevOps', connected: false, color: 'text-text-primary' },
  { name: 'Twilio', description: 'SMS & push notifications', category: 'Messaging', connected: false, color: 'text-danger' },
  { name: 'Redis', description: 'Caching & message queues', category: 'Data', connected: false, color: 'text-danger' },
  { name: 'S3 / MinIO', description: 'Object storage', category: 'Storage', connected: false, color: 'text-ember' },
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
  { name: 'GitHub Actions', enabled: false, trigger: 'on push to main' },
  { name: 'GitLab CI', enabled: false, trigger: 'manual' },
  { name: 'Auto-test on deploy', enabled: false, trigger: 'pre-deploy hook' },
  { name: 'Auto-migration', enabled: false, trigger: 'on schema change' },
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

const rbacRoles: { name: string; permissions: string[]; users: number }[] = []

function SecurityPanel() {
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
          {rbacRoles.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Users className="mx-auto size-8 text-text-muted/50 mb-2" />
              <p className="text-sm text-text-muted">No roles configured yet</p>
              <p className="text-xs text-text-muted/70 mt-1">Create roles to manage access control for your team</p>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">API Keys</CardTitle>
            <Button variant="secondary" size="sm"><Plus className="size-3" />Generate Key</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="px-1 py-6 text-center">
            <Key className="mx-auto size-8 text-text-muted/50 mb-2" />
            <p className="text-sm text-text-muted">No API keys generated</p>
            <p className="text-xs text-text-muted/70 mt-1">Generate keys to authenticate external API access</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Security Checks</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[
            'SQL Injection Protection', 'XSS Prevention', 'CSRF Tokens',
            'Rate Limiting', 'Audit Logging', 'Input Validation',
          ].map((label) => (
            <div key={label} className="flex items-center justify-between rounded-md px-3 py-2 bg-bg-raised/50 border border-edge">
              <div className="flex items-center gap-2">
                <Lock className="size-3.5 text-text-muted" />
                <span className="text-sm text-text-primary">{label}</span>
              </div>
              <Badge variant="muted">not configured</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Account (GitHub Connect) ─── */

function AccountPanel() {
  const { t } = useTranslation()
  const { currentProjectState } = useAppStore()
  const { user, setAuth } = useAuthStore()
  const [connecting, setConnecting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [callbackUrl, setCallbackUrl] = useState('')

  // Pick up ?github_connected=true from Settings redirect after OAuth
  const searchParams = new URLSearchParams(window.location.search)
  const justConnected = searchParams.get('github_connected') === 'true'
  const projectId = currentProjectState?.meta?.id

  async function handleConnect() {
    setConnecting(true)
    setErrorMsg('')
    try {
      const res = await authApi.githubConnectInit()
      window.location.href = res.data.url
    } catch {
      setErrorMsg(t('auth.errors.generic'))
      setConnecting(false)
    }
  }

  // Refresh user from /auth/me if we just connected
  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authApi.me().then((r) => r.data),
    enabled: justConnected,
    staleTime: 0,
  })

  const platformStatusQuery = useQuery({
    queryKey: ['platform-github-status'],
    queryFn: () => authApi.platformGitHubStatus().then((r) => r.data),
  })

  const providerConfigQuery = useQuery({
    queryKey: ['github-provider-config', projectId ?? 'account'],
    queryFn: () => authApi.getGitHubProviderConfig(projectId).then((r) => r.data),
    enabled: !!user,
  })

  const saveProviderConfig = useMutation({
    mutationFn: () => authApi.saveGitHubProviderConfig({
      project_id: projectId,
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
    }),
    onSuccess: ({ data }) => {
      setClientId(data.client_id ?? '')
      setCallbackUrl(data.callback_url ?? '')
      setClientSecret('')
      providerConfigQuery.refetch()
    },
  })

  const currentUser = meQuery.data ?? user

  useEffect(() => {
    if (!meQuery.data || meQuery.data === user) {
      return
    }
    const token = localStorage.getItem('backforge_token')
    if (token) {
      setAuth(meQuery.data, token)
    }
  }, [meQuery.data, setAuth, user])

  useEffect(() => {
    if (!providerConfigQuery.data) {
      return
    }
    setClientId(providerConfigQuery.data.client_id ?? '')
    setCallbackUrl(providerConfigQuery.data.callback_url ?? '')
    setClientSecret('')
  }, [providerConfigQuery.data])

  return (
    <div className="space-y-4">
      {/* User info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCircle className="size-4" />
            {t('nav.settings')} — {t('auth.username')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent/15 border border-accent/25 text-accent font-bold text-sm">
              {currentUser?.username?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
            <div>
              <p className="text-sm font-medium text-text-primary">{currentUser?.username}</p>
              <p className="text-xs text-text-muted">{currentUser?.email}</p>
            </div>
          </div>
          {currentUser?.has_password && (
            <Badge variant="success">Password login enabled</Badge>
          )}
        </CardContent>
      </Card>

      {/* GitHub Connect */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Github className="size-4" />
            {t('auth.github.connectTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-muted">{t('auth.github.connectDescription')}</p>

          {(justConnected || currentUser?.has_github) ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="size-4" />
                <span className="text-sm font-medium">{t('auth.github.connected')}</span>
              </div>
              {currentUser?.github_username && (
                <p className="text-sm text-text-secondary">
                  {t('auth.github.connectedAs')}{' '}
                  <a
                    href={`https://github.com/${currentUser.github_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-medium"
                  >
                    @{currentUser.github_username}
                  </a>
                </p>
              )}
              {justConnected && (
                <p className="text-xs text-success">{t('auth.github.connectSuccess')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-text-muted">
                <XCircle className="size-4" />
                <span className="text-sm">{t('auth.github.notConnected')}</span>
              </div>
              {errorMsg && (
                <p className="text-xs text-danger">{errorMsg}</p>
              )}
              <Button
                variant="secondary"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Github className="size-3.5" />
                )}
                {t('auth.github.connectButton')}
              </Button>
              <p className="text-xs text-text-muted">
                You will be redirected to GitHub to authorize access.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Github className="size-4" />
            GitHub OAuth App Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-edge bg-bg-raised/50 p-4 space-y-2">
            <p className="text-sm text-text-primary font-medium">Platform login vs your project OAuth</p>
            <p className="text-xs text-text-muted">
              GitHub sign-in for BackForge itself uses one platform OAuth app. That is not per-user.
              If you want GitHub auth inside your own generated public app, save your own OAuth app config below.
              It will be stored under your account and current project scope.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={platformStatusQuery.data?.configured ? 'success' : 'muted'}>
                Platform OAuth: {platformStatusQuery.data?.configured ? 'configured' : 'not configured'}
              </Badge>
              <Badge variant={providerConfigQuery.data?.configured ? 'success' : 'muted'}>
                {projectId ? 'Project GitHub App' : 'Account GitHub App'}: {providerConfigQuery.data?.configured ? 'saved' : 'not saved'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Client ID</label>
              <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Iv1.abc123..." />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Callback URL</label>
              <Input value={callbackUrl} onChange={(e) => setCallbackUrl(e.target.value)} placeholder="https://your-app.com/auth/github/callback" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Client Secret</label>
            <Input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={providerConfigQuery.data?.has_secret ? 'Secret already saved. Enter a new one to rotate.' : 'gho_...'}
            />
            <p className="text-xs text-text-muted">
              Stored encrypted in the database and scoped to {projectId ? 'this project' : 'your account'}.
            </p>
          </div>

          {saveProviderConfig.isError && (
            <p className="text-xs text-danger">Failed to save OAuth app config.</p>
          )}
          {saveProviderConfig.isSuccess && (
            <p className="text-xs text-success">OAuth app config saved.</p>
          )}

          <Button
            onClick={() => saveProviderConfig.mutate()}
            disabled={saveProviderConfig.isPending || !clientId || !clientSecret || !callbackUrl}
          >
            {saveProviderConfig.isPending ? <RefreshCw className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save GitHub OAuth App
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Admin Panel (platform admin only) ─── */

function AdminPanel() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [callbackUrl, setCallbackUrl] = useState('')

  const configQuery = useQuery({
    queryKey: ['admin-platform-config'],
    queryFn: () => authApi.getAdminPlatformConfig().then((r) => r.data),
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!configQuery.data) return
    setClientId(configQuery.data.github_client_id ?? '')
    setCallbackUrl(configQuery.data.github_callback_url ?? '')
    setClientSecret('')
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      authApi.saveAdminPlatformConfig({
        github_client_id: clientId,
        github_client_secret: clientSecret,
        github_callback_url: callbackUrl,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-platform-config'] })
      qc.invalidateQueries({ queryKey: ['platform-github-status'] })
    },
  })

  const configured = configQuery.data?.configured_via_env
    ? true
    : configQuery.data?.has_secret && !!configQuery.data.github_client_id

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Github className="size-4" />
            {t('admin.platformGithub.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-edge bg-bg-raised/50 p-4 space-y-2">
            <p className="text-sm text-text-primary font-medium">{t('admin.platformGithub.description')}</p>
            <p className="text-xs text-text-muted">{t('admin.platformGithub.hint')}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant={configured ? 'success' : 'muted'}>
                {configured
                  ? t('admin.platformGithub.statusConfigured')
                  : t('admin.platformGithub.statusNotConfigured')}
              </Badge>
              {configQuery.data?.configured_via_env && (
                <Badge variant="info">{t('admin.platformGithub.viaEnv')}</Badge>
              )}
            </div>
          </div>

          {configQuery.data?.configured_via_env ? (
            <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3">
              <p className="text-xs text-info">{t('admin.platformGithub.envOverride')}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">{t('admin.platformGithub.clientId')}</label>
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Iv1.abc123..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary">{t('admin.platformGithub.callbackUrl')}</label>
                  <Input
                    value={callbackUrl}
                    onChange={(e) => setCallbackUrl(e.target.value)}
                    placeholder="https://your-backforge.com/auth/github/callback"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">{t('admin.platformGithub.clientSecret')}</label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={
                    configQuery.data?.has_secret
                      ? t('admin.platformGithub.secretRotate')
                      : 'gho_...'
                  }
                />
                <p className="text-xs text-text-muted">{t('admin.platformGithub.secretHint')}</p>
              </div>

              {saveMutation.isError && (
                <p className="text-xs text-danger">{t('admin.platformGithub.saveError')}</p>
              )}
              {saveMutation.isSuccess && (
                <p className="text-xs text-success">{t('admin.platformGithub.saveSuccess')}</p>
              )}

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending ||
                  !clientId ||
                  !callbackUrl ||
                  (!clientSecret && !configQuery.data?.has_secret)
                }
              >
                {saveMutation.isPending ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {t('admin.platformGithub.save')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Page ─── */

export function SettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('general')

  const isAdmin = user?.role === 'admin'

  const tabs = [
    { id: 'general', label: t('settings.general'), icon: Sliders },
    { id: 'account', label: 'Account', icon: UserCircle },
    { id: 'language', label: t('settings.language'), icon: Globe },
    { id: 'integrations', label: t('settings.integrations'), icon: Plug },
    { id: 'cicd', label: t('settings.cicd'), icon: GitBranch },
    { id: 'security', label: t('settings.security'), icon: Shield },
    ...(isAdmin ? [{ id: 'admin', label: t('admin.tab'), icon: ShieldHalf }] : []),
  ]

  const panels: Record<string, React.ReactNode> = {
    general: <GeneralPanel />,
    account: <AccountPanel />,
    language: <LanguagePanel />,
    integrations: <IntegrationsPanel />,
    cicd: <CICDPanel />,
    security: <SecurityPanel />,
    admin: <AdminPanel />,
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
