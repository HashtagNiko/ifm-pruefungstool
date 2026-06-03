import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { ensureAnonSession } from '../../lib/supabaseParticipant'
import {
  abgeben,
  beitreten,
  statusLaden,
  type ErgebnisInfo,
  type StatusInfo,
} from '../../lib/teilnehmerApi'
import { Button, ErrorBanner, TextInput } from '../../components/ui'
import PruefungLauf from './PruefungLauf'

export default function TeilnehmerPage() {
  const { code = '' } = useParams<{ code: string }>()
  const [status, setStatus] = useState<StatusInfo | null>(null)
  const [teilnehmerId, setTeilnehmerId] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<ErgebnisInfo | null>(null)
  const [init, setInit] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  const nameKey = `teilnehmer-name-${code}`
  const startVersucht = useRef(false)

  const ladeStatus = useCallback(async () => {
    const s = await statusLaden(code)
    setStatus(s)
    return s
  }, [code])

  // Initialisierung: anonyme Session + Status; ggf. automatischer Reconnect
  useEffect(() => {
    if (startVersucht.current) return
    startVersucht.current = true
    ;(async () => {
      try {
        const s = await ladeStatus() // Status geht ohne Session (anon apikey)
        await ensureAnonSession()
        const gespeicherterName = localStorage.getItem(nameKey)
        if (gespeicherterName && s.status !== 'entwurf') {
          try {
            const info = await beitreten(code, gespeicherterName)
            setTeilnehmerId(info.teilnehmer_id)
          } catch {
            /* z. B. gesperrt -> Name-Formular zeigen */
          }
        }
      } catch (err) {
        setFehler(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.')
      } finally {
        setInit(false)
      }
    })()
  }, [code, ladeStatus, nameKey])

  // Status-Polling, solange noch nicht in der laufenden Prüfung / kein Ergebnis
  useEffect(() => {
    if (init || ergebnis) return
    if (status && status.status === 'laeuft' && teilnehmerId) return // Lauf übernimmt
    const iv = setInterval(() => {
      ladeStatus().catch(() => {})
    }, 4000)
    return () => clearInterval(iv)
  }, [init, ergebnis, status, teilnehmerId, ladeStatus])

  // Prüfung beendet + beigetreten + noch kein Ergebnis -> finalisieren
  useEffect(() => {
    if (status?.status === 'beendet' && teilnehmerId && !ergebnis) {
      abgeben(teilnehmerId)
        .then(setErgebnis)
        .catch((err) => setFehler(err instanceof Error ? err.message : 'Abgabe fehlgeschlagen.'))
    }
  }, [status, teilnehmerId, ergebnis])

  if (init) return <Schirm><p className="text-ifm-gray">Verbindung wird hergestellt …</p></Schirm>

  if (fehler && !teilnehmerId && !ergebnis)
    return (
      <Schirm titel={status?.vorlage_name} unter={status?.kurs_name}>
        <ErrorBanner message={fehler} />
        <Button
          variant="secondary"
          className="mt-4 w-full"
          onClick={() => window.location.reload()}
        >
          Erneut versuchen
        </Button>
      </Schirm>
    )

  // Ergebnis hat Vorrang
  if (ergebnis) return <ErgebnisAnsicht ergebnis={ergebnis} kursName={status?.kurs_name} />

  // Laufende Prüfung
  if (status?.status === 'laeuft' && teilnehmerId) {
    return (
      <PruefungLauf
        teilnehmerId={teilnehmerId}
        code={code}
        onAbgegeben={(e) => setErgebnis(e)}
      />
    )
  }

  // Noch nicht geöffnet
  if (status?.status === 'entwurf')
    return (
      <Schirm titel={status.vorlage_name} unter={status.kurs_name}>
        <p className="text-ifm-gray">
          Die Prüfung ist noch nicht geöffnet. Bitte dieses Fenster geöffnet lassen.
        </p>
      </Schirm>
    )

  // Beendet, ohne Beitritt
  if (status?.status === 'beendet' && !teilnehmerId)
    return (
      <Schirm titel={status.vorlage_name} unter={status.kurs_name}>
        <p className="text-ifm-gray">Diese Prüfung ist bereits beendet.</p>
      </Schirm>
    )

  // Beigetreten + Lobby -> Wartebereich
  if (teilnehmerId && status?.status === 'lobby')
    return (
      <Schirm titel={status.vorlage_name} unter={status.kurs_name}>
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-ifm-green/20" />
          <p className="text-ifm-blue font-medium">Du bist im Wartebereich.</p>
          <p className="mt-1 text-ifm-gray">
            Die Prüfung beginnt, sobald der Trainer startet. Bitte das Fenster geöffnet lassen.
          </p>
        </div>
      </Schirm>
    )

  // Sonst: Name-Eingabe (Beitreten)
  return (
    <BeitretenForm
      code={code}
      status={status}
      onBeigetreten={(id, name) => {
        localStorage.setItem(nameKey, name)
        setTeilnehmerId(id)
        ladeStatus().catch(() => {})
      }}
    />
  )
}

function BeitretenForm({
  code,
  status,
  onBeigetreten,
}: {
  code: string
  status: StatusInfo | null
  onBeigetreten: (teilnehmerId: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function absenden(e: FormEvent) {
    e.preventDefault()
    setFehler(null)
    setBusy(true)
    try {
      const info = await beitreten(code, name)
      onBeigetreten(info.teilnehmer_id, name.trim())
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Beitritt fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Schirm titel={status?.vorlage_name} unter={status?.kurs_name}>
      <form onSubmit={absenden} className="space-y-4">
        <TextInput
          label="Dein vollständiger Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vor- und Nachname"
          required
          autoFocus
        />
        <p className="text-sm text-ifm-gray">
          Mit Klick auf „Beitreten" kommst du in den Wartebereich.
        </p>
        {fehler && <ErrorBanner message={fehler} />}
        <Button type="submit" disabled={busy || !name.trim()} className="w-full">
          {busy ? 'Bitte warten …' : 'Beitreten'}
        </Button>
      </form>
    </Schirm>
  )
}

function ErgebnisAnsicht({
  ergebnis,
  kursName,
}: {
  ergebnis: ErgebnisInfo
  kursName?: string
}) {
  return (
    <Schirm titel="Abgegeben" unter={kursName}>
      <div className="text-center">
        <p className="text-ifm-gray">Dein Ergebnis</p>
        <div className="mt-2 text-4xl font-bold text-ifm-blue">
          {ergebnis.punkte_gesamt} / {ergebnis.punkte_max}
        </div>
        <div className="mt-1 text-lg text-ifm-blue">{ergebnis.prozent} %</div>
        <p className="mt-6 text-sm text-ifm-gray">
          Dein Trainer schickt dir eine ausführliche Auswertung als PDF.
        </p>
      </div>
    </Schirm>
  )
}

/** Zentrierter Karten-Screen im IFM-Design (für Beitreten/Lobby/Ergebnis/Hinweise). */
function Schirm({
  children,
  titel,
  unter,
}: {
  children: React.ReactNode
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
