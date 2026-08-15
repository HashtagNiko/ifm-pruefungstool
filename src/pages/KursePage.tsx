import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase, aktuelleUserId } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Tables } from '../lib/database.types'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
  Modal,
  TextInput,
  Textarea,
} from '../components/ui'
import { PencilIcon, PlusIcon, ShareIcon, TrashIcon } from '../components/icons'
import TeilenModal from '../components/TeilenModal'
import {
  freigabeAblehnen,
  meineFreigegebenenKurse,
  MODUS_LABEL,
  type KursFreigabeInfo,
} from '../lib/sharing'

type Kurs = Tables<'kurs'>

export default function KursePage() {
  const { user } = useAuth()
  const [kurse, setKurse] = useState<Kurs[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  // Modal-State: null = zu, sonst der zu bearbeitende Kurs (oder leeres Objekt für "neu")
  const [bearbeite, setBearbeite] = useState<Partial<Kurs> | null>(null)
  // Lösch-Dialog
  const [loeschKandidat, setLoeschKandidat] = useState<Kurs | null>(null)
  const [loeschBusy, setLoeschBusy] = useState(false)
  // Sharing
  const [freigabeMap, setFreigabeMap] = useState<Record<string, KursFreigabeInfo>>({})
  const [teilenKurs, setTeilenKurs] = useState<Kurs | null>(null)
  // Geteilten Kurs aus dem eigenen Konto entfernen (Freigabe zurückgeben)
  const [entfernKandidat, setEntfernKandidat] = useState<Kurs | null>(null)
  const [entfernBusy, setEntfernBusy] = useState(false)

  async function laden_() {
    setLaden(true)
    const { data, error } = await supabase
      .from('kurs')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) setFehler(error.message)
    else setKurse(data)
    if (user) setFreigabeMap(await meineFreigegebenenKurse(user.id))
    setLaden(false)
  }

  useEffect(() => {
    laden_()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loeschenBestaetigt() {
    if (!loeschKandidat) return
    setLoeschBusy(true)
    const { error } = await supabase.from('kurs').delete().eq('id', loeschKandidat.id)
    if (error) {
      setFehler(error.message)
    } else {
      setKurse((k) => k.filter((x) => x.id !== loeschKandidat.id))
      setLoeschKandidat(null)
    }
    setLoeschBusy(false)
  }

  /**
   * Geteilten Kurs aus dem eigenen Konto entfernen: die Freigabe geht per
   * `freigabe_ablehnen` auf 'abgelehnt' zurück, womit `darf_kurs_lesen` nicht mehr
   * greift. Der Kurs des Besitzers bleibt unangetastet.
   */
  async function entfernenBestaetigt() {
    if (!entfernKandidat) return
    const info = freigabeMap[entfernKandidat.id]
    if (!info) return
    setEntfernBusy(true)
    setFehler(null)
    try {
      await freigabeAblehnen(info.freigabeId)
      setKurse((k) => k.filter((x) => x.id !== entfernKandidat.id))
      setFreigabeMap((alt) => {
        const neu = { ...alt }
        delete neu[entfernKandidat.id]
        return neu
      })
      setEntfernKandidat(null)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Entfernen fehlgeschlagen.')
    } finally {
      setEntfernBusy(false)
    }
  }

  // Nur eigene + per Kurs-Freigabe geteilte Kurse verwalten. Kurse, die nur über eine
  // geteilte PRÜFUNG lesbar sind (für den Kursnamen), gehören nicht in diese Liste.
  const sichtbareKurse = kurse.filter(
    (k) => k.owner_id === user?.id || freigabeMap[k.id] !== undefined,
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ifm-blue">Kurse</h1>
          <p className="mt-1 text-ifm-gray">
            Deine Kurse und ihre Themengebiete.
          </p>
        </div>
        <span data-tour="neuer-kurs">
          <IconButton variant="primary" label="Neuer Kurs" onClick={() => setBearbeite({})}>
            <PlusIcon />
          </IconButton>
        </span>
      </div>

      {fehler && (
        <div className="mb-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {laden ? (
        <p className="text-ifm-gray">Lädt …</p>
      ) : sichtbareKurse.length === 0 ? (
        <EmptyState>Noch keine Kurse. Lege deinen ersten Kurs an.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sichtbareKurse.map((kurs) => {
            const istBesitzer = kurs.owner_id === user?.id
            const modus = freigabeMap[kurs.id]?.modus
            const darfBearbeiten = istBesitzer || modus === 'gemeinsam'
            return (
              <Card key={kurs.id} className="flex flex-col">
                <Link
                  to={`/kurse/${kurs.id}`}
                  className="text-lg font-semibold text-ifm-blue hover:underline"
                >
                  {kurs.name}
                </Link>
                {!istBesitzer && modus && (
                  <span className="mt-1 inline-block w-fit rounded-full bg-ifm-yellow/25 px-2 py-0.5 text-xs text-ifm-blue">
                    geteilt · {MODUS_LABEL[modus]}
                  </span>
                )}
                {kurs.beschreibung && (
                  <p className="mt-1 text-sm text-ifm-gray line-clamp-3">{kurs.beschreibung}</p>
                )}
                <div className="mt-4 pt-3 border-t border-ifm-lightblue flex justify-end gap-1">
                  {istBesitzer && (
                    <IconButton label="Teilen" onClick={() => setTeilenKurs(kurs)}>
                      <ShareIcon />
                    </IconButton>
                  )}
                  {darfBearbeiten && (
                    <IconButton label="Bearbeiten" onClick={() => setBearbeite(kurs)}>
                      <PencilIcon />
                    </IconButton>
                  )}
                  {istBesitzer ? (
                    <IconButton
                      variant="danger"
                      label="Löschen"
                      onClick={() => setLoeschKandidat(kurs)}
                    >
                      <TrashIcon />
                    </IconButton>
                  ) : (
                    <IconButton
                      variant="danger"
                      label="Aus meinem Konto entfernen"
                      onClick={() => setEntfernKandidat(kurs)}
                    >
                      <TrashIcon />
                    </IconButton>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {bearbeite && (
        <KursModal
          kurs={bearbeite}
          onClose={() => setBearbeite(null)}
          onGespeichert={(gespeichert) => {
            setKurse((alt) => {
              const exists = alt.some((k) => k.id === gespeichert.id)
              return exists
                ? alt.map((k) => (k.id === gespeichert.id ? gespeichert : k))
                : [...alt, gespeichert]
            })
            setBearbeite(null)
          }}
        />
      )}

      <ConfirmDialog
        open={loeschKandidat !== null}
        title="Kurs löschen"
        message={
          <>
            Kurs <strong>{loeschKandidat?.name}</strong> wirklich löschen? Alle
            Themengebiete, Fragen und Vorlagen dieses Kurses werden mitgelöscht.
          </>
        }
        busy={loeschBusy}
        onConfirm={loeschenBestaetigt}
        onClose={() => setLoeschKandidat(null)}
      />

      <ConfirmDialog
        open={entfernKandidat !== null}
        title="Kurs aus meinem Konto entfernen"
        message={
          <>
            <strong>{entfernKandidat?.name}</strong> verschwindet aus deiner Kursliste. Der Kurs
            selbst bleibt beim Besitzer vollständig erhalten – du gibst nur deinen Zugriff zurück
            und kannst jederzeit neu eingeladen werden.
            <br />
            <br />
            {entfernKandidat && freigabeMap[entfernKandidat.id]?.modus === 'gemeinsam'
              ? 'Du verlierst dein Bearbeitungsrecht. Deine bisherigen Änderungen bleiben im Kurs erhalten.'
              : 'Du kannst den Kurs danach nicht mehr für eigene Prüfungen verwenden.'}
          </>
        }
        confirmLabel="Entfernen"
        busy={entfernBusy}
        onConfirm={entfernenBestaetigt}
        onClose={() => setEntfernKandidat(null)}
      />

      {teilenKurs && (
        <TeilenModal
          kursId={teilenKurs.id}
          kursName={teilenKurs.name}
          onClose={() => setTeilenKurs(null)}
        />
      )}
    </div>
  )
}

function KursModal({
  kurs,
  onClose,
  onGespeichert,
}: {
  kurs: Partial<Kurs>
  onClose: () => void
  onGespeichert: (kurs: Kurs) => void
}) {
  const istNeu = !kurs.id
  const [name, setName] = useState(kurs.name ?? '')
  const [beschreibung, setBeschreibung] = useState(kurs.beschreibung ?? '')
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function speichern(e: FormEvent) {
    e.preventDefault()
    setFehler(null)
    setBusy(true)
    try {
      if (istNeu) {
        const owner_id = await aktuelleUserId()
        const { data, error } = await supabase
          .from('kurs')
          .insert({ name, beschreibung: beschreibung || null, owner_id })
          .select()
          .single()
        if (error) throw error
        onGespeichert(data)
      } else {
        const { data, error } = await supabase
          .from('kurs')
          .update({ name, beschreibung: beschreibung || null })
          .eq('id', kurs.id!)
          .select()
          .single()
        if (error) throw error
        onGespeichert(data)
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Speichern fehlgeschlagen.'
      setFehler(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={istNeu ? 'Neuer Kurs' : 'Kurs bearbeiten'}>
      <form onSubmit={speichern} className="space-y-4">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <Textarea
          label="Beschreibung (optional)"
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          rows={3}
        />
        {fehler && <ErrorBanner message={fehler} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Speichern …' : 'Speichern'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
