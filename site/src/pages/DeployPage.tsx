import {
  Rocket,
  Package,
  TestTube2,
  HeartPulse,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  Cloud,
  HardDrive,
  Cpu,
  RotateCcw,
  GitBranch,
  ArrowLeftRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

/* ─── Deploy Pipeline ─── */

const pipelineSteps = [
  { id: 'build', label: 'Build', icon: Package, status: 'done' as const },
  { id: 'test', label: 'Тесты', icon: TestTube2, status: 'done' as const },
  { id: 'deploy', label: 'Deploy', icon: Rocket, status: 'running' as const },
  { id: 'health', label: 'Health Check', icon: HeartPulse, status: 'pending' as const },
]

const statusIcon = {
  done: CheckCircle2,
  running: Loader2,
  pending: Clock,
  failed: XCircle,
}

const statusColor = {
  done: 'text-success',
  running: 'text-accent',
  pending: 'text-text-muted',
  failed: 'text-danger',
}

function DeployPipeline() {
  return (
    <div className="flex items-center gap-2">
      {pipelineSteps.map((step, i) => {
        const Icon = statusIcon[step.status]
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-4 py-3 transition-all',
                step.status === 'running'
                  ? 'border-accent/40 bg-accent/8 shadow-glow'
                  : step.status === 'done'
                    ? 'border-success/30 bg-success/5'
                    : 'border-edge bg-bg-raised'
              )}
            >
              <Icon
                className={cn(
                  'size-5',
                  statusColor[step.status],
                  step.status === 'running' && 'animate-spin'
                )}
              />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {step.label}
                </p>
                <p className="text-[10px] text-text-muted">
                  {step.status === 'done'
                    ? 'Завершено'
                    : step.status === 'running'
                      ? 'В процессе...'
                      : 'Ожидание'}
                </p>
              </div>
            </div>
            {i < pipelineSteps.length - 1 && (
              <div
                className={cn(
                  'h-px w-8',
                  step.status === 'done' ? 'bg-success/40' : 'bg-edge'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Active Deployments ─── */

const deployments = [
  {
    id: 'dep-1',
    project: 'my-saas-app',
    target: 'local',
    targetIcon: HardDrive,
    version: 'v1.4.2',
    status: 'running' as const,
    progress: 78,
    started: '2 мин. назад',
  },
  {
    id: 'dep-2',
    project: 'my-saas-app',
    target: 'cloud',
    targetIcon: Cloud,
    version: 'v1.4.1',
    status: 'done' as const,
    progress: 100,
    started: '1 час назад',
  },
  {
    id: 'dep-3',
    project: 'iot-gateway',
    target: 'edge',
    targetIcon: Cpu,
    version: 'v0.8.0',
    status: 'done' as const,
    progress: 100,
    started: '3 часа назад',
  },
]

function ActiveDeployments() {
  return (
    <div className="space-y-3">
      {deployments.map((dep) => (
        <div
          key={dep.id}
          className="flex items-center gap-4 rounded-lg border border-edge bg-bg-raised/50 px-4 py-3"
        >
          <dep.targetIcon className="size-5 text-text-muted shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {dep.project}
              </span>
              <Badge variant={dep.status === 'running' ? 'default' : 'success'}>
                {dep.target}
              </Badge>
              <span className="text-xs font-mono text-text-muted">
                {dep.version}
              </span>
            </div>
            <Progress
              value={dep.progress}
              variant={dep.status === 'running' ? 'accent' : 'success'}
              size="sm"
              className="mt-2"
            />
          </div>
          <div className="text-right shrink-0">
            <Badge
              variant={
                dep.status === 'running'
                  ? 'default'
                  : dep.status === 'done'
                    ? 'success'
                    : 'danger'
              }
            >
              {dep.status === 'running' ? `${dep.progress}%` : 'Done'}
            </Badge>
            <p className="mt-0.5 text-[10px] text-text-muted">{dep.started}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Sync Panel ─── */

function SyncPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-edge bg-bg-raised/50 p-4">
        <div className="flex items-center gap-3">
          <HardDrive className="size-5 text-accent" />
          <div>
            <p className="text-sm font-medium text-text-primary">Локальная</p>
            <p className="text-xs font-mono text-text-muted">v1.4.2 · commit abc1234</p>
          </div>
        </div>
        <ArrowLeftRight className="size-5 text-text-muted" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-text-primary">Облачная</p>
            <p className="text-xs font-mono text-text-muted">v1.4.1 · commit def5678</p>
          </div>
          <Cloud className="size-5 text-ember" />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Последняя синхронизация: 5 мин. назад</span>
        <Badge variant="warning">1 отличие</Badge>
      </div>
      <Button variant="outline" className="w-full">
        <RefreshCw className="size-3.5" />
        Синхронизировать сейчас
      </Button>
    </div>
  )
}

/* ─── Rollback History ─── */

const versions = [
  { version: 'v1.4.2', date: '13 мар 2026, 16:40', author: 'alice', status: 'active' as const },
  { version: 'v1.4.1', date: '13 мар 2026, 15:00', author: 'bob', status: 'previous' as const },
  { version: 'v1.3.0', date: '12 мар 2026, 10:20', author: 'alice', status: 'previous' as const },
  { version: 'v1.2.5', date: '10 мар 2026, 09:15', author: 'ci-bot', status: 'previous' as const },
  { version: 'v1.2.0', date: '8 мар 2026, 14:30', author: 'alice', status: 'previous' as const },
]

function RollbackHistory() {
  return (
    <div className="divide-y divide-edge">
      {versions.map((v) => (
        <div key={v.version} className="flex items-center gap-3 py-3 px-1">
          <GitBranch className={cn('size-4 shrink-0', v.status === 'active' ? 'text-accent' : 'text-text-muted')} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-medium text-text-primary">
                {v.version}
              </span>
              {v.status === 'active' && (
                <Badge variant="default">current</Badge>
              )}
            </div>
            <p className="text-[11px] text-text-muted">
              {v.date} · {v.author}
            </p>
          </div>
          {v.status !== 'active' && (
            <Button variant="ghost" size="sm" className="shrink-0">
              <RotateCcw className="size-3" />
              Откат
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Page ─── */

export function DeployPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">
            Деплой и Синхронизация
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Управление развёртыванием и версиями
          </p>
        </div>
        <Button>
          <Rocket className="size-4" />
          Новый деплой
        </Button>
      </div>

      {/* Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Текущий Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <DeployPipeline />
        </CardContent>
      </Card>

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Active deployments */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Активные деплои</CardTitle>
          </CardHeader>
          <CardContent>
            <ActiveDeployments />
          </CardContent>
        </Card>

        {/* Sync */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Синхронизация</CardTitle>
          </CardHeader>
          <CardContent>
            <SyncPanel />
          </CardContent>
        </Card>
      </div>

      {/* Rollback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">История версий / Откат</CardTitle>
        </CardHeader>
        <CardContent>
          <RollbackHistory />
        </CardContent>
      </Card>
    </div>
  )
}
