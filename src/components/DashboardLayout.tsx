import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const MENU = [
  { to: '/kurse', label: 'Kurse' },
  { to: '/fragenpool', label: 'Fragenpool' },
  { to: '/vorlagen', label: 'Vorlagen' },
  { to: '/pruefungen', label: 'Prüfungen' },
  { to: '/geteilt', label: 'Geteilt mit mir' },
]

export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOffen, setMenuOffen] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-64 shrink-0 bg-ifm-blue text-white flex flex-col">
        <div className="p-5 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">IFM-Prüfungstool</div>
            <div className="text-xs text-white/60">Trainer-Dashboard</div>
          </div>
          <button
            type="button"
            className="md:hidden text-white/80"
            onClick={() => setMenuOffen((v) => !v)}
            aria-label="Menü umschalten"
          >
            ☰
          </button>
        </div>

        <nav className={`${menuOffen ? 'block' : 'hidden'} md:block px-3 pb-4 flex-1`}>
          {MENU.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOffen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 mb-1 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div
          className={`${menuOffen ? 'block' : 'hidden'} md:block p-4 border-t border-white/10 text-sm`}
        >
          <div className="truncate text-white/70 mb-2" title={user?.email ?? ''}>
            {user?.email}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg bg-white/10 hover:bg-white/20 py-2 transition-colors"
          >
            Abmelden
          </button>
        </div>
      </aside>

      {/* Hauptbereich */}
      <main className="flex-1 bg-ifm-lightblue/40 p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  )
}
