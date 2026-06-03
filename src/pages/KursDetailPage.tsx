import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
} from '../components/ui'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '../components/icons'

type Kurs = Tables<'kurs'>
type Themengebiet = Tables<'themengebiet'>

export default function KursDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [kurs, setKurs] = useState<Kurs | null>(null)
  const [themen, setThemen] = useState<Themengebiet[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [neuerName, setNeuerName] = useState('')
  const [busy, setBusy] = useState(false)
  // Umbenennen-Modal + Lösch-Dialog
  const [bearbeiteThema, setBearbeiteThema] = useState<Themengebiet | null>(null)
  const [loeschThema, setLoeschThema] = useState<Themengebiet | null>(null)
  const [loeschBusy, setLoeschBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLaden(true)
      const [{ data: k, error: kErr }, { data: t, error: tErr }] = await Promise.all([
        supabase.from('kurs').select('*').eq('id', id).single(),
        supabase
          .from('themengebiet')
          .select('*')
          .eq('kurs_id', id)
          .order('sortierung', { ascending: true }),
      ])
      if (kErr) setFehler(kErr.message)
      else setKurs(k)
      if (tErr) setFehler(tErr.message)
      else if (t) setThemen(t)
      setLaden(false)
    })()
  }, [id])

  async function themaAnlegen(e: FormEvent) {
    e.preventDefault()
    if (!id || !neuerName.trim()) return
    setBusy(true)
    setFehler(null)
    const naechsteSortierung =
      themen.length > 0 ? Math.max(...themen.map((t) => t.sortierung)) + 1 : 0
    const { data, error } = await supabase
      .from('themengebiet')
      .insert({ kurs_id: id, name: neuerName.trim(), sortierung: naechsteSortierung })
      .select()
      .single()
    if (error) setFehler(error.message)
    else {
      setThemen((alt) => [...alt, data])
      setNeuerName('')
    }
    setBusy(false)
  }

  async function themaUmbenanntSpeichern(thema: Themengebiet, name: string) {
    const sauber = name.trim()
    if (!sauber || sauber === thema.name) {
      setBearbeiteThema(null)
      return
    }
    const { error } = await supabase
      .from('themengebiet')
      .update({ name: sauber })
      .eq('id', thema.id)
    if (error) {
      setFehler(error.message)
    } else {
      setThemen((alt) => alt.map((t) => (t.id === thema.id ? { ...t, name: sauber } : t)))
      setBearbeiteThema(null)
    }
  }

  async function themaLoeschenBestaetigt() {
    if (!loeschThema) return
    setLoeschBusy(true)
    const { error } = await supabase.from('themengebiet').delete().eq('id', loeschThema.id)
    if (error) {
      setFehler(error.message)
    } else {
      setThemen((alt) => alt.filter((t) => t.id !== loeschThema.id))
      setLoeschThema(null)
    }
    setLoeschBusy(false)
  }

  // Zwei benachbarte Themengebiete tauschen und neue sortierung persistieren
  async function verschieben(index: number, richtung: -1 | 1) {
    const ziel = index + richtung
    if (ziel < 0 || ziel >= themen.length) return
    const neu = [...themen]
    ;[neu[index], neu[ziel]] = [neu[ziel], neu[index]]
    // sortierung neu vergeben
    const mitSortierung = neu.map((t, i) => ({ ...t, sortierung: i }))
    setThemen(mitSortierung)
    const updates = await Promise.all(
      [mitSortierung[index], mitSortierung[ziel]].map((t) =>
        supabase.from('themengebiet').update({ sortierung: t.sortierung }).eq('id', t.id),
      ),
    )
    const erstErr = updates.find((u) => u.error)?.error
    if (erstErr) setFehler(erstErr.message)
  }

  if (laden) return <p className="text-ifm-gray">Lädt …</p>
  if (!kurs)
    return (
      <div>
        <ErrorBanner message="Kurs nicht gefunden." />
        <Link to="/kurse" className="mt-4 inline-block text-ifm-blue hover:underline">
          ← Zurück zu den Kursen
        </Link>
      </div>
    )

  return (
    <div>
      <Link to="/kurse" className="text-sm text-ifm-gray hover:underline">
        ← Kurse
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-ifm-blue">{kurs.name}</h1>
      {kurs.beschreibung && <p className="mt-1 text-ifm-gray max-w-2xl">{kurs.beschreibung}</p>}

      <h2 className="mt-8 mb-3 text-lg font-semibold text-ifm-blue">Themengebiete</h2>

      {fehler && (
        <div className="mb-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {themen.length === 0 ? (
        <EmptyState>
          Noch keine Themengebiete. Lege z. B. „Rechtliche Grundlagen" an.
        </EmptyState>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-ifm-lightblue">
            {themen.map((thema, i) => (
              <li key={thema.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-ifm-gray text-sm w-6 text-right">{i + 1}.</span>
                <span className="flex-1 text-ifm-blue">{thema.name}</span>
                <div className="flex items-center gap-1">
                  <IconButton
                    label="Nach oben"
                    disabled={i === 0}
                    onClick={() => verschieben(i, -1)}
                  >
                    <ArrowUpIcon />
                  </IconButton>
                  <IconButton
                    label="Nach unten"
                    disabled={i === themen.length - 1}
                    onClick={() => verschieben(i, 1)}
                  >
                    <ArrowDownIcon />
                  </IconButton>
                  <IconButton label="Umbenennen" onClick={() => setBearbeiteThema(thema)}>
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    variant="danger"
                    label="Löschen"
                    onClick={() => setLoeschThema(thema)}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form onSubmit={themaAnlegen} className="mt-4 flex gap-2 max-w-md">
        <div className="flex-1">
          <TextInput
            value={neuerName}
            onChange={(e) => setNeuerName(e.target.value)}
            placeholder="Neues Themengebiet …"
          />
        </div>
        <IconButton
          type="submit"
          variant="primary"
          label="Themengebiet hinzufügen"
          disabled={busy || !neuerName.trim()}
        >
          <PlusIcon />
        </IconButton>
      </form>

      {bearbeiteThema && (
        <ThemaUmbenennenModal
          thema={bearbeiteThema}
          onClose={() => setBearbeiteThema(null)}
          onSpeichern={(name) => themaUmbenanntSpeichern(bearbeiteThema, name)}
        />
      )}

      <ConfirmDialog
        open={loeschThema !== null}
        title="Themengebiet löschen"
        message={
          <>
            Themengebiet <strong>{loeschThema?.name}</strong> wirklich löschen?
          </>
        }
        busy={loeschBusy}
        onConfirm={themaLoeschenBestaetigt}
        onClose={() => setLoeschThema(null)}
      />
    </div>
  )
}

function ThemaUmbenennenModal({
  thema,
  onClose,
  onSpeichern,
}: {
  thema: Themengebiet
  onClose: () => void
  onSpeichern: (name: string) => void
}) {
  const [name, setName] = useState(thema.name)
  return (
    <Modal open onClose={onClose} title="Themengebiet umbenennen">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSpeichern(name)
        }}
        className="space-y-4"
      >
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            Speichern
          </Button>
        </div>
      </form>
    </Modal>
  )
}
