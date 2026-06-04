import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Button, ErrorBanner, TextInput } from '../components/ui'

/** Wird angezeigt, wenn der Nutzer über einen Reset-/Einladungslink kommt (PASSWORD_RECOVERY). */
export default function NeuesPasswortSeite() {
  const { updatePassword, clearRecovery } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
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
    clearRecovery()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-full bg-ifm-lightblue flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-ifm-blue">Passwort festlegen</h1>
        <p className="mt-1 text-sm text-ifm-gray">Bitte vergib ein neues Passwort.</p>
        <form onSubmit={speichern} className="mt-6 space-y-4">
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
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Speichern …' : 'Passwort speichern'}
          </Button>
        </form>
      </div>
    </div>
  )
}
