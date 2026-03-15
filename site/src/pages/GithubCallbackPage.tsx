import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/lib/api'

const ERROR_MAP: Record<string, string> = {
  platform_github_not_configured: 'auth.errors.platformGithubNotConfigured',
  github_not_registered: 'auth.errors.githubNotRegistered',
  github_already_registered: 'auth.errors.githubAlreadyRegistered',
  github_already_linked: 'auth.errors.githubAlreadyLinked',
  email_already_registered: 'auth.errors.emailAlreadyRegistered',
  oauth_failed: 'auth.errors.oauthFailed',
  invalid_state: 'auth.errors.oauthFailed',
}

/**
 * Handles the GitHub OAuth redirect.
 * URL may carry either:
 *   ?token=<jwt>  → successful auth
 *   ?error=<code> → failure
 */
export function GithubCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { setAuth } = useAuthStore()

  const token = params.get('token')
  const errorCode = params.get('error')

  useEffect(() => {
    if (!token && !errorCode) return

    if (token) {
      // Fetch user info then persist auth
      authApi.me()
        .then((res) => {
          setAuth(res.data, token)
          navigate('/app', { replace: true })
        })
        .catch(() => {
          // Token is invalid / expired — go to login
          navigate('/login?error=token_invalid', { replace: true })
        })
    }
    // If there's an error, we just render the error UI (no redirect needed)
  }, [token, errorCode, setAuth, navigate])

  const errorMsg = errorCode
    ? t(ERROR_MAP[errorCode] ?? 'auth.errors.generic')
    : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-root p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center size-10 rounded-xl bg-accent/15 border border-accent/25">
            <Zap className="size-5 text-accent" />
          </div>
          <span className="text-xl font-bold text-text-primary">BackForge</span>
        </div>

        <div className="bg-bg-raised border border-edge rounded-xl p-8 shadow-xl">
          {!token && !errorCode && (
            <div className="flex flex-col items-center gap-4 text-text-secondary">
              <Loader2 className="size-8 animate-spin text-accent" />
              <p className="text-sm">{t('common.loading')}</p>
            </div>
          )}

          {token && !errorCode && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="size-10 text-accent" />
              <p className="text-text-secondary text-sm">{t('common.loading')}</p>
            </div>
          )}

          {errorMsg && (
            <div className="flex flex-col items-center gap-4">
              <XCircle className="size-10 text-danger" />
              <p className="font-semibold text-text-primary">{t('common.error')}</p>
              <p className="text-sm text-text-secondary">{errorMsg}</p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm text-accent hover:underline"
                >
                  {t('auth.signInLink')}
                </button>
                <span className="text-text-muted">·</span>
                <button
                  onClick={() => navigate('/register')}
                  className="text-sm text-accent hover:underline"
                >
                  {t('auth.signUpLink')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
