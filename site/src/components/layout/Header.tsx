import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import {
  Search,
  Bell,
  Terminal,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  Globe,
  Check,
  LogOut,
  LogIn,
  User,
  ChevronDown,
  LayoutDashboard,
  Blocks,
  Activity,
  Rocket,
  Settings,
  X,
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
  const location = useLocation()
  const [langOpen, setLangOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const langRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const navItems = [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/builder', label: 'Builder', icon: Blocks },
    { to: '/app/metrics', label: 'Metrics', icon: Activity },
    { to: '/app/deploy', label: 'Deploy', icon: Rocket },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ]

  const filteredNav = searchQuery.trim()
    ? navItems.filter((n) => n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : navItems

  // Close dropdown when clicking outside
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // ⌘K / Ctrl+K shortcut
  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openSearch()
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openSearch])

  // Close search when navigating
  useEffect(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [location.pathname])

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark')
    setDark(isDark)
  }

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
        <div ref={searchRef} className="relative">
          <button
            onClick={openSearch}
            className="flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-edge bg-bg-raised px-3 text-xs text-text-muted hover:border-edge-strong transition-colors cursor-pointer"
          >
            <Search className="size-3.5" />
            <span>Search…</span>
            <kbd className="ml-4 rounded border border-edge bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
              ⌘K
            </kbd>
          </button>

          {searchOpen && (
            <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-edge bg-bg-surface shadow-raised overflow-hidden">
              <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
                <Search className="size-3.5 shrink-0 text-text-muted" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pages…"
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                />
                <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="text-text-muted hover:text-text-primary cursor-pointer">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="py-1">
                {filteredNav.map((item) => (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:bg-bg-raised hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <item.icon className="size-4 shrink-0 text-text-muted" />
                    {item.label}
                  </button>
                ))}
                {filteredNav.length === 0 && (
                  <p className="px-3 py-3 text-xs text-text-muted">No results</p>
                )}
              </div>
            </div>
          )}
        </div>

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

        {/* Terminal — navigate to builder */}
        <button
          title="Builder"
          onClick={() => navigate('/app/builder')}
          className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-raised transition-colors cursor-pointer"
        >
          <Terminal className="size-4" />
        </button>

        {/* Notifications — decorative */}
        <div className="relative">
          <button
            title="Notifications"
            className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-raised transition-colors cursor-pointer"
          >
            <Bell className="size-4" />
          </button>
        </div>

        {/* Theme toggle */}
        <button
          title={dark ? 'Light mode' : 'Dark mode'}
          onClick={toggleTheme}
          className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-raised transition-colors cursor-pointer"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

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
