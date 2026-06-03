import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Tables } from '../lib/database.types'
import { Button, Card, EmptyState, ErrorBanner, Modal, TextInput, Textarea } from '../components/ui'

type Kurs = Tables<'kurs'>

export default function KursePage() {
  const { user } = useAuth()
  const [kurse, setKurse] = useState<Kurs[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  // Modal-State: null = zu, sonst der zu bearbeitende Kurs (oder leeres Objekt für "neu")
  const [bearbeite, setBearbeite] = useState<Partial<Kurs> | null>(null)

  async function laden_() {
    setLaden(true)
    const { data, error } = await supabase
      .from('kurs')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) setFehler(error.message)
    else setKurse(data)
    setLaden(false)
  }

  useEffect(() => {
    laden_()
  }, [])

  async function loeschen(kurs: Kurs) {
    if (
      !confirm(
        `Kurs „${kurs.name}" wirklich löschen? Alle Themengebiete, Fragen und Vorlagen dieses Kurses werden mitgelöscht.`,
      )
    )
      return
    const { error } = await supabase.from('kurs').delete().eq('id', kurs.id)
    if (error) setFehler(error.message)
    else setKurse((k) => k.filter((x) => x.id !== kurs.id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ifm-blue">Kurse</h1>
          <p className="mt-1 text-ifm-gray">
            Deine Kurse und ihre Themengebiete.
          </p>
        </div>
        <Button onClick={() => setBearbeite({})}>+ Neuer Kurs</Button>
      </div>

      {fehler && (
        <div className="mb-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {laden ? (
        <p className="text-ifm-gray">Lädt …</p>
      ) : kurse.length === 0 ? (
        <EmptyState>Noch keine Kurse. Lege deinen ersten Kurs an.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kurse.map((kurs) => (
            <Card key={kurs.id} className="flex flex-col">
              <Link
                to={`/kurse/${kurs.id}`}
                className="text-lg font-semibold text-ifm-blue hover:underline"
              >
                {kurs.name}
              </Link>
              {kurs.beschreibung && (
                <p className="mt-1 text-sm text-ifm-gray line-clamp-3">{kurs.beschreibung}</p>
              )}
              <div className="mt-4 pt-3 border-t border-ifm-lightblue flex gap-2">
                <Button variant="ghost" onClick={() => setBearbeite(kurs)}>
                  Bearbeiten
                </Button>
                <Button variant="ghost" className="text-ifm-red" onClick={() => loeschen(kurs)}>
                  Löschen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {bearbeite && user && (
        <KursModal
          kurs={bearbeite}
          ownerId={user.id}
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
    </div>
  )
}

function KursModal({
  kurs,
  ownerId,
  onClose,
  onGespeichert,
}: {
  kurs: Partial<Kurs>
  ownerId: string
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
        const { data, error } = await supabase
          .from('kurs')
          .insert({ name, beschreibung: beschreibung || null, owner_id: ownerId })
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
      setFehler(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
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
