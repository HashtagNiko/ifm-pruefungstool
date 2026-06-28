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

  const laden_ = useCallback(async () => {
    const [kRes, pRes] = await Promise.all([
      supabase.from('kurs_freigabe').select('*').order('created_at', { ascending: false }),
      supabase.from('pruefung_freigabe').select('*').order('created_at', { ascending: false }),
    ])
    if (kRes.error) setFehler(kRes.error.message)
    else setFreigaben(kRes.data)
    if (pRes.error) setFehler(pRes.error.message)
    else if (pRes.data) setPFreigaben(pRes.data)
    setLaden(false)
  }, [])

  useEffect(() => {
    laden_()
  }, [laden_])

  const meineId = user?.id
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
                <Link to="/kurse" className="text-sm text-ifm-blue hover:underline">
                  Zu den Kursen →
                </Link>
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
              <Card key={f.id} className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-ifm-blue">{f.pruefung_name}</span>
                  <span className="ml-2 text-sm text-ifm-gray">
                    {PRUEFUNG_MODUS_LABEL[f.modus as PruefungFreigabeModus]}
                  </span>
                </div>
                <Link to="/pruefungen" className="text-sm text-ifm-blue hover:underline">
                  Zu den Prüfungen →
                </Link>
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
    </div>
  )
}

function statusLabel(status: string): string {
  if (status === 'eingeladen') return 'offen'
  if (status === 'angenommen') return 'angenommen'
  if (status === 'abgelehnt') return 'abgelehnt'
  return status
}
