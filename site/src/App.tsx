import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { BuilderPage } from '@/pages/BuilderPage'
import { MetricsPage } from '@/pages/MetricsPage'
import { DeployPage } from '@/pages/DeployPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { GithubCallbackPage } from '@/pages/GithubCallbackPage'
import { LandingPage } from '@/pages/LandingPage'
import { useAuthStore } from '@/stores/authStore'

export function App() {
  const { hydrate } = useAuthStore()

  // Restore session from localStorage on first render
  useEffect(() => { hydrate() }, [hydrate])

  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<GithubCallbackPage />} />

      {/* App routes — browsable without auth, actions guarded individually */}
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="builder" element={<BuilderPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="deploy" element={<DeployPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
