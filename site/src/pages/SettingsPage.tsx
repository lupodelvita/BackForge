import { useState } from 'react'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/* ─── Tab Navigation ─── */

const tabs = [
  { id: 'general', label: 'Общие', icon: Sliders },
  { id: 'integrations', label: 'Интеграции', icon: Plug },
  { id: 'cicd', label: 'CI/CD', icon: GitBranch },
  { id: 'security', label: 'Безопасность', icon: Shield },
]

/* ─── Integrations ─── */

const integrations = [
  { name: 'Auth0', description: 'Аутентификация и управление пользователями', category: 'Auth', connected: true, color: 'text-ember' },
  { name: 'Stripe', description: 'Приём платежей и подписки', category: 'Payments', connected: false, color: 'text-info' },
  { name: 'GitHub', description: 'Репозитории и CI/CD', category: 'DevOps', connected: true, color: 'text-text-primary' },
  { name: 'Twilio', description: 'SMS и push-уведомления', category: 'Messaging', connected: false, color: 'text-danger' },
  { name: 'Redis', description: 'Кэширование и очереди сообщений', category: 'Data', connected: true, color: 'text-danger' },
  { name: 'S3 / MinIO', description: 'Объектное хранилище файлов', category: 'Storage', connected: true, color: 'text-ember' },
]

function IntegrationsPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {integrations.map((int) => (
        <div
          key={int.name}
          className="flex items-center gap-3 rounded-lg border border-edge bg-bg-raised/50 p-4 hover:border-edge-strong transition-all"
        >
          <div
            className={cn(
              'flex size-10 items-center justify-center rounded-lg bg-bg-surface font-display font-bold text-sm',
              int.color
            )}
          >
            {int.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {int.name}
              </span>
              <Badge variant={int.connected ? 'success' : 'muted'}>
                {int.connected ? 'connected' : 'not connected'}
              </Badge>
            </div>
            <p className="text-[11px] text-text-muted truncate">
              {int.description}
            </p>
          </div>
          <Button
            variant={int.connected ? 'ghost' : 'outline'}
            size="sm"
          >
            {int.connected ? 'Настроить' : 'Подключить'}
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
          <div
            key={pipeline.name}
            className="flex items-center justify-between rounded-lg border border-edge bg-bg-raised/50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-text-primary">
                {pipeline.name}
              </p>
              <p className="text-[11px] text-text-muted">
                Триггер: {pipeline.trigger}
              </p>
            </div>
            <button
              onClick={() =>
                setStates((s) => s.map((v, j) => (j === i ? !v : v)))
              }
              className={cn(
                'transition-colors cursor-pointer',
                states[i] ? 'text-accent' : 'text-text-muted'
              )}
            >
              {states[i] ? (
                <ToggleRight className="size-7" />
              ) : (
                <ToggleLeft className="size-7" />
              )}
            </button>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Webhook URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              readOnly
              value="https://backforge.local/hooks/deploy/abc123"
              className="font-mono text-xs"
            />
            <Button variant="secondary" size="md">
              Копировать
            </Button>
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
      {/* RBAC */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">RBAC — Роли и права</CardTitle>
            <Button variant="secondary" size="sm">
              <Plus className="size-3" />
              Новая роль
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-edge">
            {rbacRoles.map((role) => (
              <div
                key={role.name}
                className="flex items-center gap-4 px-5 py-3"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-bg-raised">
                  <Users className="size-4 text-text-muted" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-text-primary">
                      {role.name}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      ({role.users} пользовател{role.users === 1 ? 'ь' : role.users < 5 ? 'я' : 'ей'})
                    </span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    {role.permissions.map((perm) => (
                      <Badge key={perm} variant="muted">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  Изменить
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">API Ключи</CardTitle>
            <button
              onClick={() => setShowKeys(!showKeys)}
              className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              {showKeys ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Production', key: 'bf_prod_a1b2c3d4e5f6g7h8i9j0', active: true },
            { name: 'Development', key: 'bf_dev_k1l2m3n4o5p6q7r8s9t0', active: true },
          ].map((apiKey) => (
            <div
              key={apiKey.name}
              className="flex items-center gap-3 rounded-lg border border-edge bg-bg-raised/50 px-4 py-3"
            >
              <Key className="size-4 text-text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  {apiKey.name}
                </p>
                <p className="text-xs font-mono text-text-muted truncate">
                  {showKeys ? apiKey.key : '••••••••••••••••••••••'}
                </p>
              </div>
              <Badge variant={apiKey.active ? 'success' : 'muted'}>
                {apiKey.active ? 'active' : 'revoked'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Security Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: 'SQL Injection Protection', enabled: true },
            { label: 'XSS Prevention', enabled: true },
            { label: 'CSRF Tokens', enabled: true },
            { label: 'Rate Limiting', enabled: true },
            { label: 'Audit Logging', enabled: true },
            { label: 'Input Validation', enabled: true },
          ].map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between rounded-md px-3 py-2 bg-success/5 border border-success/15"
            >
              <div className="flex items-center gap-2">
                <Lock className="size-3.5 text-success" />
                <span className="text-sm text-text-primary">{check.label}</span>
              </div>
              <Badge variant="success">enabled</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── General Settings ─── */

function GeneralPanel() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Настройки проекта</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">
              Название проекта
            </label>
            <Input defaultValue="my-saas-app" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">
              Описание
            </label>
            <Input defaultValue="Основной SaaS проект" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">
              API Gateway URL
            </label>
            <Input defaultValue="http://localhost:8080" className="font-mono" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">
              Deployment Service URL
            </label>
            <Input defaultValue="http://localhost:8082" className="font-mono" />
          </div>
          <Button className="mt-2">
            <Save className="size-3.5" />
            Сохранить
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Переменные окружения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { key: 'DATABASE_URL', value: 'postgres://localhost:5432/backforge' },
            { key: 'REDIS_URL', value: 'redis://localhost:6379' },
            { key: 'JWT_SECRET', value: '••••••••' },
          ].map((env) => (
            <div key={env.key} className="flex gap-2">
              <Input
                readOnly
                value={env.key}
                className="w-44 font-mono text-xs bg-bg-surface"
              />
              <Input
                defaultValue={env.value}
                className="flex-1 font-mono text-xs"
              />
            </div>
          ))}
          <Button variant="secondary" size="sm">
            <Plus className="size-3" />
            Добавить переменную
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Page ─── */

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')

  const panels: Record<string, React.ReactNode> = {
    general: <GeneralPanel />,
    integrations: <IntegrationsPanel />,
    cicd: <CICDPanel />,
    security: <SecurityPanel />,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          Настройки и Интеграции
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Конфигурация проекта, CI/CD, безопасность
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-edge bg-bg-surface p-1">
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

      {/* Active panel */}
      <div className="animate-fade-in">{panels[activeTab]}</div>
    </div>
  )
}
