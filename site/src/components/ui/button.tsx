import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-root disabled:pointer-events-none disabled:opacity-40 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-accent text-bg-root hover:bg-accent/90 shadow-md hover:shadow-glow',
        secondary:
          'bg-bg-raised text-text-primary border border-edge hover:border-edge-strong hover:bg-bg-overlay',
        ghost:
          'text-text-secondary hover:text-text-primary hover:bg-bg-raised',
        danger:
          'bg-danger/15 text-danger border border-danger/25 hover:bg-danger/25',
        ember:
          'bg-ember text-bg-root hover:bg-ember/90',
        outline:
          'border border-accent/40 text-accent bg-transparent hover:bg-accent/10',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-[var(--radius-sm)]',
        md: 'h-9 px-4 text-sm rounded-[var(--radius-md)]',
        lg: 'h-11 px-6 text-sm rounded-[var(--radius-md)]',
        icon: 'size-9 rounded-[var(--radius-md)]',
        'icon-sm': 'size-7 rounded-[var(--radius-sm)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { buttonVariants }
