import { NavLink } from 'react-router-dom'
import { LogOut, Wallet } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useStore } from '../../hooks/useStore'
import { getSecondaryNav, primaryNav } from './navItems'

function SidebarLink({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-emerald-50 text-emerald-800'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Sidebar() {
  const { profile, isAdmin, signOut } = useAuth()
  const { storeName } = useStore()
  const secondary = getSecondaryNav(isAdmin)

  return (
    <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-dvh lg:w-64">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
          <Wallet className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">GCash Monitor</p>
          <p className="truncate text-xs text-slate-500">{storeName}</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {primaryNav.map((item) => (
            <li key={item.to}>
              <SidebarLink item={item} />
            </li>
          ))}
        </ul>

        {secondary.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reports &amp; Management
            </p>
            <ul className="space-y-1">
              {secondary.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-200 px-3 py-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
            {getInitials(profile.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile.fullName}</p>
            <p className="text-xs capitalize text-slate-500">{profile.role === 'admin' ? 'Owner' : 'Staff'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="size-5" aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  )
}
