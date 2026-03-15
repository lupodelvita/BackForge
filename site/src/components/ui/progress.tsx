import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  variant?: 'accent' | 'ember' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const barColors = {
  accent: 'bg-accent',
  ember: 'bg-ember',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const barSizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

export function Progress({
  value,
  max = 100,
  variant = 'accent',
  size = 'md',
  className,
  ...props
}: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        'w-full rounded-full bg-bg-raised overflow-hidden',
        barSizes[size],
        className
      )}
      {...props}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500 ease-out', barColors[variant])}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
