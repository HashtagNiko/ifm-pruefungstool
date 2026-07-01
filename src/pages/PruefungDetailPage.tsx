import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Tables } from '../lib/database.types'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
} from '../components/ui'
import { ShareIcon, TrashIcon } from '../components/icons'
import { StatusBadge } from '../components/pruefungStatus'
import { tauscheFrage, wuerfleNeu } from '../lib/pruefungErstellen'
import PruefungTeilenModal from '../components/PruefungTeilenModal'
import FrageModal from '../components/FrageModal'
import FrageWaehlenModal from '../components/FrageWaehlenModal'

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
  const { user } = useAuth()
  const [pruefung, setPruefung] = useState<PruefungRow | null>(null)
  // Korrektur-Chips: teilnehmer_id -> Liste korrigierter Themengebiete
  const [korrekturProTeilnehmer, setKorrekturProTeilnehmer] = useState<
    Record<string, { themengebiet_id: string; trainer_name: string | null }[]>
  >({})
  // Darf der eingeladene Korrektor diese (geteilte) Prüfung leiten (Lobby öffnen)?
  const [empfaengerLeitet, setEmpfaengerLeitet] = useState(false)
  const [snapshot, setSnapshot] = useState<SnapshotRow[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loeschOffen, setLoeschOffen] = useState(false)
  const [wuerfelnOffen, setWuerfelnOffen] = useState(false)
  const [teilenOffen, setTeilenOffen] = useState(false)
  // null = eigene Prüfung (alles erlaubt); Set = eingeschränkt geteilte Prüfung (nur diese Themengebiete)
  const [bearbeitbareTg, setBearbeitbareTg] = useState<Set<string> | null>(null)
  // Für Empfänger: freigegebene Themengebiete (zum Anlegen eigener Fragen im Pool des Besitzers)
  const [freigegebeneThemen, setFreigegebeneThemen] = useState<Tables<'themengebiet'>[]>([])
  const [frageNeuOffen, setFrageNeuOffen] = useState(false)
  const [waehlenFuer, setWaehlenFuer] = useState<SnapshotRow | null>(null)
  // Aufklappbare Fragen im Snapshot (Antwortoptionen anzeigen)
  const [offeneFragen, setOffeneFragen] = useState<Set<string>>(new Set())
  const [offeneGruppen, setOffeneGruppen] = useState<Set<string>>(new Set())
  const [optionenProFrage, setOptionenProFrage] = useState<
    Record<string, { id: string; text: string; ist_richtig: boolean; sortierung: number }[]>
  >({})
  const [teilnehmer, setTeilnehmer] = useState<
    {
      id: string
      name: string
      gestartet_am: string | null
      abgegeben_am: string | null
      punkte_gesamt: number | null
      punkte_max: number | null
      prozent: number | null
      anonymisiert_am: string | null
    }[]
  >([])

  const ladeTeilnehmer = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('teilnehmer')
      .select('id, name, gestartet_am, abgegeben_am, punkte_gesamt, punkte_max, prozent, anonymisiert_am')
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
    else if (data) {
      setSnapshot(data)
      // Antwortoptionen aller Snapshot-Fragen laden (zum Aufklappen)
      const frageIds = data.map((s) => s.frage_id)
      if (frageIds.length > 0) {
        const { data: opts } = await supabase
          .from('antwortoption')
          .select('id, frage_id, text, ist_richtig, sortierung')
          .in('frage_id', frageIds)
        const map: Record<
          string,
          { id: string; text: string; ist_richtig: boolean; sortierung: number }[]
        > = {}
        for (const o of opts ?? []) {
          ;(map[o.frage_id] ??= []).push(o)
        }
        for (const k of Object.keys(map)) map[k].sort((a, b) => a.sortierung - b.sortierung)
        setOptionenProFrage(map)
      }
    }
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
      // Eingeschränkt geteilte (übernommene) Prüfung? Dann freigegebene Themengebiete laden.
      if (data?.quelle_freigabe_id) {
        const { data: fr } = await supabase
          .from('pruefung_freigabe')
          .select('bearbeitbare_themengebiete')
          .eq('id', data.quelle_freigabe_id)
          .maybeSingle()
        const tgIds = fr?.bearbeitbare_themengebiete ?? []
        setBearbeitbareTg(new Set(tgIds))
        if (tgIds.length > 0) {
          const { data: tgs } = await supabase
            .from('themengebiet')
            .select('*')
            .in('id', tgIds)
            .order('sortierung', { ascending: true })
          setFreigegebeneThemen(tgs ?? [])
        }
      }
      // Geteilt zur Korrektur (fremde Prüfung)? Leiter-Recht + freigegebene Themengebiete laden.
      if (data && user && data.owner_id !== user.id) {
        const { data: fr } = await supabase
          .from('pruefung_freigabe')
          .select('empfaenger_leitet, bearbeitbare_themengebiete')
          .eq('pruefung_id', id)
          .eq('empfaenger_id', user.id)
          .eq('modus', 'korrektur')
          .eq('status', 'angenommen')
          .maybeSingle()
        setEmpfaengerLeitet(fr?.empfaenger_leitet ?? false)
        const tgIds = fr?.bearbeitbare_themengebiete ?? []
        setBearbeitbareTg(new Set(tgIds))
        if (tgIds.length > 0) {
          const { data: tgs } = await supabase
            .from('themengebiet')
            .select('*')
            .in('id', tgIds)
            .order('sortierung', { ascending: true })
          setFreigegebeneThemen(tgs ?? [])
        }
      }
      await Promise.all([ladeSnapshot(), ladeTeilnehmer()])
      const { data: tnIds } = await supabase.from('teilnehmer').select('id').eq('pruefung_id', id)
      const ids = (tnIds ?? []).map((t) => t.id)
      if (ids.length > 0) {
        const { data: ks } = await supabase
          .from('korrektur_status')
          .select('teilnehmer_id, themengebiet_id, trainer_name')
          .in('teilnehmer_id', ids)
        const map: Record<string, { themengebiet_id: string; trainer_name: string | null }[]> = {}
        for (const k of ks ?? []) {
          ;(map[k.teilnehmer_id] ??= []).push({
            themengebiet_id: k.themengebiet_id,
            trainer_name: k.trainer_name,
          })
        }
        setKorrekturProTeilnehmer(map)
      }
      setLaden(false)
    })()
  }, [id, ladeSnapshot, ladeTeilnehmer, user?.id])

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
  const istBesitzer = !!pruefung && pruefung.owner_id === user?.id
  const istKorrektor = !!pruefung && pruefung.owner_id !== user?.id // Zugriff via Korrektur-Freigabe
  const darfLeiten = istBesitzer || empfaengerLeitet // Lobby öffnen/starten/beenden
  const istEmpfaenger = bearbeitbareTg !== null
  const darfWuerfeln = istBesitzer && istEntwurf && !istEmpfaenger
  function frageAufklappen(rowId: string) {
    setOffeneFragen((alt) => {
      const neu = new Set(alt)
      if (neu.has(rowId)) neu.delete(rowId)
      else neu.add(rowId)
      return neu
    })
  }

  function gruppeAufklappen(key: string) {
    setOffeneGruppen((alt) => {
      const neu = new Set(alt)
      if (neu.has(key)) neu.delete(key)
      else neu.add(key)
      return neu
    })
  }

  function darfTauschen(themengebietId: string | null): boolean {
    if (!istEntwurf) return false
    // Eingeschränkt-Kopie ODER Korrektur-Empfänger: nur in freigegebenen Themengebieten
    if (bearbeitbareTg !== null) return themengebietId != null && bearbeitbareTg.has(themengebietId)
    // Eigene Prüfung: voller Zugriff
    return istBesitzer
  }

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

  const [zipBusy, setZipBusy] = useState(false)
  async function zipExport() {
    if (!pruefung) return
    const abgegebene = teilnehmer.filter((t) => t.abgegeben_am).map((t) => ({ id: t.id, name: t.name }))
    if (abgegebene.length === 0) return
    setZipBusy(true)
    setFehler(null)
    try {
      const name = `Auswertungen_${pruefung.pruefungsvorlage?.name ?? 'Pruefung'}.zip`
      const { erzeugeZip } = await import('../lib/pdf/pruefungPdf')
      await erzeugeZip(pruefung.id, abgegebene, name)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'ZIP-Export fehlgeschlagen.')
    } finally {
      setZipBusy(false)
    }
  }

  const [anonOffen, setAnonOffen] = useState(false)
  const [anonBusy, setAnonBusy] = useState(false)
  async function anonymisieren() {
    if (!pruefung) return
    setAnonBusy(true)
    setFehler(null)
    const { error } = await supabase.rpc('pruefung_anonymisieren', { p_pruefung_id: pruefung.id })
    if (error) setFehler(error.message)
    else {
      setAnonOffen(false)
      setHinweis('Teilnehmernamen wurden anonymisiert.')
      await ladeTeilnehmer()
    }
    setAnonBusy(false)
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
  const gruppen: { key: string; name: string; rows: SnapshotRow[] }[] = []
  for (const row of snapshot) {
    const name = row.themengebiet?.name ?? 'Ohne Themengebiet'
    const key = row.themengebiet_id ?? 'ohne'
    const letzte = gruppen[gruppen.length - 1]
    if (letzte && letzte.key === key) letzte.rows.push(row)
    else gruppen.push({ key, name, rows: [row] })
  }

  // Themengebiet-Namen für die Korrektur-Chips
  const tgName: Record<string, string> = {}
  for (const row of snapshot) {
    if (row.themengebiet_id) tgName[row.themengebiet_id] = row.themengebiet?.name ?? 'Themengebiet'
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
          {pruefung.uebungsmodus ? (
            <span className="shrink-0 rounded-full bg-ifm-yellow/25 px-3 py-1 text-xs font-medium text-ifm-blue">
              Übungsmodus
            </span>
          ) : (
            <StatusBadge status={pruefung.status} />
          )}
          {istBesitzer && !istEmpfaenger && (
            <IconButton label="Prüfung teilen" onClick={() => setTeilenOffen(true)}>
              <ShareIcon />
            </IconButton>
          )}
          {istBesitzer && (
            <IconButton variant="danger" label="Prüfung löschen" onClick={() => setLoeschOffen(true)}>
              <TrashIcon />
            </IconButton>
          )}
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

      {/* Korrektor-Hinweis */}
      {istKorrektor && (
        <div className="mt-4 rounded-lg bg-ifm-lightblue/60 text-ifm-blue text-sm p-3">
          Du korrigierst diese Prüfung mit. Öffne unten einen abgegebenen Teilnehmer und gib in
          deinen zugewiesenen Themengebieten Feedback bzw. markiere sie als korrigiert.
          {empfaengerLeitet && ' Du leitest diese Prüfung – du kannst die Lobby öffnen und starten.'}
        </div>
      )}

      {/* Teilnehmer-Link */}
      {darfLeiten && (
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
          {pruefung.uebungsmodus
            ? 'Teilnehmer öffnen diesen Link, geben ihren Namen ein und können sofort (nach kurzer Lobby) üben – beliebig oft.'
            : 'Teilnehmer öffnen diesen Link, geben ihren Namen ein und warten in der Lobby, bis du startest.'}
        </p>
      </Card>
      )}

      {/* Steuerung */}
      {darfLeiten && (
      <Card className="mt-4">
        <div className="text-sm font-medium text-ifm-blue mb-3">Steuerung</div>
        {pruefung.uebungsmodus ? (
          <p className="text-sm text-ifm-gray">
            Übungsmodus: Diese Prüfung ist dauerhaft offen. Teilnehmer brauchen keinen Start –
            sie öffnen den Link, geben ihren Namen ein, warten kurz und können beliebig oft üben.
          </p>
        ) : (
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
        )}
      </Card>
      )}

      {/* Teilnehmer (ab Lobby) */}
      {(istKorrektor || pruefung.status !== 'entwurf') && (
        <Card className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-ifm-blue">
              Teilnehmer ({teilnehmer.length})
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ifm-gray">
                {teilnehmer.filter((t) => t.abgegeben_am).length} abgegeben
              </span>
              {istBesitzer && teilnehmer.some((t) => t.abgegeben_am) && (
                <Button variant="secondary" onClick={zipExport} disabled={zipBusy}>
                  {zipBusy ? 'ZIP wird erstellt …' : 'ZIP-Export (PDFs)'}
                </Button>
              )}
              {istBesitzer && teilnehmer.some((t) => !t.anonymisiert_am) && (
                <Button variant="ghost" onClick={() => setAnonOffen(true)}>
                  Namen anonymisieren
                </Button>
              )}
            </div>
          </div>
          <p className="-mt-1 mb-3 text-xs text-ifm-gray">
            Datenschutz: Teilnehmernamen werden 7 Tage nach Abgabe automatisch anonymisiert.
            PDFs/ZIP also vorher herunterladen.
          </p>
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
                const korr = korrekturProTeilnehmer[t.id] ?? []
                const inhalt = (
                  <>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-ifm-blue">{t.name}</span>
                      {korr.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {korr.map((k) => (
                            <span
                              key={k.themengebiet_id}
                              className="inline-flex items-center gap-1 rounded-full bg-ifm-green/15 px-2 py-0.5 text-[11px] font-medium text-ifm-green"
                            >
                              ✓ {tgName[k.themengebiet_id] ?? 'Themengebiet'}
                              {k.trainer_name ? ` · ${k.trainer_name}` : ''}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
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
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ifm-blue">
          Fragen-Snapshot ({snapshot.length})
        </h2>
        <div className="flex items-center gap-2">
          {snapshot.length > 0 && (
            <Link
              to={`/pruefungen/${pruefung.id}/vorschau`}
              className="rounded-lg bg-ifm-blue px-4 py-2 text-sm font-medium text-white hover:bg-ifm-blue/90"
            >
              Vorschau / Test-Durchlauf
            </Link>
          )}
          {darfWuerfeln && (
            <Button
              variant="secondary"
              onClick={() => setWuerfelnOffen(true)}
              disabled={busy || snapshot.length === 0}
            >
              Alle neu würfeln
            </Button>
          )}
          {istEmpfaenger && istEntwurf && freigegebeneThemen.length > 0 && (
            <Button variant="secondary" onClick={() => setFrageNeuOffen(true)}>
              Frage zum Pool hinzufügen
            </Button>
          )}
        </div>
      </div>

      {!istEntwurf && (
        <p className="mt-1 text-sm text-ifm-gray">
          Der Snapshot ist fixiert (Status „{pruefung.status}"). Würfeln/Tauschen ist nur im
          Entwurf möglich.
        </p>
      )}

      {istEntwurf && istEmpfaenger && (
        <p className="mt-1 text-sm text-ifm-gray">
          Geteilte Prüfung: Fragen lassen sich nur in den freigegebenen Themengebieten tauschen.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {snapshot.length === 0 ? (
          <EmptyState>Kein Snapshot vorhanden.</EmptyState>
        ) : (
          gruppen.map((g) => {
            const gruppeAuf = offeneGruppen.has(g.key)
            return (
            <div
              key={g.key}
              className="rounded-xl border border-ifm-gray/20 bg-white overflow-hidden"
            >
              <button
                type="button"
                onClick={() => gruppeAufklappen(g.key)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-ifm-lightblue/30"
                aria-expanded={gruppeAuf}
              >
                <span className="select-none text-ifm-gray">{gruppeAuf ? '▾' : '▸'}</span>
                <span className="font-semibold text-ifm-blue">{g.name}</span>
                <span className="rounded-full bg-ifm-lightblue px-2 py-0.5 text-xs text-ifm-blue">
                  {g.rows.length}
                </span>
              </button>
              {gruppeAuf && (
                <ul className="border-t border-ifm-lightblue divide-y divide-ifm-lightblue">
                  {g.rows.map((row) => {
                    const offen = offeneFragen.has(row.id)
                    const opts = optionenProFrage[row.frage_id] ?? []
                    return (
                    <li key={row.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="text-ifm-gray text-sm pt-0.5 w-7 text-right">
                          {row.sortierung + 1}.
                        </span>
                        <button
                          type="button"
                          onClick={() => frageAufklappen(row.id)}
                          className="flex-1 min-w-0 text-left"
                          aria-expanded={offen}
                        >
                          <span className="flex items-start gap-1.5 text-ifm-blue">
                            <span className="select-none pt-0.5 text-ifm-gray">
                              {offen ? '▾' : '▸'}
                            </span>
                            <span>{row.frage?.text}</span>
                          </span>
                          <span className="ml-4 block text-xs text-ifm-gray">
                            {row.frage?.typ === 'multi' ? 'Multi (2 richtig)' : 'Single (1 richtig)'}
                          </span>
                        </button>
                        {darfTauschen(row.themengebiet_id) && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="ghost"
                              className="shrink-0"
                              onClick={() => setWaehlenFuer(row)}
                              disabled={busy}
                            >
                              Wählen
                            </Button>
                            <Button
                              variant="ghost"
                              className="shrink-0"
                              onClick={() => frageTauschen(row)}
                              disabled={busy}
                            >
                              Zufall
                            </Button>
                          </div>
                        )}
                      </div>
                      {offen && (
                        <ul className="mt-2 ml-11 space-y-1">
                          {opts.length === 0 ? (
                            <li className="text-xs text-ifm-gray">Keine Antwortoptionen.</li>
                          ) : (
                            opts.map((o) => (
                              <li
                                key={o.id}
                                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                                  o.ist_richtig ? 'bg-ifm-green/10' : 'bg-ifm-lightblue/30'
                                }`}
                              >
                                <span
                                  className={`w-4 shrink-0 text-center font-bold ${
                                    o.ist_richtig ? 'text-ifm-green' : 'text-transparent'
                                  }`}
                                >
                                  ✓
                                </span>
                                <span className={o.ist_richtig ? 'text-ifm-green' : 'text-ifm-blue'}>
                                  {o.text}
                                </span>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </li>
                    )
                  })}
                </ul>
              )}
            </div>
            )
          })
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
        open={anonOffen}
        title="Namen anonymisieren"
        message={
          <>
            Alle Teilnehmernamen dieser Prüfung werden zu „Anonymisiert" geändert. Antworten und
            Punkte bleiben erhalten. Das lässt sich nicht rückgängig machen.
          </>
        }
        confirmLabel="Anonymisieren"
        busy={anonBusy}
        onConfirm={anonymisieren}
        onClose={() => setAnonOffen(false)}
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

      {teilenOffen && (
        <PruefungTeilenModal
          pruefungId={pruefung.id}
          pruefungName={vorlage?.name ?? 'Prüfung'}
          onClose={() => setTeilenOffen(false)}
        />
      )}

      {frageNeuOffen && vorlage && (
        <FrageModal
          kursId={vorlage.kurs_id}
          themengebiete={freigegebeneThemen}
          frage={null}
          onClose={() => setFrageNeuOffen(false)}
          onSaved={() => {
            setFrageNeuOffen(false)
            setHinweis(
              'Frage zum Pool hinzugefügt. Setze sie über „Wählen" gezielt in einen Slot ein.',
            )
          }}
        />
      )}

      {waehlenFuer && vorlage && waehlenFuer.themengebiet_id && (
        <FrageWaehlenModal
          pruefungFrageId={waehlenFuer.id}
          kursId={vorlage.kurs_id}
          themengebietId={waehlenFuer.themengebiet_id}
          themengebietName={waehlenFuer.themengebiet?.name ?? 'Themengebiet'}
          aktuelleFrageId={waehlenFuer.frage_id}
          belegteFrageIds={snapshot.map((s) => s.frage_id)}
          onClose={() => setWaehlenFuer(null)}
          onGewaehlt={() => {
            setWaehlenFuer(null)
            setHinweis('Frage übernommen.')
            ladeSnapshot()
          }}
        />
      )}
    </div>
  )
}
