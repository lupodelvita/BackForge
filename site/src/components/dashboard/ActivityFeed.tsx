import {
  GitCommit,
  Rocket,
  Database,
  Zap,
  Shield,
  Bot,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ActivityItem {
  id: number
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  title: string
  detail: string
  badge?: { label: string; variant: 'default' | 'success' | 'ember' | 'warning' | 'danger' | 'muted' }
  time: string
}

const activities: ActivityItem[] = [
  {
    id: 1,
    icon: Rocket,
    iconColor: 'text-success',
    title: 'Деплой завершён',
    detail: 'my-saas-app → local (v1.4.2)',
    badge: { label: 'success', variant: 'success' },
    time: '2 мин. назад',
  },
  {
    id: 2,
    icon: Database,
    iconColor: 'text-accent',
    title: 'Миграция применена',
    detail: 'Добавлена таблица "payments"',
    time: '15 мин. назад',
  },
  {
    id: 3,
    icon: Bot,
    iconColor: 'text-ember',
    title: 'AI: предложена схема API',
    detail: 'Проанализирован frontend код (React)',
    badge: { label: 'AI', variant: 'ember' },
    time: '28 мин. назад',
  },
  {
    id: 4,
    icon: Zap,
    iconColor: 'text-warning',
    title: 'API endpoint создан',
    detail: 'POST /api/v1/payments — CRUD',
    time: '30 мин. назад',
  },
  {
    id: 5,
    icon: Shield,
    iconColor: 'text-danger',
    title: 'Security audit',
    detail: 'Обнаружено 0 уязвимостей',
    badge: { label: 'clean', variant: 'success' },
    time: '1 час назад',
  },
  {
    id: 6,
    icon: GitCommit,
    iconColor: 'text-info',
    title: 'Версия схемы: v12',
    detail: 'Коммит: "add payments + webhooks"',
    time: '1 час назад',
  },
]

export function ActivityFeed() {
  return (
    <div className="flex flex-col divide-y divide-edge">
      {activities.map((item, i) => (
        <div
          key={item.id}
          className="group flex items-start gap-3 px-5 py-3 hover:bg-bg-raised/50 transition-colors animate-slide-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-raised',
              'group-hover:bg-bg-overlay transition-colors'
            )}
          >
            <item.icon className={cn('size-4', item.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary truncate">
                {item.title}
              </p>
              {item.badge && (
                <Badge variant={item.badge.variant}>{item.badge.label}</Badge>
              )}
            </div>
            <p className="text-xs text-text-muted truncate">{item.detail}</p>
          </div>
          <span className="shrink-0 text-[11px] text-text-muted whitespace-nowrap">
            {item.time}
          </span>
        </div>
      ))}
    </div>
  )
}
