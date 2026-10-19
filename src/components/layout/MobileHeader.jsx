import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, Menu, Wallet, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useStore } from '../../hooks/useStore'
import { getSecondaryNav } from './navItems'

export default function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { profile, isAdmin, signOut } = useAuth()
  const { storeName } = useStore()
  const secondary = getSecondaryNav(isAdmin)

  // Close the menu with the Escape key.
  useEffect(() => {
    if (!menuOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <Wallet className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">GCash Monitor</p>
            <p className="truncate text-xs text-slate-500">{storeName}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="flex size-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
        >
          {menuOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {menuOpen && (
        <>
          {/* Tap outside the menu to close it */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 top-14 -z-10 bg-slate-900/30"
          />
          <nav
            id="mobile-menu"
            aria-label="Account and more pages"
            className="absolute inset-x-0 top-full border-b border-slate-200 bg-white p-3 shadow-lg"
          >
            <p className="px-3 pb-2 text-sm text-slate-600">
              Signed in as <span className="font-semibold text-slate-900">{profile.fullName}</span>{' '}
              ({profile.role === 'admin' ? 'Owner' : 'Staff'})
            </p>
            <ul className="space-y-1">
              {secondary.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'text-slate-700 active:bg-slate-100'
                        }`
                      }
                    >
                      <Icon className="size-5" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 active:bg-slate-100"
                >
                  <LogOut className="size-5" aria-hidden="true" />
                  Log out
                </button>
              </li>
            </ul>
          </nav>
        </>
      )}
    </header>
  )
}
