import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppLayout() {
  const { sidebarCollapsed } = useAppStore()

  return (
    <div className="relative min-h-screen">
      <Sidebar />
      <div
        className={cn(
          'flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'
        )}
      >
        <Header />
        <main className="relative z-10 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
