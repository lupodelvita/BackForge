import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Github, Eye, EyeOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const platformGitHub = useQuery({
    queryKey: ['platform-github-status', 'register'],
    queryFn: () => authApi.platformGitHubStatus().then((res) => res.data),
    retry: 0,
  })

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string
    email?: string
    password?: string
    confirm?: string
  }>({})

  function validate() {
    const errs: typeof fieldErrors = {}
    if (!username) errs.username = t('auth.errors.usernameRequired')
    else if (username.length < 3) errs.username = t('auth.errors.usernameTooShort')
    if (!email) errs.email = t('auth.errors.emailRequired')
    else if (!email.includes('@') || !email.includes('.')) errs.email = t('auth.errors.emailInvalid')
    if (!password) errs.password = t('auth.errors.passwordRequired')
    else if (password.length < 8) errs.password = t('auth.errors.passwordTooShort')
    if (password && confirm !== password) errs.confirm = t('auth.errors.passwordMismatch')
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setLoading(true)
    try {
      const res = await authApi.register(username, email, password)
      setAuth(res.data.user, res.data.token)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? ''
      if (msg.includes('username already')) {
        setFieldErrors((p) => ({ ...p, username: t('auth.errors.usernameTaken') }))
      } else if (msg.includes('email already')) {
        setFieldErrors((p) => ({ ...p, email: t('auth.errors.emailTaken') }))
      } else {
        setError(t('auth.errors.generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  function handleGitHub() {
    if (!platformGitHub.data?.configured) {
      setError(t('auth.errors.platformGithubNotConfigured'))
      return
    }
    window.location.href = authApi.githubUrl('register')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-root p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center size-10 rounded-xl bg-accent/15 border border-accent/25">
            <Zap className="size-5 text-accent" />
          </div>
          <span className="text-xl font-bold text-text-primary">BackForge</span>
        </div>

        <div className="bg-bg-raised border border-edge rounded-xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-text-primary mb-1">{t('auth.register')}</h1>
          <p className="text-sm text-text-muted mb-6">{t('auth.createYourAccount')}</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-danger/10 border border-danger/25 text-danger text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.username')}
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cooldev"
                autoComplete="username"
                error={fieldErrors.username}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.email')}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                error={fieldErrors.email}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  error={fieldErrors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2 text-text-muted hover:text-text-secondary"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                error={fieldErrors.confirm}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.registering') : t('auth.registerButton')}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-edge" />
            <span className="text-xs text-text-muted">{t('auth.orContinueWith')}</span>
            <div className="flex-1 h-px bg-edge" />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleGitHub}
            disabled={platformGitHub.isLoading || platformGitHub.data?.configured === false}
          >
            <Github className="size-4" />
            {t('auth.githubRegister')}
          </Button>

          {platformGitHub.data?.configured === false && (
            <p className="mt-3 text-xs text-text-muted">
              {t('auth.github.platformUnavailable')}
            </p>
          )}

          <p className="mt-6 text-center text-sm text-text-muted">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-accent hover:underline font-medium">
              {t('auth.signInLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
