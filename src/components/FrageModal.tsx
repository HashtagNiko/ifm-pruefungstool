import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { Button, ErrorBanner, IconButton, Modal, TextInput, Textarea } from './ui'
import { PlusIcon, TrashIcon } from './icons'

type Themengebiet = Pick<Tables<'themengebiet'>, 'id' | 'name'>
type Frage = Tables<'frage'>
type Antwortoption = Tables<'antwortoption'>

export type FrageMitOptionen = Frage & { antwortoption: Antwortoption[] }

interface OptionEntwurf {
  text: string
  ist_richtig: boolean
}

export default function FrageModal({
  kursId,
  themengebiete,
  frage,
  vorauswahlThemengebietId,
  onClose,
  onSaved,
}: {
  kursId: string
  themengebiete: Themengebiet[]
  frage: FrageMitOptionen | null
  /** Vorauswahl für neue Fragen (z. B. beim Anlegen in einem bestimmten Themengebiet) */
  vorauswahlThemengebietId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const istNeu = !frage
  const [text, setText] = useState(frage?.text ?? '')
  const [typ, setTyp] = useState<'single' | 'multi'>(
    (frage?.typ as 'single' | 'multi') ?? 'single',
  )
  const [themengebietId, setThemengebietId] = useState(
    frage?.themengebiet_id ?? vorauswahlThemengebietId ?? '',
  )
  const [optionen, setOptionen] = useState<OptionEntwurf[]>(
    frage
      ? [...frage.antwortoption]
          .sort((a, b) => a.sortierung - b.sortierung)
          .map((o) => ({ text: o.text, ist_richtig: o.ist_richtig }))
      : [
          { text: '', ist_richtig: false },
          { text: '', ist_richtig: false },
          { text: '', ist_richtig: false },
          { text: '', ist_richtig: false },
        ],
  )
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const anzahlRichtig = optionen.filter((o) => o.ist_richtig).length

  function setOption(index: number, patch: Partial<OptionEntwurf>) {
    setOptionen((alt) => alt.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  function richtigUmschalten(index: number) {
    setOptionen((alt) =>
      alt.map((o, i) => {
        if (i === index) return { ...o, ist_richtig: !o.ist_richtig }
        // Bei single nur eine richtige Antwort zulassen
        if (typ === 'single') return { ...o, ist_richtig: false }
        return o
      }),
    )
  }

  function typWechseln(neu: 'single' | 'multi') {
    setTyp(neu)
    if (neu === 'single') {
      // höchstens eine richtige behalten
      let gesehen = false
      setOptionen((alt) =>
        alt.map((o) => {
          if (o.ist_richtig && !gesehen) {
            gesehen = true
            return o
          }
          return { ...o, ist_richtig: false }
        }),
      )
    }
  }

  function validieren(): string | null {
    if (!text.trim()) return 'Bitte einen Fragetext eingeben.'
    if (!themengebietId) return 'Bitte ein Themengebiet wählen.'
    const gefuellte = optionen.filter((o) => o.text.trim())
    if (gefuellte.length < 2) return 'Mindestens zwei ausgefüllte Antwortoptionen nötig.'
    if (optionen.some((o) => o.ist_richtig && !o.text.trim()))
      return 'Eine als richtig markierte Option hat keinen Text.'
    const richtig = gefuellte.filter((o) => o.ist_richtig).length
    if (typ === 'single' && richtig !== 1)
      return 'Bei Single-Choice muss genau eine Antwort richtig sein.'
    if (typ === 'multi' && richtig !== 2)
      return 'Bei Multi-Choice müssen genau zwei Antworten richtig sein.'
    return null
  }

  async function speichern(e: FormEvent) {
    e.preventDefault()
    const v = validieren()
    if (v) {
      setFehler(v)
      return
    }
    setFehler(null)
    setBusy(true)
    const gefuellte = optionen.filter((o) => o.text.trim())
    try {
      let frageId = frage?.id
      if (istNeu) {
        const { data, error } = await supabase
          .from('frage')
          .insert({ kurs_id: kursId, themengebiet_id: themengebietId, text: text.trim(), typ })
          .select('id')
          .single()
        if (error) throw error
        frageId = data.id
      } else {
        const { error } = await supabase
          .from('frage')
          .update({ themengebiet_id: themengebietId, text: text.trim(), typ })
          .eq('id', frageId!)
        if (error) throw error
        // Optionen neu setzen (delete + insert) — einfach und robust in dieser Phase
        const { error: delErr } = await supabase
          .from('antwortoption')
          .delete()
          .eq('frage_id', frageId!)
        if (delErr) throw delErr
      }

      const optionRows = gefuellte.map((o, idx) => ({
        frage_id: frageId!,
        text: o.text.trim(),
        ist_richtig: o.ist_richtig,
        sortierung: idx,
      }))
      const { error: optErr } = await supabase.from('antwortoption').insert(optionRows)
      if (optErr) throw optErr

      onSaved()
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
    <Modal open onClose={onClose} title={istNeu ? 'Neue Frage' : 'Frage bearbeiten'}>
      <form onSubmit={speichern} className="space-y-4">
        <Textarea
          label="Fragetext"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          required
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-ifm-blue mb-1">Typ</span>
            <select
              value={typ}
              onChange={(e) => typWechseln(e.target.value as 'single' | 'multi')}
              className="w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue focus:ring-2 focus:ring-ifm-blue/20"
            >
              <option value="single">Single-Choice (1 richtig, max 1 Punkt)</option>
              <option value="multi">Multi-Choice (2 richtig, max 2 Punkte)</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ifm-blue mb-1">Themengebiet</span>
            <select
              value={themengebietId}
              onChange={(e) => setThemengebietId(e.target.value)}
              className="w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue focus:ring-2 focus:ring-ifm-blue/20"
              required
            >
              <option value="">– wählen –</option>
              {themengebiete.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-ifm-blue">
              Antwortoptionen{' '}
              <span
                className={
                  (typ === 'single' && anzahlRichtig === 1) ||
                  (typ === 'multi' && anzahlRichtig === 2)
                    ? 'text-ifm-green'
                    : 'text-ifm-gray'
                }
              >
                ({anzahlRichtig} richtig {typ === 'single' ? '/ 1' : '/ 2'})
              </span>
            </span>
          </div>
          <div className="space-y-2">
            {optionen.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <label
                  className="flex items-center gap-2 shrink-0"
                  title={o.ist_richtig ? 'Richtig' : 'Als richtig markieren'}
                >
                  <input
                    type={typ === 'single' ? 'radio' : 'checkbox'}
                    name="richtig"
                    checked={o.ist_richtig}
                    onChange={() => richtigUmschalten(i)}
                    className="h-4 w-4 accent-ifm-green"
                  />
                </label>
                <TextInput
                  value={o.text}
                  onChange={(e) => setOption(i, { text: e.target.value })}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1"
                />
                <IconButton
                  type="button"
                  variant="danger"
                  label="Option entfernen"
                  disabled={optionen.length <= 2}
                  onClick={() => setOptionen((alt) => alt.filter((_, idx) => idx !== i))}
                >
                  <TrashIcon />
                </IconButton>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOptionen((alt) => [...alt, { text: '', ist_richtig: false }])}
            className="mt-2 inline-flex items-center gap-1 text-sm text-ifm-blue hover:underline"
          >
            <PlusIcon className="h-4 w-4" /> Option hinzufügen
          </button>
        </div>

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
