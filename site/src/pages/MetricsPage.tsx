import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricsGrid } from '@/components/metrics/CircularMetric'
import { PerformanceCharts } from '@/components/metrics/PerformanceCharts'
import { LogTable } from '@/components/metrics/LogTable'
import { Badge } from '@/components/ui/badge'

export function MetricsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          Мониторинг и Метрики
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Производительность backend в реальном времени
        </p>
      </div>

      {/* Circular metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Ключевые показатели</CardTitle>
            <Badge variant="success">
              <span className="mr-1 inline-block size-1.5 rounded-full bg-success animate-pulse-glow" />
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <MetricsGrid />
        </CardContent>
      </Card>

      {/* Performance charts */}
      <PerformanceCharts />

      {/* Log table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Логи сервисов</CardTitle>
        </CardHeader>
        <CardContent>
          <LogTable />
        </CardContent>
      </Card>
    </div>
  )
}
