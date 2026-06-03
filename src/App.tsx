import { isSupabaseConfigured } from './lib/supabase'

/**
 * Platzhalter-Startseite des IFM-Prüfungstools.
 * Dient als Smoke-Test fürs Grundgerüst (Vite + Tailwind + Supabase-SDK).
 * Wird durch das eigentliche Routing/Trainer-Dashboard ersetzt (Konzept Abschnitt 14).
 */
export default function App() {
  return (
    <div className="min-h-full bg-ifm-lightblue flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm p-8">
        <div className="flex items-baseline gap-1 text-sm font-bold mb-6">
          <span className="text-ifm-blue">Qualifizierung</span>
          <span className="text-ifm-red">|</span>
          <span className="text-ifm-blue">Coaching</span>
          <span className="text-ifm-red">|</span>
          <span className="text-ifm-blue">Consulting</span>
        </div>

        <h1 className="text-3xl font-bold text-ifm-blue">IFM-Prüfungstool</h1>
        <p className="mt-2 text-ifm-gray">
          Grundgerüst steht. Vite + Tailwind + Supabase-SDK sind eingerichtet.
        </p>

        <div className="mt-6 rounded-xl border border-ifm-lightblue p-4 text-sm">
          <span className="font-medium">Supabase-Verbindung: </span>
          {isSupabaseConfigured ? (
            <span className="text-ifm-green font-medium">konfiguriert ✓</span>
          ) : (
            <span className="text-ifm-yellow font-medium">
              noch nicht konfiguriert — Keys in .env eintragen
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
