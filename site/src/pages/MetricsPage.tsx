import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/appStore'
import { metricsApi } from '@/lib/api'
import type { RouteStats } from '@/lib/types'

const TOOLTIP_STYLE = {
  backgroundColor: 'oklch(18% 0.015 260)',
  border: '1px solid oklch(30% 0.015 260)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'oklch(85% 0.01 260)',
}

const CURSOR_STYLE = { fill: 'oklch(30% 0.015 260 / 0.15)' }

export function MetricsPage() {
  const { t } = useTranslation()
  const { currentProject } = useAppStore()
  const [filter, setFilter] = useState('')

  const { data: allStats = [], isLoading, refetch } = useQuery({
    queryKey: ['metrics-all'],
    queryFn: async () => (await metricsApi.allStats()).data.stats,
    refetchInterval: 10_000,
  })

  const userStats = allStats.filter((s: RouteStats) => s.project !== '_gateway')
  const stats: RouteStats[] = currentProject
    ? userStats.filter((s: RouteStats) => s.project === currentProject)
    : userStats

  // Build time-series data from route stats for the area chart
  const chartData = stats
    .sort((a: RouteStats, b: RouteStats) => b.requests - a.requests)
    .slice(0, 10)
    .map((s: RouteStats) => ({
      name: `${s.method} ${s.route}`.slice(0, 28),
      requests: s.requests,
      errors: s.errors,
      p50: s.total_duration_ms > 0 ? Math.round(s.total_duration_ms / s.requests) : 0,
    }))

  const totalReq = stats.reduce((a: number, s: RouteStats) => a + s.requests, 0)
  const totalErr = stats.reduce((a: number, s: RouteStats) => a + s.errors, 0)
  const avgMs = stats.length > 0
    ? Math.round(stats.reduce((a: number, s: RouteStats) => a + s.total_duration_ms, 0) / Math.max(totalReq, 1))
    : 0
  const errRate = totalReq > 0 ? ((totalErr / totalReq) * 100).toFixed(2) : '0.00'

  const filteredStats = stats.filter(
    (s: RouteStats) =>
      !filter ||
      s.route.toLowerCase().includes(filter.toLowerCase()) ||
      s.method.toLowerCase().includes(filter.toLowerCase()),
  )

  const summaryCards = [
    { label: t('metrics.totalRequests'), value: totalReq, icon: TrendingUp, color: 'text-accent' },
    { label: t('metrics.totalErrors'), value: totalErr, icon: totalErr > 0 ? TrendingDown : Minus, color: totalErr > 0 ? 'text-red-400' : 'text-green-400' },
    { label: t('metrics.avgDuration') + ' (ms)', value: avgMs, icon: Minus, color: 'text-ember' },
    { label: t('metrics.errorRate'), value: errRate + '%', icon: Minus, color: totalErr > 0 ? 'text-red-400' : 'text-green-400' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">{t('metrics.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('metrics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current animate-pulse" />
            Live
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} className="glass">
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-widest text-text-muted">{card.label}</p>
              <p className={`mt-1 text-3xl font-display font-bold ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top routes bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('metrics.requests')} — Top 10 routes</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-muted">{t('metrics.noStats')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(25% 0.01 260)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'oklch(55% 0.01 260)', fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={180} tick={{ fill: 'oklch(55% 0.01 260)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR_STYLE} />
                <Legend />
                <Bar dataKey="requests" name={t('metrics.requests')} fill="oklch(78% 0.155 190)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="errors" name={t('metrics.errors')} fill="oklch(60% 0.2 25)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Avg duration area chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('metrics.avgDuration')} per route (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ left: 0, right: 24 }}>
                <defs>
                  <linearGradient id="durGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(76% 0.14 55)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(76% 0.14 55)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(25% 0.01 260)" />
                <XAxis dataKey="name" hide />
                <YAxis tick={{ fill: 'oklch(55% 0.01 260)', fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={CURSOR_STYLE} />
                <Area type="monotone" dataKey="p50" name="avg ms" stroke="oklch(76% 0.14 55)" fill="url(#durGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Route stats table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm">{t('metrics.route')} stats</CardTitle>
            <Input
              placeholder={t('metrics.filterLogs')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-48 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStats.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">{t('metrics.noStats')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge text-text-muted">
                    <th className="py-2.5 pl-4 text-left text-xs font-semibold uppercase tracking-wider">{t('metrics.method')}</th>
                    <th className="py-2.5 text-left text-xs font-semibold uppercase tracking-wider">{t('metrics.route')}</th>
                    <th className="py-2.5 text-right text-xs font-semibold uppercase tracking-wider">{t('metrics.requests')}</th>
                    <th className="py-2.5 text-right text-xs font-semibold uppercase tracking-wider">{t('metrics.errors')}</th>
                    <th className="py-2.5 text-right text-xs font-semibold uppercase tracking-wider">{t('metrics.minDuration')}</th>
                    <th className="py-2.5 text-right text-xs font-semibold uppercase tracking-wider">{t('metrics.maxDuration')}</th>
                    <th className="py-2.5 pr-4 text-right text-xs font-semibold uppercase tracking-wider">{t('metrics.lastSeen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((s: RouteStats) => (
                    <tr key={`${s.project}-${s.method}-${s.route}`} className="border-b border-edge/50 hover:bg-bg-raised/30 transition-colors">
                      <td className="py-2.5 pl-4">
                        <Badge variant="muted" className="font-mono text-xs">{s.method}</Badge>
                      </td>
                      <td className="py-2.5 font-mono text-sm text-text-secondary">{s.route}</td>
                      <td className="py-2.5 text-right tabular-nums text-text-primary">{s.requests}</td>
                      <td className={`py-2.5 text-right tabular-nums ${s.errors > 0 ? 'text-red-400' : 'text-text-muted'}`}>{s.errors}</td>
                      <td className="py-2.5 text-right tabular-nums text-text-muted">{s.min_duration_ms.toFixed(1)}</td>
                      <td className="py-2.5 text-right tabular-nums text-text-muted">{s.max_duration_ms.toFixed(1)}</td>
                      <td className="py-2.5 pr-4 text-right text-text-muted">
                        {new Date(s.last_seen_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
