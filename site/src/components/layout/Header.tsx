import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import {
  Search,
  Bell,
  Terminal,
  Moon,
  Wifi,
  WifiOff,
  Globe,
  Check,
  LogOut,
  LogIn,
  User,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { Badge } from '@/components/ui/badge'
import { SUPPORTED_LANGUAGES } from '@/i18n'

export function Header() {
  const { currentProject } = useAppStore()
  const { i18n } = useTranslation()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [langOpen, setLangOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)
    ?? SUPPORTED_LANGUAGES[0]

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-edge bg-bg-root/70 backdrop-blur-xl px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-text-muted">BackForge</span>
        <span className="text-text-muted">/</span>
        <span className="font-medium text-text-primary">{currentProject ?? '—'}</span>
        <Badge variant="success" className="ml-2">
          <span className="mr-0.5 inline-block size-1.5 rounded-full bg-success animate-pulse-glow" />
          Online
        </Badge>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button className="flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-edge bg-bg-raised px-3 text-xs text-text-muted hover:border-edge-strong transition-colors cursor-pointer">
          <Search className="size-3.5" />
          <span>Search…</span>
          <kbd className="ml-4 rounded border border-edge bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
            ⌘K
          </kbd>
        </button>

        <div className="mx-2 h-5 w-px bg-edge" />

        {/* Language Switcher */}
        <div ref={langRef} className="relative">
          <button
            title="Language"
            onClick={() => setLangOpen((v) => !v)}
            className="flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-text-muted hover:text-text-primary hover:bg-bg-raised transition-colors cursor-pointer"
          >
            <Globe className="size-3.5" />
            <span className="text-xs font-medium">{currentLang.flag}</span>
          </button>

          {langOpen && (
            <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-lg border border-edge bg-bg-surface shadow-panel overflow-hidden">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    i18n.changeLanguage(lang.code)
                    setLangOpen(false)
                  }}
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

        {/* Sync indicator */}
        <StatusButton
          icon={Wifi}
          offIcon={WifiOff}
          online
          tooltip="Sync"
        />

        {/* Terminal */}
        <IconBtn icon={Terminal} tooltip="Terminal" />

        {/* Notifications */}
        <div className="relative">
          <IconBtn icon={Bell} tooltip="Notifications" />
          <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-danger" />
        </div>

        {/* Theme */}
        <IconBtn icon={Moon} tooltip="Theme" />

        {/* User menu */}
        {user && (
          <div ref={userRef} className="relative ml-1">
            <button
              onClick={() => setUserOpen((v) => !v)}
              className="flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-text-secondary hover:text-text-primary hover:bg-bg-raised transition-colors cursor-pointer"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-accent/20 text-accent">
                <User className="size-3.5" />
              </span>
              <span className="text-xs font-medium max-w-[80px] truncate">{user.username}</span>
              <ChevronDown className="size-3 text-text-muted" />
            </button>

            {userOpen && (
              <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-lg border border-edge bg-bg-surface shadow-panel overflow-hidden">
                <div className="px-3 py-2 border-b border-edge">
                  <p className="text-xs font-medium text-text-primary truncate">{user.username}</p>
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setUserOpen(false); logout(); navigate('/login') }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                  Logout
                </button>
              </div>
            )}
          </div>
        )}

        {/* Login link (when not authenticated) */}
        {!user && (
          <Link
            to="/login"
            className="flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-text-secondary hover:text-text-primary hover:bg-bg-raised transition-colors ml-1"
          >
            <LogIn className="size-4" />
            <span className="text-xs font-medium">Login</span>
          </Link>
        )}
      </div>
    </header>
  )
}

function IconBtn({
  icon: Icon,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>
  tooltip: string
}) {
  return (
    <button
      title={tooltip}
      className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-raised transition-colors cursor-pointer"
    >
      <Icon className="size-4" />
    </button>
  )
}

function StatusButton({
  icon: OnIcon,
  offIcon: OffIcon,
  online,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>
  offIcon: React.ComponentType<{ className?: string }>
  online: boolean
  tooltip: string
}) {
  const Icon = online ? OnIcon : OffIcon
  return (
    <button
      title={tooltip}
      className={cn(
        'flex size-8 items-center justify-center rounded-[var(--radius-md)] transition-colors cursor-pointer',
        online
          ? 'text-success hover:bg-success/10'
          : 'text-danger hover:bg-danger/10'
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
