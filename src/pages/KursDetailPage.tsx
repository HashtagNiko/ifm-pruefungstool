import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { Button, Card, EmptyState, ErrorBanner, TextInput } from '../components/ui'

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

  async function themaUmbenennen(thema: Themengebiet) {
    const name = prompt('Neuer Name für das Themengebiet:', thema.name)
    if (name == null || !name.trim() || name === thema.name) return
    const { error } = await supabase
      .from('themengebiet')
      .update({ name: name.trim() })
      .eq('id', thema.id)
    if (error) setFehler(error.message)
    else
      setThemen((alt) =>
        alt.map((t) => (t.id === thema.id ? { ...t, name: name.trim() } : t)),
      )
  }

  async function themaLoeschen(thema: Themengebiet) {
    if (!confirm(`Themengebiet „${thema.name}" wirklich löschen?`)) return
    const { error } = await supabase.from('themengebiet').delete().eq('id', thema.id)
    if (error) setFehler(error.message)
    else setThemen((alt) => alt.filter((t) => t.id !== thema.id))
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
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    disabled={i === 0}
                    onClick={() => verschieben(i, -1)}
                    aria-label="Nach oben"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    disabled={i === themen.length - 1}
                    onClick={() => verschieben(i, 1)}
                    aria-label="Nach unten"
                  >
                    ↓
                  </Button>
                  <Button variant="ghost" onClick={() => themaUmbenennen(thema)}>
                    Umbenennen
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-ifm-red"
                    onClick={() => themaLoeschen(thema)}
                  >
                    Löschen
                  </Button>
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
        <Button type="submit" disabled={busy || !neuerName.trim()}>
          Hinzufügen
        </Button>
      </form>
    </div>
  )
}
