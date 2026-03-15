import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface LogEntry {
  id: number
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  service: string
  message: string
}

const mockLogs: LogEntry[] = [
  { id: 1, timestamp: '16:42:18.234', level: 'info', service: 'api-gateway', message: 'POST /api/v1/users 201 — 24ms' },
  { id: 2, timestamp: '16:42:17.891', level: 'info', service: 'api-gateway', message: 'GET /api/v1/posts?page=1 200 — 18ms' },
  { id: 3, timestamp: '16:42:15.102', level: 'warn', service: 'deployment', message: 'Container health check retry (attempt 2/3)' },
  { id: 4, timestamp: '16:42:14.556', level: 'error', service: 'sync-server', message: 'WebSocket connection timeout: client_id=abc-123' },
  { id: 5, timestamp: '16:42:12.003', level: 'info', service: 'metrics', message: 'Metrics snapshot exported (interval: 30s)' },
  { id: 6, timestamp: '16:42:10.887', level: 'debug', service: 'code-generator', message: 'Generated SQL migration v14: add payments table' },
  { id: 7, timestamp: '16:42:08.121', level: 'info', service: 'api-gateway', message: 'GET /api/v1/users/me 200 — 12ms' },
  { id: 8, timestamp: '16:42:05.444', level: 'warn', service: 'deployment', message: 'Docker image build: layer cache miss for node_modules' },
  { id: 9, timestamp: '16:42:02.901', level: 'info', service: 'api-gateway', message: 'POST /api/v1/auth/login 200 — 42ms' },
  { id: 10, timestamp: '16:41:58.332', level: 'error', service: 'api-gateway', message: 'POST /api/v1/uploads 413 — payload too large (>10MB)' },
]

const levelBadge = {
  info: 'default' as const,
  warn: 'warning' as const,
  error: 'danger' as const,
  debug: 'muted' as const,
}

export function LogTable() {
  const [filter, setFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState<string | null>(null)

  const filtered = mockLogs.filter((log) => {
    if (levelFilter && log.level !== levelFilter) return false
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase()) &&
        !log.service.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Фильтр по сообщению или сервису..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
        {(['info', 'warn', 'error', 'debug'] as const).map((level) => (
          <Button
            key={level}
            variant={levelFilter === level ? 'outline' : 'ghost'}
            size="sm"
            onClick={() => setLevelFilter(levelFilter === level ? null : level)}
            className="text-xs"
          >
            {level}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-edge overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-edge bg-bg-raised/50">
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted w-28">
                Время
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted w-16">
                Level
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted w-32">
                Сервис
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Сообщение
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr
                key={log.id}
                className="group border-b border-edge/50 hover:bg-bg-raised/30 transition-colors"
              >
                <td className="px-3 py-1.5 font-mono text-[11px] text-text-muted">
                  {log.timestamp}
                </td>
                <td className="px-3 py-1.5">
                  <Badge variant={levelBadge[log.level]}>{log.level}</Badge>
                </td>
                <td className="px-3 py-1.5 text-xs text-text-secondary font-mono">
                  {log.service}
                </td>
                <td className="px-3 py-1.5 text-xs text-text-primary font-mono truncate max-w-0">
                  {log.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
