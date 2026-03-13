import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { BuilderPage } from '@/pages/BuilderPage'
import { MetricsPage } from '@/pages/MetricsPage'
import { DeployPage } from '@/pages/DeployPage'
import { SettingsPage } from '@/pages/SettingsPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="builder" element={<BuilderPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="deploy" element={<DeployPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
