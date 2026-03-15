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
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'

export function App() {
  const { hydrate } = useAuthStore()

  // Restore session from localStorage on first render
  useEffect(() => { hydrate() }, [hydrate])

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<GithubCallbackPage />} />

      {/* Protected app routes */}
      <Route element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="builder" element={<BuilderPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="deploy" element={<DeployPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
