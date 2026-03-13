import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatsGrid } from '@/components/dashboard/StatsGrid'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { useAppStore } from '@/stores/appStore'

export function DashboardPage() {
  const { currentProject, projects } = useAppStore()
  const project = projects.find((p) => p.name === currentProject)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Обзор проекта{' '}
          <span className="text-accent font-medium">{currentProject}</span>
          {project?.lastDeploy && (
            <span className="text-text-muted">
              {' · '}Последний деплой: {project.lastDeploy}
            </span>
          )}
        </p>
      </div>

      {/* Stats */}
      <StatsGrid />

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Activity */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Последняя активность</CardTitle>
              <Badge variant="muted">Live</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ActivityFeed />
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActions />
          </CardContent>
        </Card>
      </div>

      {/* Projects overview */}
      <Card>
        <CardHeader>
          <CardTitle>Проекты</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-edge">
            {projects.map((p) => (
              <button
                key={p.name}
                className="flex w-full items-center gap-4 px-5 py-3 hover:bg-bg-raised/50 transition-colors text-left cursor-pointer"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-bg-raised text-accent font-display font-bold text-sm">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {p.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {p.description}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>{p.tables} таблиц</span>
                  <span>{p.endpoints} endpoint</span>
                  <Badge
                    variant={
                      p.status === 'active'
                        ? 'success'
                        : p.status === 'draft'
                          ? 'warning'
                          : 'muted'
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
