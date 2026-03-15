import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <div>
      <input
        className={cn(
          'flex h-9 w-full rounded-[var(--radius-md)] border border-edge bg-bg-raised px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60',
          'disabled:cursor-not-allowed disabled:opacity-40',
          error && 'border-danger focus:ring-danger/40',
          className
        )}
        aria-invalid={!!error}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">{error}</p>
      )}
    </div>
  )
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex w-full rounded-[var(--radius-md)] border border-edge bg-bg-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60',
        'disabled:cursor-not-allowed disabled:opacity-40 resize-none',
        className
      )}
      {...props}
    />
  )
}
