import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Tables } from '../lib/database.types'
import { Button, Card, ConfirmDialog, EmptyState, ErrorBanner, IconButton } from '../components/ui'
import { TrashIcon } from '../components/icons'
import {
  freigabeAblehnen,
  freigabeAnnehmen,
  geteiltePruefungKursKopieren,
  MODUS_LABEL,
  PRUEFUNG_MODUS_LABEL,
  pruefungFreigabeAblehnen,
  pruefungFreigabeAnnehmen,
  type FreigabeModus,
  type PruefungFreigabeModus,
} from '../lib/sharing'

type Freigabe = Tables<'kurs_freigabe'>
type PFreigabe = Tables<'pruefung_freigabe'>

export default function GeteiltMitMirPage() {
  const { user } = useAuth()
  const [freigaben, setFreigaben] = useState<Freigabe[]>([])
  const [pFreigaben, setPFreigaben] = useState<PFreigabe[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [widerrufen, setWiderrufen] = useState<Freigabe | null>(null)
  const [widerrufenP, setWiderrufenP] = useState<PFreigabe | null>(null)
  const [kopierKandidat, setKopierKandidat] = useState<PFreigabe | null>(null)
  const [kopierBusy, setKopierBusy] = useState(false)
  const [entfernenK, setEntfernenK] = useState<Freigabe | null>(null)
  const [entfernenP, setEntfernenP] = useState<PFreigabe | null>(null)
  const [entfernenBusy, setEntfernenBusy] = useState(false)
  const [auchPruefungLoeschen, setAuchPruefungLoeschen] = useState(false)
  // Freigabe-ID -> IDs der eigenen Prüfungen, die aus dieser Freigabe entstanden sind
  // (nur bei „Eingeschränkt nutzen"; Kopien haben keinen Rückverweis).
  const [abgeleitet, setAbgeleitet] = useState<Record<string, string[]>>({})

  const meineId = user?.id

  const laden_ = useCallback(async () => {
    const [kRes, pRes, aRes] = await Promise.all([
      supabase.from('kurs_freigabe').select('*').order('created_at', { ascending: false }),
      supabase.from('pruefung_freigabe').select('*').order('created_at', { ascending: false }),
      supabase.from('pruefung').select('id, owner_id, quelle_freigabe_id').not('quelle_freigabe_id', 'is', null),
    ])
    if (kRes.error) setFehler(kRes.error.message)
    else setFreigaben(kRes.data)
    if (pRes.error) setFehler(pRes.error.message)
    else if (pRes.data) setPFreigaben(pRes.data)
    if (aRes.data) {
      const map: Record<string, string[]> = {}
      for (const p of aRes.data) {
        if (p.owner_id !== meineId || !p.quelle_freigabe_id) continue
        ;(map[p.quelle_freigabe_id] ??= []).push(p.id)
      }
      setAbgeleitet(map)
    }
    setLaden(false)
  }, [meineId])

  useEffect(() => {
    laden_()
  }, [laden_])

  const eingehend = freigaben.filter((f) => f.besitzer_id !== meineId)
  const offen = eingehend.filter((f) => f.status === 'eingeladen')
  const angenommen = eingehend.filter((f) => f.status === 'angenommen')
  const ausgehend = freigaben.filter((f) => f.besitzer_id === meineId)

  const pEingehend = pFreigaben.filter((f) => f.besitzer_id !== meineId)
  const pOffen = pEingehend.filter((f) => f.status === 'eingeladen')
  const pAngenommen = pEingehend.filter((f) => f.status === 'angenommen')
  const pAusgehend = pFreigaben.filter((f) => f.besitzer_id === meineId)

  async function annehmen(f: Freigabe) {
    setBusyId(f.id)
    setFehler(null)
    try {
      await freigabeAnnehmen(f.id)
      setHinweis(
        f.modus === 'kopie'
          ? `Kopie von „${f.kurs_name}" wurde in deinem Konto angelegt.`
          : `„${f.kurs_name}" ist jetzt unter „Kurse" verfügbar.`,
      )
      await laden_()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Annehmen fehlgeschlagen.')
    } finally {
      setBusyId(null)
    }
  }

  async function ablehnen(f: Freigabe) {
    setBusyId(f.id)
    setFehler(null)
    try {
      await freigabeAblehnen(f.id)
      await laden_()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Ablehnen fehlgeschlagen.')
    } finally {
      setBusyId(null)
    }
  }

  async function annehmenP(f: PFreigabe) {
    setBusyId(f.id)
    setFehler(null)
    try {
      await pruefungFreigabeAnnehmen(f.id)
      setHinweis(
        f.modus === 'kopie'
          ? `Kopie von „${f.pruefung_name}" (inkl. Kurs & Fragen) wurde in deinem Konto angelegt – unter „Prüfungen".`
          : f.modus === 'korrektur'
            ? `Du korrigierst jetzt bei „${f.pruefung_name}" mit – die Prüfung erscheint unter „Prüfungen" (zur Korrektur).`
            : `„${f.pruefung_name}" ist jetzt als eigene Prüfung unter „Prüfungen" verfügbar.`,
      )
      await laden_()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Annehmen fehlgeschlagen.')
    } finally {
      setBusyId(null)
    }
  }

  async function ablehnenP(f: PFreigabe) {
    setBusyId(f.id)
    setFehler(null)
    try {
      await pruefungFreigabeAblehnen(f.id)
      await laden_()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Ablehnen fehlgeschlagen.')
    } finally {
      setBusyId(null)
    }
  }

  async function kopierBestaetigt() {
    if (!kopierKandidat) return
    setKopierBusy(true)
    setFehler(null)
    try {
      await geteiltePruefungKursKopieren(kopierKandidat.id)
      setHinweis(
        `Kurs von „${kopierKandidat.pruefung_name}" wurde in dein Konto kopiert – ` +
          'unter „Kurse" (und als Prüfung unter „Prüfungen").',
      )
      setKopierKandidat(null)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Kopieren fehlgeschlagen.')
    } finally {
      setKopierBusy(false)
    }
  }

  /**
   * Angenommene Freigabe zurückgeben. Der Status wandert auf 'abgelehnt' — und weil
   * `darf_kurs_lesen` ausdrücklich 'angenommen' verlangt, verschwindet der Kurs sofort
   * aus der eigenen Liste. Der Besitzer kann jederzeit neu einladen.
   */
  async function entfernenKBestaetigt() {
    if (!entfernenK) return
    setEntfernenBusy(true)
    setFehler(null)
    try {
      await freigabeAblehnen(entfernenK.id)
      setHinweis(`„${entfernenK.kurs_name}" wurde aus deinem Konto entfernt.`)
      setEntfernenK(null)
      await laden_()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.')
    } finally {
      setEntfernenBusy(false)
    }
  }

  async function entfernenPBestaetigt() {
    if (!entfernenP) return
    setEntfernenBusy(true)
    setFehler(null)
    try {
      const eigene = abgeleitet[entfernenP.id] ?? []
      if (auchPruefungLoeschen && eigene.length > 0) {
        const { error } = await supabase.from('pruefung').delete().in('id', eigene)
        if (error) throw new Error(error.message)
      }
      await pruefungFreigabeAblehnen(entfernenP.id)
      setHinweis(`„${entfernenP.pruefung_name}" wurde aus deinem Konto entfernt.`)
      setEntfernenP(null)
      await laden_()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.')
    } finally {
      setEntfernenBusy(false)
    }
  }

  function entfernenDialogOeffnen(f: PFreigabe) {
    setAuchPruefungLoeschen(false)
    setEntfernenP(f)
  }

  async function widerrufenBestaetigt() {
    if (!widerrufen) return
    setBusyId(widerrufen.id)
    const { error } = await supabase.from('kurs_freigabe').delete().eq('id', widerrufen.id)
    if (error) setFehler(error.message)
    else {
      setFreigaben((alt) => alt.filter((x) => x.id !== widerrufen.id))
      setWiderrufen(null)
    }
    setBusyId(null)
  }

  async function widerrufenPBestaetigt() {
    if (!widerrufenP) return
    setBusyId(widerrufenP.id)
    const { error } = await supabase.from('pruefung_freigabe').delete().eq('id', widerrufenP.id)
    if (error) setFehler(error.message)
    else {
      setPFreigaben((alt) => alt.filter((x) => x.id !== widerrufenP.id))
      setWiderrufenP(null)
    }
    setBusyId(null)
  }

  if (laden) return <p className="text-ifm-gray">Lädt …</p>

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ifm-blue">Geteilt mit mir</h1>
      <p className="mt-1 text-ifm-gray">Einladungen und Freigaben rund um deine Kurse und Prüfungen.</p>

      {hinweis && (
        <div className="mt-4 rounded-lg bg-ifm-green/10 text-ifm-green text-sm p-3">{hinweis}</div>
      )}
      {fehler && (
        <div className="mt-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {/* ===== Kurse ===== */}
      <h2 className="mt-8 mb-3 text-lg font-semibold text-ifm-blue">Kurs-Einladungen</h2>
      {offen.length === 0 ? (
        <EmptyState>Keine offenen Kurs-Einladungen.</EmptyState>
      ) : (
        <div className="space-y-3">
          {offen.map((f) => (
            <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-ifm-blue">{f.kurs_name}</div>
                <div className="text-sm text-ifm-gray">
                  von {f.besitzer_email ?? 'Trainer'} · {MODUS_LABEL[f.modus as FreigabeModus]}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => annehmen(f)} disabled={busyId === f.id}>
                  Annehmen
                </Button>
                <Button variant="secondary" onClick={() => ablehnen(f)} disabled={busyId === f.id}>
                  Ablehnen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {angenommen.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold text-ifm-gray">Angenommene Kurse</h3>
          <div className="space-y-2">
            {angenommen.map((f) => (
              <Card key={f.id} className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-ifm-blue">{f.kurs_name}</span>
                  <span className="ml-2 text-sm text-ifm-gray">
                    {MODUS_LABEL[f.modus as FreigabeModus]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link to="/kurse" className="text-sm text-ifm-blue hover:underline">
                    Zu den Kursen →
                  </Link>
                  <IconButton
                    variant="danger"
                    label="Aus meinem Konto entfernen"
                    onClick={() => setEntfernenK(f)}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ===== Prüfungen ===== */}
      <h2 className="mt-10 mb-3 text-lg font-semibold text-ifm-blue">Prüfungs-Einladungen</h2>
      {pOffen.length === 0 ? (
        <EmptyState>Keine offenen Prüfungs-Einladungen.</EmptyState>
      ) : (
        <div className="space-y-3">
          {pOffen.map((f) => (
            <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-ifm-blue">{f.pruefung_name}</div>
                <div className="text-sm text-ifm-gray">
                  von {f.besitzer_email ?? 'Trainer'} ·{' '}
                  {PRUEFUNG_MODUS_LABEL[f.modus as PruefungFreigabeModus]}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => annehmenP(f)} disabled={busyId === f.id}>
                  Annehmen
                </Button>
                <Button variant="secondary" onClick={() => ablehnenP(f)} disabled={busyId === f.id}>
                  Ablehnen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pAngenommen.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold text-ifm-gray">Angenommene Prüfungen</h3>
          <div className="space-y-2">
            {pAngenommen.map((f) => (
              <Card key={f.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-ifm-blue">{f.pruefung_name}</span>
                  <span className="ml-2 text-sm text-ifm-gray">
                    {PRUEFUNG_MODUS_LABEL[f.modus as PruefungFreigabeModus]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={() => setKopierKandidat(f)}>
                    Kurs kopieren
                  </Button>
                  <Link to="/pruefungen" className="text-sm text-ifm-blue hover:underline">
                    Zu den Prüfungen →
                  </Link>
                  <IconButton
                    variant="danger"
                    label="Aus meinem Konto entfernen"
                    onClick={() => entfernenDialogOeffnen(f)}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ===== Von mir geteilt ===== */}
      <h2 className="mt-10 mb-3 text-lg font-semibold text-ifm-blue">Von mir geteilt</h2>
      {ausgehend.length === 0 && pAusgehend.length === 0 ? (
        <EmptyState>Du hast noch nichts geteilt. Teile einen Kurs oder eine Prüfung.</EmptyState>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-ifm-lightblue">
            {ausgehend.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-ifm-blue truncate">
                    Kurs: {f.kurs_name} → {f.empfaenger_email}
                  </div>
                  <div className="text-xs text-ifm-gray">
                    {MODUS_LABEL[f.modus as FreigabeModus]} · {statusLabel(f.status)}
                  </div>
                </div>
                <IconButton
                  variant="danger"
                  label="Freigabe widerrufen"
                  onClick={() => setWiderrufen(f)}
                  disabled={busyId === f.id}
                >
                  <TrashIcon />
                </IconButton>
              </li>
            ))}
            {pAusgehend.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-ifm-blue truncate">
                    Prüfung: {f.pruefung_name} → {f.empfaenger_email}
                  </div>
                  <div className="text-xs text-ifm-gray">
                    {PRUEFUNG_MODUS_LABEL[f.modus as PruefungFreigabeModus]} · {statusLabel(f.status)}
                  </div>
                </div>
                <IconButton
                  variant="danger"
                  label="Freigabe widerrufen"
                  onClick={() => setWiderrufenP(f)}
                  disabled={busyId === f.id}
                >
                  <TrashIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={entfernenK !== null}
        title="Kurs aus meinem Konto entfernen"
        message={
          <>
            <strong>{entfernenK?.kurs_name}</strong> verschwindet aus deiner Kursliste. Der Kurs
            selbst bleibt bei {entfernenK?.besitzer_email ?? 'dem Besitzer'} vollständig erhalten –
            du gibst nur deinen Zugriff zurück und kannst jederzeit neu eingeladen werden.
            <br />
            <br />
            {entfernenK?.modus === 'kopie'
              ? 'Deine übernommene Kopie gehört dir und bleibt unberührt.'
              : entfernenK?.modus === 'gemeinsam'
                ? 'Du verlierst dein Bearbeitungsrecht. Deine bisherigen Änderungen bleiben im Kurs erhalten.'
                : 'Du kannst den Kurs danach nicht mehr für eigene Prüfungen verwenden.'}
          </>
        }
        confirmLabel="Entfernen"
        busy={entfernenBusy}
        onConfirm={entfernenKBestaetigt}
        onClose={() => setEntfernenK(null)}
      />

      <ConfirmDialog
        open={entfernenP !== null}
        title="Prüfung aus meinem Konto entfernen"
        message={
          <>
            <strong>{entfernenP?.pruefung_name}</strong> verschwindet aus „Geteilt mit mir". Du
            gibst damit die Freigabe an {entfernenP?.besitzer_email ?? 'den Besitzer'} zurück und
            kannst jederzeit neu eingeladen werden.
            <br />
            <br />
            {entfernenP?.modus === 'korrektur'
              ? 'Du kannst danach nicht mehr mitkorrigieren. Bereits gespeicherte Korrekturen und Feedback bleiben erhalten.'
              : entfernenP?.modus === 'kopie'
                ? 'Deine übernommene Kopie gehört dir und bleibt unberührt.'
                : 'Deine daraus erstellte Prüfung bleibt bestehen und lesbar; Fragen tauschen ist darin danach nicht mehr möglich.'}
            {entfernenP && (abgeleitet[entfernenP.id]?.length ?? 0) > 0 && (
              <label className="mt-4 flex gap-2 rounded-lg border border-ifm-gray/30 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={auchPruefungLoeschen}
                  onChange={(e) => setAuchPruefungLoeschen(e.target.checked)}
                  className="mt-1 accent-ifm-blue"
                />
                <span>
                  <span className="block font-medium text-ifm-blue">
                    Auch meine daraus erstellte Prüfung löschen
                  </span>
                  <span className="block text-sm text-ifm-gray">
                    Achtung: Teilnehmer, Antworten und Ergebnisse dieser Prüfung werden dabei
                    unwiderruflich gelöscht.
                  </span>
                </span>
              </label>
            )}
          </>
        }
        confirmLabel="Entfernen"
        busy={entfernenBusy}
        onConfirm={entfernenPBestaetigt}
        onClose={() => setEntfernenP(null)}
      />

      <ConfirmDialog
        open={widerrufen !== null}
        title="Freigabe widerrufen"
        message={
          <>
            Freigabe von <strong>{widerrufen?.kurs_name}</strong> an {widerrufen?.empfaenger_email}{' '}
            widerrufen? Bei „Gemeinsam bearbeiten" verliert die Person den Zugriff. Bereits
            übernommene Kopien bleiben bestehen.
          </>
        }
        confirmLabel="Widerrufen"
        busy={busyId === widerrufen?.id}
        onConfirm={widerrufenBestaetigt}
        onClose={() => setWiderrufen(null)}
      />

      <ConfirmDialog
        open={widerrufenP !== null}
        title="Prüfungs-Freigabe widerrufen"
        message={
          <>
            Freigabe von <strong>{widerrufenP?.pruefung_name}</strong> an{' '}
            {widerrufenP?.empfaenger_email} widerrufen? Bei „Eingeschränkt nutzen" verliert die
            Person den Zugriff auf deine Fragen. Bereits übernommene Kopien bleiben bestehen.
          </>
        }
        confirmLabel="Widerrufen"
        busy={busyId === widerrufenP?.id}
        onConfirm={widerrufenPBestaetigt}
        onClose={() => setWiderrufenP(null)}
      />

      <ConfirmDialog
        open={kopierKandidat !== null}
        title="Kurs in meinen Account kopieren"
        message={
          <>
            Du kopierst den <strong>Kurs</strong> der geteilten Prüfung „
            {kopierKandidat?.pruefung_name}" in deinen Account.
            <br />
            <br />
            <strong>Wichtig:</strong> Du bearbeitest damit <strong>nicht</strong> die bereits
            geplante Prüfung, sondern erhältst den Kurs samt allen Fragen als eigenständige Kopie.
            Wenn du die geplante (geteilte) Prüfung bearbeiten möchtest, nutze bitte den Tab{' '}
            <strong>„Prüfungen"</strong>.
          </>
        }
        confirmLabel="Kurs kopieren"
        variant="primary"
        busy={kopierBusy}
        onConfirm={kopierBestaetigt}
        onClose={() => setKopierKandidat(null)}
      />
    </div>
  )
}

function statusLabel(status: string): string {
  if (status === 'eingeladen') return 'offen'
  if (status === 'angenommen') return 'angenommen'
  if (status === 'abgelehnt') return 'abgelehnt'
  return status
}
