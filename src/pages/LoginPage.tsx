import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

type Modus = 'login' | 'reset'

export default function LoginPage() {
  const { session, loading, signIn, resetPassword } = useAuth()
  const [modus, setModus] = useState<Modus>('login')
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFehler(null)
    setHinweis(null)
    setBusy(true)
    try {
      if (modus === 'login') {
        const { error } = await signIn(email, passwort)
        if (error) setFehler(uebersetzeFehler(error))
      } else {
        const { error } = await resetPassword(email)
        if (error) setFehler(uebersetzeFehler(error))
        else
          setHinweis(
            'Falls für diese Adresse ein Konto existiert, haben wir dir eine E-Mail zum ' +
              'Zurücksetzen des Passworts geschickt.',
          )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-ifm-lightblue flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
        <div className="flex items-baseline gap-1 text-sm font-bold mb-6">
          <span className="text-ifm-blue">Qualifizierung</span>
          <span className="text-ifm-red">|</span>
          <span className="text-ifm-blue">Coaching</span>
          <span className="text-ifm-red">|</span>
          <span className="text-ifm-blue">Consulting</span>
        </div>

        <h1 className="text-2xl font-bold text-ifm-blue">
          {modus === 'login' ? 'Anmelden' : 'Passwort zurücksetzen'}
        </h1>
        <p className="mt-1 text-sm text-ifm-gray">IFM-Prüfungstool · Trainer-Bereich</p>

        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-lg bg-ifm-yellow/20 text-ifm-blue text-sm p-3">
            Supabase ist nicht konfiguriert. Bitte <code>.env</code> ausfüllen.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field
            label="E-Mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          {modus === 'login' && (
            <Field
              label="Passwort"
              type="password"
              value={passwort}
              onChange={setPasswort}
              autoComplete="current-password"
              required
            />
          )}

          {fehler && <p className="text-sm text-ifm-red">{fehler}</p>}
          {hinweis && (
            <p className="text-sm text-ifm-green rounded-lg bg-ifm-green/10 p-3">{hinweis}</p>
          )}

          <button
            type="submit"
            disabled={busy || !isSupabaseConfigured}
            className="w-full rounded-lg bg-ifm-blue text-white font-medium py-2.5 hover:bg-ifm-blue/90 disabled:opacity-50 transition-colors"
          >
            {busy
              ? 'Bitte warten …'
              : modus === 'login'
                ? 'Anmelden'
                : 'Reset-Link senden'}
          </button>
        </form>

        <div className="mt-6 text-sm text-ifm-gray text-center">
          {modus === 'login' ? (
            <button
              type="button"
              onClick={() => {
                setModus('reset')
                setFehler(null)
                setHinweis(null)
              }}
              className="text-ifm-blue font-medium hover:underline"
            >
              Passwort vergessen?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setModus('login')
                setFehler(null)
                setHinweis(null)
              }}
              className="text-ifm-blue font-medium hover:underline"
            >
              Zurück zur Anmeldung
            </button>
          )}
        </div>

        <p className="mt-6 text-xs text-ifm-gray text-center">
          Konten werden vom Administrator angelegt. Wende dich an deinen Administrator, wenn du
          Zugang brauchst.
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ifm-blue mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue focus:ring-2 focus:ring-ifm-blue/20"
      />
    </label>
  )
}

function uebersetzeFehler(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort ist falsch.'
  if (/email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail-Adresse.'
  if (/rate limit|too many/i.test(msg)) return 'Zu viele Versuche. Bitte später erneut.'
  return msg
}
