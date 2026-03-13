interface CircularMetricProps {
  label: string
  value: number
  max?: number
  unit?: string
  color: string
  size?: number
}

export function CircularMetric({
  label,
  value,
  max = 100,
  unit = '%',
  color,
  size = 120,
}: CircularMetricProps) {
  const percent = Math.min(100, (value / max) * 100)
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percent / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="oklch(20% 0.015 260)"
            strokeWidth="6"
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-bold text-text-primary">
            {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}
          </span>
          <span className="text-[10px] text-text-muted">{unit}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
    </div>
  )
}

export function MetricsGrid() {
  const metrics = [
    { label: 'Backend Health', value: 96, color: 'oklch(72% 0.19 148)' },
    { label: 'API Latency', value: 42, max: 200, unit: 'ms', color: 'oklch(78% 0.155 190)' },
    { label: 'DB Load', value: 28, color: 'oklch(80% 0.16 80)' },
    { label: 'Cache Hit Rate', value: 87, color: 'oklch(72% 0.19 148)' },
    { label: 'Security Score', value: 94, color: 'oklch(78% 0.155 190)' },
    { label: 'Storage Usage', value: 63, color: 'oklch(76% 0.14 55)' },
  ]

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-2 lg:justify-between">
      {metrics.map((m) => (
        <CircularMetric key={m.label} {...m} />
      ))}
    </div>
  )
}
