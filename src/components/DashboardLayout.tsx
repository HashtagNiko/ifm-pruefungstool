import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Button, ErrorBanner, Modal, TextInput } from './ui'

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
  const [pwModal, setPwModal] = useState(false)

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
            onClick={() => setPwModal(true)}
            className="w-full rounded-lg bg-white/10 hover:bg-white/20 py-2 mb-2 transition-colors"
          >
            Passwort ändern
          </button>
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

      {pwModal && <PasswortAendernModal onClose={() => setPwModal(false)} />}
    </div>
  )
}

function PasswortAendernModal({ onClose }: { onClose: () => void }) {
  const { updatePassword } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function speichern(e: FormEvent) {
    e.preventDefault()
    setFehler(null)
    if (pw.length < 6) {
      setFehler('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }
    if (pw !== pw2) {
      setFehler('Die Passwörter stimmen nicht überein.')
      return
    }
    setBusy(true)
    const { error } = await updatePassword(pw)
    setBusy(false)
    if (error) {
      setFehler(error)
      return
    }
    setHinweis('Passwort geändert.')
    setPw('')
    setPw2('')
  }

  return (
    <Modal open onClose={onClose} title="Passwort ändern">
      <form onSubmit={speichern} className="space-y-4">
        <TextInput
          label="Neues Passwort"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="new-password"
          required
          autoFocus
        />
        <TextInput
          label="Passwort wiederholen"
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          autoComplete="new-password"
          required
        />
        {fehler && <ErrorBanner message={fehler} />}
        {hinweis && (
          <p className="text-sm text-ifm-green rounded-lg bg-ifm-green/10 p-3">{hinweis}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Schließen
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Speichern …' : 'Speichern'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
