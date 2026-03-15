import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, PlusCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'
import { gatewayApi, metricsApi } from '@/lib/api'
import type { RouteStats } from '@/lib/types'

export function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject, setProjectNames } = useAppStore()

  const {
    data: projectNames = [],
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await gatewayApi.listProjects()
      setProjectNames(res.data.projects)
      return res.data.projects
    },
    refetchInterval: 30_000,
  })

  const { data: allStats = [] } = useQuery({
    queryKey: ['metrics-all'],
    queryFn: async () => {
      const res = await metricsApi.allStats()
      return res.data.stats
    },
    refetchInterval: 15_000,
  })

  const { data: projectState } = useQuery({
    queryKey: ['project', currentProject],
    queryFn: async () => {
      if (!currentProject) return null
      const res = await gatewayApi.getProject(currentProject)
      return res.data
    },
    enabled: !!currentProject,
    retry: false,
  })

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await gatewayApi.health()).data,
    refetchInterval: 60_000,
    retry: false,
  })

  const userStats = allStats.filter((s: RouteStats) => s.project !== '_gateway')
  const tableCount = projectState?.schema.tables.length ?? 0
  const totalRequests = userStats.reduce((s: number, r: RouteStats) => s + r.requests, 0)
  const totalErrors = userStats.reduce((s: number, r: RouteStats) => s + r.errors, 0)
  const routeCount = userStats.filter(
    (s: RouteStats) => !currentProject || s.project === currentProject,
  ).length

  const statCards = [
    { label: t('dashboard.stats.tables'), value: tableCount, sub: currentProject ?? 'вЂ”', color: 'text-accent' },
    { label: t('dashboard.stats.endpoints'), value: routeCount, sub: `${totalRequests} ${t('metrics.requests').toLowerCase()}`, color: 'text-accent' },
    { label: t('common.projects'), value: projectNames.length, sub: projectNames.slice(0, 2).join(', ') || 'вЂ”', color: 'text-ember' },
    { label: t('metrics.errors'), value: totalErrors, sub: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) + '%' : '0%', color: totalErrors > 0 ? 'text-red-400' : 'text-green-400' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {t('dashboard.subtitle')}
            {healthData && <span className="ml-2 text-green-400 text-xs">В· API {healthData.version} online</span>}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetchProjects()} disabled={projectsLoading}>
          <RefreshCw className={`size-4 ${projectsLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {projectsError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>
            {t('common.error')}: Cannot connect to API gateway (port 8080). Run{' '}
            <code className="font-mono text-xs bg-red-500/20 px-1 rounded">./dev.ps1 up</code>
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="glass">
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">{card.label}</p>
              <p className={`mt-1 text-3xl font-display font-bold ${card.color}`}>{card.value}</p>
              <p className="mt-1 text-xs text-text-secondary truncate">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('common.projects')}</CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => navigate('/builder')}>
                <PlusCircle className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {projectsLoading ? (
              <div className="px-5 py-8 text-center text-sm text-text-muted">{t('common.loading')}</div>
            ) : projectNames.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-text-muted">{t('dashboard.noProjects')}</p>
                <Button variant="default" size="sm" className="mt-3" onClick={() => navigate('/builder')}>
                  {t('dashboard.createProject')}
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-edge">
                {projectNames.map((name) => {
                  const ps = userStats.filter((s: RouteStats) => s.project === name)
                  const req = ps.reduce((a: number, s: RouteStats) => a + s.requests, 0)
                  const err = ps.reduce((a: number, s: RouteStats) => a + s.errors, 0)
                  return (
                    <button
                      key={name}
                      onClick={() => { setCurrentProject(name); navigate('/builder') }}
                      className={`flex w-full items-center gap-4 px-5 py-3 hover:bg-bg-raised/50 transition-colors text-left ${currentProject === name ? 'border-l-2 border-accent bg-accent/5' : ''}`}
                    >
                      <div className="flex size-10 items-center justify-center rounded-lg bg-bg-raised text-accent font-display font-bold text-sm shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{name}</p>
                        <p className="text-xs text-text-muted">{req} req В· {err} err</p>
                      </div>
                      <Badge variant={err === 0 ? 'success' : 'warning'} className="shrink-0">
                        {err === 0 ? t('common.active') : `${err} err`}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t('metrics.requests')}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {userStats.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-text-muted">{t('metrics.noStats')}</div>
            ) : (
              <div className="divide-y divide-edge max-h-72 overflow-y-auto">
                {userStats
                  .filter((s: RouteStats) => !currentProject || s.project === currentProject)
                  .sort((a: RouteStats, b: RouteStats) => b.requests - a.requests)
                  .slice(0, 12)
                  .map((s: RouteStats) => (
                    <div key={`${s.project}-${s.method}-${s.route}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Badge variant="muted" className="font-mono text-xs shrink-0">{s.method}</Badge>
                      <span className="flex-1 font-mono text-sm text-text-secondary truncate">{s.route}</span>
                      <span className="text-text-muted tabular-nums shrink-0">{s.requests}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
