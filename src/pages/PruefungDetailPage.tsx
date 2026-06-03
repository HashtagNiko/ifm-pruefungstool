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
  const [teilnehmer, setTeilnehmer] = useState<
    {
      id: string
      name: string
      gestartet_am: string | null
      abgegeben_am: string | null
      punkte_gesamt: number | null
      punkte_max: number | null
      prozent: number | null
    }[]
  >([])

  const ladeTeilnehmer = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('teilnehmer')
      .select('id, name, gestartet_am, abgegeben_am, punkte_gesamt, punkte_max, prozent')
      .eq('pruefung_id', id)
      .order('created_at', { ascending: true })
    if (!error && data) setTeilnehmer(data)
  }, [id])

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
      await Promise.all([ladeSnapshot(), ladeTeilnehmer()])
      setLaden(false)
    })()
  }, [id, ladeSnapshot, ladeTeilnehmer])

  // Realtime: Live-Teilnehmerliste (Lobby / Abgaben)
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`teilnehmer-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teilnehmer', filter: `pruefung_id=eq.${id}` },
        () => ladeTeilnehmer(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, ladeTeilnehmer])

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

  async function setzeStatus(
    neu: string,
    extra: Partial<Pick<Tables<'pruefung'>, 'start_zeit' | 'end_zeit'>> = {},
  ) {
    if (!pruefung) return
    setBusy(true)
    setFehler(null)
    const { error } = await supabase
      .from('pruefung')
      .update({ status: neu, ...extra })
      .eq('id', pruefung.id)
    if (error) setFehler(error.message)
    else setPruefung((p) => (p ? { ...p, status: neu, ...extra } : p))
    setBusy(false)
  }

  function pruefungStarten() {
    const dauer = pruefung?.pruefungsvorlage?.dauer_minuten ?? 0
    const start = new Date()
    const ende = new Date(start.getTime() + dauer * 60_000)
    setzeStatus('laeuft', { start_zeit: start.toISOString(), end_zeit: ende.toISOString() })
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
          Teilnehmer öffnen diesen Link, geben ihren Namen ein und warten in der Lobby, bis du
          startest.
        </p>
      </Card>

      {/* Steuerung */}
      <Card className="mt-4">
        <div className="text-sm font-medium text-ifm-blue mb-3">Steuerung</div>
        <div className="flex flex-wrap items-center gap-2">
          {pruefung.status === 'entwurf' && (
            <Button onClick={() => setzeStatus('lobby')} disabled={busy || snapshot.length === 0}>
              Lobby öffnen
            </Button>
          )}
          {pruefung.status === 'lobby' && (
            <>
              <Button onClick={pruefungStarten} disabled={busy}>
                Prüfung starten
              </Button>
              <Button variant="secondary" onClick={() => setzeStatus('entwurf')} disabled={busy}>
                Lobby schließen (zurück zu Entwurf)
              </Button>
            </>
          )}
          {pruefung.status === 'laeuft' && (
            <Button
              variant="danger"
              onClick={() => setzeStatus('beendet', { end_zeit: new Date().toISOString() })}
              disabled={busy}
            >
              Prüfung beenden
            </Button>
          )}
          {pruefung.status === 'beendet' && (
            <span className="text-sm text-ifm-gray">
              Prüfung ist beendet. Auswertung folgt im nächsten Schritt.
            </span>
          )}
        </div>
      </Card>

      {/* Teilnehmer (ab Lobby) */}
      {pruefung.status !== 'entwurf' && (
        <Card className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-ifm-blue">
              Teilnehmer ({teilnehmer.length})
            </div>
            <div className="text-xs text-ifm-gray">
              {teilnehmer.filter((t) => t.abgegeben_am).length} abgegeben
            </div>
          </div>
          {teilnehmer.length === 0 ? (
            <p className="text-sm text-ifm-gray">
              Noch niemand beigetreten. Teilnehmer erscheinen hier live.
            </p>
          ) : (
            <ul className="divide-y divide-ifm-lightblue">
              {teilnehmer.map((t) => {
                const zustand = t.abgegeben_am
                  ? { label: 'abgegeben', cls: 'text-ifm-green' }
                  : t.gestartet_am
                    ? { label: 'schreibt', cls: 'text-ifm-blue' }
                    : { label: 'wartet', cls: 'text-ifm-gray' }
                const inhalt = (
                  <>
                    <span className="text-ifm-blue">{t.name}</span>
                    <span className="flex items-center gap-3">
                      {t.abgegeben_am && t.punkte_max != null && (
                        <span className="text-ifm-gray">
                          {t.punkte_gesamt}/{t.punkte_max} · {t.prozent} %
                        </span>
                      )}
                      <span className={`font-medium ${zustand.cls}`}>{zustand.label}</span>
                    </span>
                  </>
                )
                return (
                  <li key={t.id} className="text-sm">
                    {t.abgegeben_am ? (
                      <Link
                        to={`/pruefungen/${pruefung.id}/teilnehmer/${t.id}`}
                        className="flex items-center justify-between py-2 hover:bg-ifm-lightblue/40 rounded px-1 -mx-1"
                      >
                        {inhalt}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between py-2">{inhalt}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

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
