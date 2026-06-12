import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { beitreten, type ErgebnisInfo, type StatusInfo } from '../../lib/teilnehmerApi'
import { Button, ErrorBanner, TextInput } from '../../components/ui'
import PruefungLauf from './PruefungLauf'

type Phase = 'name' | 'lobby' | 'lauf' | 'ergebnis'

/**
 * Übungsmodus: dauerhaft offen, kein Trainer-Start nötig. Ablauf:
 * Name → 10 Sekunden Lobby → Prüfung (Timer läuft) → Ergebnis → beliebig oft neu starten.
 */
export default function UebungsPruefung({
  code,
  status,
}: {
  code: string
  status: StatusInfo
}) {
  const [phase, setPhase] = useState<Phase>('name')
  const [name, setName] = useState('')
  const [teilnehmerId, setTeilnehmerId] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<ErgebnisInfo | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lobbySek, setLobbySek] = useState(10)

  async function starten(n: string) {
    const sauber = n.trim()
    if (!sauber) return
    setFehler(null)
    setBusy(true)
    try {
      const info = await beitreten(code, sauber) // im Übungsmodus -> neuer Versuch
      setTeilnehmerId(info.teilnehmer_id)
      setErgebnis(null)
      setLobbySek(10)
      setPhase('lobby')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Start fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  // Lobby-Countdown
  useEffect(() => {
    if (phase !== 'lobby') return
    if (lobbySek <= 0) {
      setPhase('lauf')
      return
    }
    const t = setTimeout(() => setLobbySek((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, lobbySek])

  if (phase === 'lauf' && teilnehmerId) {
    return (
      <PruefungLauf
        teilnehmerId={teilnehmerId}
        code={code}
        onAbgegeben={(e) => {
          setErgebnis(e)
          setPhase('ergebnis')
        }}
      />
    )
  }

  function nameSubmit(e: FormEvent) {
    e.preventDefault()
    starten(name)
  }

  return (
    <Schirm titel={status.vorlage_name} unter={status.kurs_name}>
      <div className="mb-4 rounded-lg bg-ifm-yellow/20 px-3 py-2 text-sm text-ifm-blue">
        Übungsmodus – du kannst diese Prüfung beliebig oft durchspielen.
      </div>

      {phase === 'name' && (
        <form onSubmit={nameSubmit} className="space-y-4">
          <TextInput
            label="Dein Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vor- und Nachname"
            required
            autoFocus
          />
          <p className="text-sm text-ifm-gray">
            Nach dem Start bist du kurz in der Lobby, dann beginnt die Prüfung mit Timer
            ({status.dauer_minuten} Min.).
          </p>
          {fehler && <ErrorBanner message={fehler} />}
          <Button type="submit" disabled={busy || !name.trim()} className="w-full">
            {busy ? 'Bitte warten …' : 'Übung starten'}
          </Button>
        </form>
      )}

      {phase === 'lobby' && (
        <div className="text-center py-4">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-ifm-green/15 text-2xl font-bold text-ifm-green">
            {lobbySek}
          </div>
          <p className="text-ifm-blue font-medium">Gleich geht's los …</p>
          <p className="mt-1 text-sm text-ifm-gray">Die Prüfung startet automatisch.</p>
        </div>
      )}

      {phase === 'ergebnis' && ergebnis && (
        <div className="text-center">
          <p className="text-ifm-gray">Dein Ergebnis</p>
          <div className="mt-2 text-4xl font-bold text-ifm-blue">
            {ergebnis.punkte_gesamt} / {ergebnis.punkte_max}
          </div>
          <div className="mt-1 text-lg text-ifm-blue">{ergebnis.prozent} %</div>
          <Button onClick={() => starten(name)} disabled={busy} className="mt-6 w-full">
            {busy ? 'Bitte warten …' : 'Noch einmal starten'}
          </Button>
        </div>
      )}
    </Schirm>
  )
}

function Schirm({
  children,
  titel,
  unter,
}: {
  children: ReactNode
  titel?: string
  unter?: string
}) {
  return (
    <div className="min-h-full bg-ifm-lightblue flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm p-8">
        <div className="flex items-baseline gap-1 text-sm font-bold mb-6">
          <span className="text-ifm-blue">Qualifizierung</span>
          <span className="text-ifm-red">|</span>
          <span className="text-ifm-blue">Coaching</span>
          <span className="text-ifm-red">|</span>
          <span className="text-ifm-blue">Consulting</span>
        </div>
        {titel && <h1 className="text-xl font-bold text-ifm-blue">{titel}</h1>}
        {unter && <p className="mb-4 mt-1 text-sm text-ifm-gray">{unter}</p>}
        {!unter && titel && <div className="mb-4" />}
        {children}
      </div>
    </div>
  )
}
