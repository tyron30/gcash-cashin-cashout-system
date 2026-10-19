import { Outlet } from 'react-router-dom'
import OfflineBanner from '../common/OfflineBanner'
import BottomNav from './BottomNav'
import MobileHeader from './MobileHeader'
import Sidebar from './Sidebar'

export default function AppShell() {
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <OfflineBanner />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 md:pb-10 md:pt-8">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
