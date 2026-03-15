import {
  Database,
  Zap,
  Table2,
  Rocket,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const stats = [
  {
    label: 'Таблицы',
    value: 12,
    change: +2,
    icon: Table2,
    color: 'text-accent',
    bg: 'bg-accent/12',
  },
  {
    label: 'API Endpoints',
    value: 34,
    change: +5,
    icon: Zap,
    color: 'text-ember',
    bg: 'bg-ember/12',
  },
  {
    label: 'Базы данных',
    value: 3,
    change: 0,
    icon: Database,
    color: 'text-info',
    bg: 'bg-info/12',
  },
  {
    label: 'Активные деплои',
    value: 2,
    change: -1,
    icon: Rocket,
    color: 'text-success',
    bg: 'bg-success/12',
  },
  {
    label: 'Синхронизация',
    value: 98,
    unit: '%',
    change: +3,
    icon: RefreshCw,
    color: 'text-warning',
    bg: 'bg-warning/12',
  },
  {
    label: 'Uptime',
    value: 99.97,
    unit: '%',
    change: 0,
    icon: Clock,
    color: 'text-success',
    bg: 'bg-success/12',
  },
]

export function StatsGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat, i) => (
        <Card
          key={stat.label}
          className="group hover:border-edge-strong hover:shadow-raised transition-all duration-200"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg',
                  stat.bg
                )}
              >
                <stat.icon className={cn('size-[18px]', stat.color)} />
              </div>
              {stat.change !== 0 && (
                <span
                  className={cn(
                    'flex items-center gap-0.5 text-[11px] font-medium',
                    stat.change > 0 ? 'text-success' : 'text-danger'
                  )}
                >
                  {stat.change > 0 ? (
                    <ArrowUpRight className="size-3" />
                  ) : (
                    <ArrowDownRight className="size-3" />
                  )}
                  {Math.abs(stat.change)}
                </span>
              )}
            </div>
            <div className="mt-3">
              <p className="flex items-baseline gap-0.5">
                <span className="text-2xl font-bold font-display tracking-tight text-text-primary animate-count-up">
                  {stat.value}
                </span>
                {stat.unit && (
                  <span className="text-sm text-text-muted">{stat.unit}</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
