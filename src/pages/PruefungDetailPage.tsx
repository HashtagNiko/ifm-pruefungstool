import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
} from '../components/ui'
import { TrashIcon } from '../components/icons'
import { StatusBadge } from '../components/pruefungStatus'
import { tauscheFrage, wuerfleNeu } from '../lib/pruefungErstellen'

type PruefungRow = Tables<'pruefung'> & {
  pruefungsvorlage:
    | {
        name: string
        kurs_id: string
        dauer_minuten: number
        bestehensschwelle_prozent: number
        bestehensschwelle_pro_themengebiet_prozent: number | null
        kurs: { name: string } | null
      }
    | null
}

type SnapshotRow = Tables<'pruefung_frage'> & {
  frage: { text: string; typ: string } | null
  themengebiet: { name: string; sortierung: number } | null
}

const LATE_JOIN_LABEL: Record<string, string> = {
  zeit_reduziert: 'Restzeit',
  volle_zeit: 'Volle Zeit ab Einstieg',
  gesperrt: 'Gesperrt nach Start',
}

export default function PruefungDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [pruefung, setPruefung] = useState<PruefungRow | null>(null)
  const [snapshot, setSnapshot] = useState<SnapshotRow[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loeschOffen, setLoeschOffen] = useState(false)
  const [wuerfelnOffen, setWuerfelnOffen] = useState(false)

  const ladeSnapshot = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('pruefung_frage')
      .select('*, frage(text, typ), themengebiet(name, sortierung)')
      .eq('pruefung_id', id)
      .order('sortierung', { ascending: true })
      .returns<SnapshotRow[]>()
    if (error) setFehler(error.message)
    else if (data) setSnapshot(data)
  }, [id])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLaden(true)
      const { data, error } = await supabase
        .from('pruefung')
        .select(
          '*, pruefungsvorlage(name, kurs_id, dauer_minuten, bestehensschwelle_prozent, bestehensschwelle_pro_themengebiet_prozent, kurs(name))',
        )
        .eq('id', id)
        .single()
        .returns<PruefungRow>()
      if (error) setFehler(error.message)
      else setPruefung(data)
      await ladeSnapshot()
      setLaden(false)
    })()
  }, [id, ladeSnapshot])

  const istEntwurf = pruefung?.status === 'entwurf'

  async function frageTauschen(row: SnapshotRow) {
    if (!pruefung?.pruefungsvorlage) return
    setBusy(true)
    setFehler(null)
    try {
      await tauscheFrage(
        row.id,
        pruefung.pruefungsvorlage.kurs_id,
        row.themengebiet_id!,
        snapshot.map((s) => s.frage_id),
      )
      await ladeSnapshot()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Tauschen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function alleNeuWuerfeln() {
    if (!pruefung?.pruefungsvorlage) return
    setWuerfelnOffen(false)
    setBusy(true)
    setFehler(null)
    try {
      await wuerfleNeu(pruefung.id, pruefung.pruefungsvorlage.kurs_id, pruefung.vorlage_id)
      await ladeSnapshot()
      setHinweis('Fragen neu gewürfelt.')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Würfeln fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function pruefungLoeschen() {
    if (!pruefung) return
    setBusy(true)
    const { error } = await supabase.from('pruefung').delete().eq('id', pruefung.id)
    if (error) {
      setFehler(error.message)
      setBusy(false)
    } else {
      navigate('/pruefungen')
    }
  }

  async function linkKopieren() {
    if (!pruefung) return
    const link = `${window.location.origin}/p/${pruefung.zugangscode}`
    await navigator.clipboard.writeText(link)
    setHinweis('Teilnehmer-Link kopiert.')
  }

  if (laden) return <p className="text-ifm-gray">Lädt …</p>
  if (!pruefung)
    return (
      <div>
        <ErrorBanner message="Prüfung nicht gefunden." />
        <Link to="/pruefungen" className="mt-4 inline-block text-ifm-blue hover:underline">
          ← Zurück zu den Prüfungen
        </Link>
      </div>
    )

  const vorlage = pruefung.pruefungsvorlage
  const teilnehmerLink = `${window.location.origin}/p/${pruefung.zugangscode}`

  // Snapshot nach Themengebiet gruppieren (Reihenfolge über sortierung gegeben)
  const gruppen: { name: string; rows: SnapshotRow[] }[] = []
  for (const row of snapshot) {
    const name = row.themengebiet?.name ?? 'Ohne Themengebiet'
    const letzte = gruppen[gruppen.length - 1]
    if (letzte && letzte.name === name) letzte.rows.push(row)
    else gruppen.push({ name, rows: [row] })
  }

  return (
    <div>
      <Link to="/pruefungen" className="text-sm text-ifm-gray hover:underline">
        ← Prüfungen
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ifm-blue">{vorlage?.name ?? 'Prüfung'}</h1>
          <p className="mt-1 text-ifm-gray">
            {vorlage?.kurs?.name ?? '—'}
            {pruefung.datum && ` · ${new Date(pruefung.datum).toLocaleDateString('de-DE')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={pruefung.status} />
          <IconButton variant="danger" label="Prüfung löschen" onClick={() => setLoeschOffen(true)}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>

      {hinweis && (
        <div className="mt-4 rounded-lg bg-ifm-green/10 text-ifm-green text-sm p-3">
          {hinweis}
        </div>
      )}
      {fehler && (
        <div className="mt-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {/* Eckdaten */}
      <Card className="mt-4">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-ifm-gray">Dauer</dt>
            <dd className="text-ifm-blue font-medium">{vorlage?.dauer_minuten} Min.</dd>
          </div>
          <div>
            <dt className="text-ifm-gray">Bestehen gesamt</dt>
            <dd className="text-ifm-blue font-medium">{vorlage?.bestehensschwelle_prozent} %</dd>
          </div>
          <div>
            <dt className="text-ifm-gray">je Themengebiet</dt>
            <dd className="text-ifm-blue font-medium">
              {vorlage?.bestehensschwelle_pro_themengebiet_prozent != null
                ? `${vorlage.bestehensschwelle_pro_themengebiet_prozent} %`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ifm-gray">Späteinsteiger</dt>
            <dd className="text-ifm-blue font-medium">
              {LATE_JOIN_LABEL[pruefung.late_join_modus] ?? pruefung.late_join_modus}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Teilnehmer-Link */}
      <Card className="mt-4">
        <div className="text-sm font-medium text-ifm-blue mb-2">Teilnehmer-Link</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-lg bg-ifm-lightblue/50 px-3 py-2 text-sm text-ifm-blue">
            {teilnehmerLink}
          </code>
          <Button variant="secondary" onClick={linkKopieren}>
            Kopieren
          </Button>
        </div>
        <p className="mt-2 text-xs text-ifm-gray">
          Der Teilnehmer-Zugang (Lobby & Prüfungslauf) wird im nächsten Schritt gebaut.
        </p>
      </Card>

      {/* Snapshot */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ifm-blue">
          Fragen-Snapshot ({snapshot.length})
        </h2>
        {istEntwurf && (
          <Button
            variant="secondary"
            onClick={() => setWuerfelnOffen(true)}
            disabled={busy || snapshot.length === 0}
          >
            Alle neu würfeln
          </Button>
        )}
      </div>

      {!istEntwurf && (
        <p className="mt-1 text-sm text-ifm-gray">
          Der Snapshot ist fixiert (Status „{pruefung.status}"). Würfeln/Tauschen ist nur im
          Entwurf möglich.
        </p>
      )}

      <div className="mt-3 space-y-5">
        {snapshot.length === 0 ? (
          <EmptyState>Kein Snapshot vorhanden.</EmptyState>
        ) : (
          gruppen.map((g) => (
            <div key={g.name}>
              <div className="mb-2 text-sm font-medium text-ifm-gray">
                {g.name} ({g.rows.length})
              </div>
              <Card className="p-0 overflow-hidden">
                <ul className="divide-y divide-ifm-lightblue">
                  {g.rows.map((row) => (
                    <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="text-ifm-gray text-sm pt-0.5 w-7 text-right">
                        {row.sortierung + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-ifm-blue">{row.frage?.text}</p>
                        <span className="text-xs text-ifm-gray">
                          {row.frage?.typ === 'multi' ? 'Multi (2 richtig)' : 'Single (1 richtig)'}
                        </span>
                      </div>
                      {istEntwurf && (
                        <Button
                          variant="ghost"
                          className="shrink-0"
                          onClick={() => frageTauschen(row)}
                          disabled={busy}
                        >
                          Tauschen
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={loeschOffen}
        title="Prüfung löschen"
        message="Die Prüfung und ihr Fragen-Snapshot werden gelöscht. Teilnehmer-Daten dieser Prüfung gehen verloren."
        busy={busy}
        onConfirm={pruefungLoeschen}
        onClose={() => setLoeschOffen(false)}
      />

      <ConfirmDialog
        open={wuerfelnOffen}
        title="Alle Fragen neu würfeln"
        message="Die komplette Fragenauswahl wird neu aus dem Pool gezogen. Der bisherige Snapshot wird ersetzt."
        confirmLabel="Neu würfeln"
        variant="primary"
        busy={busy}
        onConfirm={alleNeuWuerfeln}
        onClose={() => setWuerfelnOffen(false)}
      />
    </div>
  )
}
