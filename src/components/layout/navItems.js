import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  Coins,
  FileText,
  History,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react'

// Shown in the mobile bottom bar AND the desktop sidebar.
export const primaryNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/cash-in', label: 'Cash In', icon: ArrowDownLeft },
  { to: '/cash-out', label: 'Cash Out', icon: ArrowUpRight },
  { to: '/transactions', label: 'History', icon: History },
]

// Owner-only pages. Shown in the sidebar and in the mobile menu.
export const secondaryNav = [
  { to: '/closing', label: 'Daily Closing', icon: ClipboardCheck, adminOnly: true },
  { to: '/reports', label: 'Reports & Export', icon: FileText, adminOnly: true },
  { to: '/fees', label: 'Fees & Charges', icon: Coins, adminOnly: true },
  { to: '/staff', label: 'Staff', icon: Users, adminOnly: true },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, adminOnly: true },
  { to: '/settings', label: 'Store Settings', icon: Settings, adminOnly: true },
]

// Hides owner-only pages from staff. (Real protection comes from
// Supabase RLS in Phase 3. Hiding links is only for convenience.)
export function getSecondaryNav(isAdmin) {
  return secondaryNav.filter((item) => !item.adminOnly || isAdmin)
}
