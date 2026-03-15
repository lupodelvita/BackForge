import {
  FolderPlus,
  Upload,
  Rocket,
  TestTube2,
  Sparkles,
  Code2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const actions = [
  {
    icon: FolderPlus,
    label: 'Новый проект',
    description: 'Создать с нуля',
    variant: 'secondary' as const,
  },
  {
    icon: Upload,
    label: 'Импорт frontend',
    description: 'Анализ AI',
    variant: 'secondary' as const,
  },
  {
    icon: Code2,
    label: 'Генерация кода',
    description: 'CRUD + миграции',
    variant: 'secondary' as const,
  },
  {
    icon: Rocket,
    label: 'Деплой',
    description: 'Local / Cloud / Edge',
    variant: 'outline' as const,
  },
  {
    icon: TestTube2,
    label: 'Тесты',
    description: 'Запустить CI',
    variant: 'secondary' as const,
  },
  {
    icon: Sparkles,
    label: 'AI Builder',
    description: 'Предложение схемы',
    variant: 'outline' as const,
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant}
          className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
        >
          <action.icon className="size-4 mb-0.5" />
          <span className="text-sm font-medium">{action.label}</span>
          <span className="text-[11px] text-text-muted font-normal">
            {action.description}
          </span>
        </Button>
      ))}
    </div>
  )
}
