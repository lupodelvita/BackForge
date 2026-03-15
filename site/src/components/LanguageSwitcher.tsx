import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES } from '@/i18n'

interface Props {
  /** Render as a minimal pill (for auth pages) or full dropdown (for header) */
  variant?: 'pill' | 'dropdown'
  className?: string
}

export function LanguageSwitcher({ variant = 'dropdown', className }: Props) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ?? SUPPORTED_LANGUAGES[0]

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 transition-colors cursor-pointer',
          variant === 'pill'
            ? 'rounded-full border border-edge bg-bg-surface/60 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:border-edge-strong'
            : 'rounded-[var(--radius-md)] px-2 h-8 text-text-muted hover:text-text-primary hover:bg-bg-raised'
        )}
      >
        <Globe className="size-3.5" />
        <span className="text-xs font-medium">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-edge bg-bg-surface shadow-panel overflow-hidden">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer',
                i18n.language === lang.code
                  ? 'bg-accent/12 text-accent'
                  : 'text-text-secondary hover:bg-bg-raised hover:text-text-primary'
              )}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.label}</span>
              {i18n.language === lang.code && <Check className="size-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
