import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const requestsData = [
  { time: '00:00', requests: 120, errors: 2 },
  { time: '04:00', requests: 45, errors: 0 },
  { time: '08:00', requests: 310, errors: 5 },
  { time: '10:00', requests: 480, errors: 8 },
  { time: '12:00', requests: 620, errors: 12 },
  { time: '14:00', requests: 580, errors: 6 },
  { time: '16:00', requests: 720, errors: 4 },
  { time: '18:00', requests: 540, errors: 3 },
  { time: '20:00', requests: 380, errors: 1 },
  { time: '22:00', requests: 210, errors: 0 },
]

const latencyData = [
  { endpoint: '/api/users', p50: 24, p95: 85, p99: 145 },
  { endpoint: '/api/posts', p50: 18, p95: 54, p99: 92 },
  { endpoint: '/api/auth', p50: 42, p95: 120, p99: 210 },
  { endpoint: '/api/uploads', p50: 85, p95: 240, p99: 450 },
  { endpoint: '/api/search', p50: 56, p95: 180, p99: 320 },
]

const resourcesData = [
  { time: '00:00', cpu: 12, memory: 45 },
  { time: '04:00', cpu: 8, memory: 42 },
  { time: '08:00', cpu: 35, memory: 52 },
  { time: '10:00', cpu: 55, memory: 61 },
  { time: '12:00', cpu: 72, memory: 68 },
  { time: '14:00', cpu: 68, memory: 65 },
  { time: '16:00', cpu: 82, memory: 71 },
  { time: '18:00', cpu: 60, memory: 63 },
  { time: '20:00', cpu: 38, memory: 55 },
  { time: '22:00', cpu: 20, memory: 48 },
]

const chartTheme = {
  grid: 'oklch(22% 0.015 260)',
  text: 'oklch(45% 0.015 260)',
  accent: 'oklch(78% 0.155 190)',
  ember: 'oklch(76% 0.14 55)',
  danger: 'oklch(62% 0.22 25)',
  success: 'oklch(72% 0.19 148)',
  info: 'oklch(70% 0.14 250)',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-edge bg-bg-surface/95 backdrop-blur-sm px-3 py-2 shadow-raised">
      <p className="text-xs font-medium text-text-primary mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-[11px] text-text-secondary">
          <span
            className="mr-1.5 inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: <span className="font-mono font-medium">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

export function PerformanceCharts() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Requests over time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Запросы в час</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={requestsData}>
              <defs>
                <linearGradient id="gradAccent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTheme.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartTheme.accent} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDanger" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTheme.danger} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartTheme.danger} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fill: chartTheme.text, fontSize: 10 }}
                axisLine={{ stroke: chartTheme.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: chartTheme.text, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="requests"
                stroke={chartTheme.accent}
                strokeWidth={2}
                fill="url(#gradAccent)"
                name="Запросы"
              />
              <Area
                type="monotone"
                dataKey="errors"
                stroke={chartTheme.danger}
                strokeWidth={2}
                fill="url(#gradDanger)"
                name="Ошибки"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Latency by endpoint */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Latency по endpoints (ms)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={latencyData} layout="vertical" barGap={2}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: chartTheme.text, fontSize: 10 }}
                axisLine={{ stroke: chartTheme.grid }}
                tickLine={false}
              />
              <YAxis
                dataKey="endpoint"
                type="category"
                tick={{ fill: chartTheme.text, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="p50" fill={chartTheme.success} name="p50" radius={[0, 2, 2, 0]} barSize={6} />
              <Bar dataKey="p95" fill={chartTheme.ember} name="p95" radius={[0, 2, 2, 0]} barSize={6} />
              <Bar dataKey="p99" fill={chartTheme.danger} name="p99" radius={[0, 2, 2, 0]} barSize={6} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Resource usage */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">Использование ресурсов</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={resourcesData}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fill: chartTheme.text, fontSize: 10 }}
                axisLine={{ stroke: chartTheme.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: chartTheme.text, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke={chartTheme.ember}
                strokeWidth={2}
                dot={false}
                name="CPU %"
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke={chartTheme.info}
                strokeWidth={2}
                dot={false}
                name="Memory %"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
