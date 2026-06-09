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
  type FreigabeModus,
} from '../lib/sharing'

type Freigabe = Tables<'kurs_freigabe'>

export default function GeteiltMitMirPage() {
  const { user } = useAuth()
  const [freigaben, setFreigaben] = useState<Freigabe[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [widerrufen, setWiderrufen] = useState<Freigabe | null>(null)

  const laden_ = useCallback(async () => {
    const { data, error } = await supabase
      .from('kurs_freigabe')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setFehler(error.message)
    else setFreigaben(data)
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

  if (laden) return <p className="text-ifm-gray">Lädt …</p>

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ifm-blue">Geteilt mit mir</h1>
      <p className="mt-1 text-ifm-gray">Einladungen und Freigaben rund um deine Kurse.</p>

      {hinweis && (
        <div className="mt-4 rounded-lg bg-ifm-green/10 text-ifm-green text-sm p-3">{hinweis}</div>
      )}
      {fehler && (
        <div className="mt-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {/* Offene Einladungen */}
      <h2 className="mt-8 mb-3 text-lg font-semibold text-ifm-blue">Einladungen</h2>
      {offen.length === 0 ? (
        <EmptyState>Keine offenen Einladungen.</EmptyState>
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

      {/* Angenommene */}
      {angenommen.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold text-ifm-blue">Angenommen</h2>
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

      {/* Von mir geteilt */}
      <h2 className="mt-8 mb-3 text-lg font-semibold text-ifm-blue">Von mir geteilt</h2>
      {ausgehend.length === 0 ? (
        <EmptyState>Du hast noch nichts geteilt. Teile einen Kurs über „Kurse".</EmptyState>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-ifm-lightblue">
            {ausgehend.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-ifm-blue truncate">
                    {f.kurs_name} → {f.empfaenger_email}
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
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={widerrufen !== null}
        title="Freigabe widerrufen"
        message={
          <>
            Freigabe von <strong>{widerrufen?.kurs_name}</strong> an{' '}
            {widerrufen?.empfaenger_email} widerrufen? Bei „Gemeinsam bearbeiten" verliert die
            Person den Zugriff. Bereits übernommene Kopien bleiben bestehen.
          </>
        }
        confirmLabel="Widerrufen"
        busy={busyId === widerrufen?.id}
        onConfirm={widerrufenBestaetigt}
        onClose={() => setWiderrufen(null)}
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
