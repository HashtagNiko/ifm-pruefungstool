import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import {
  pruefungTeilen,
  PRUEFUNG_MODUS_BESCHREIBUNG,
  PRUEFUNG_MODUS_LABEL,
  type PruefungFreigabeModus,
} from '../lib/sharing'
import { Button, ErrorBanner, Modal, TextInput } from './ui'

const MODI: PruefungFreigabeModus[] = ['eingeschraenkt', 'korrektur', 'kopie']

type Themengebiet = { id: string; name: string }

export default function PruefungTeilenModal({
  pruefungId,
  pruefungName,
  onClose,
}: {
  pruefungId: string
  pruefungName: string
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [modus, setModus] = useState<PruefungFreigabeModus>('eingeschraenkt')
  const [themengebiete, setThemengebiete] = useState<Themengebiet[]>([])
  const [freigegeben, setFreigegeben] = useState<Set<string>>(new Set())
  const [empfaengerLeitet, setEmpfaengerLeitet] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Themengebiete der Prüfung aus dem Snapshot laden (für die Freigabe-Auswahl)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('pruefung_frage')
        .select('themengebiet_id, sortierung, themengebiet(name)')
        .eq('pruefung_id', pruefungId)
        .order('sortierung', { ascending: true })
        .returns<
          { themengebiet_id: string | null; sortierung: number; themengebiet: { name: string } | null }[]
        >()
      const gesehen = new Map<string, string>()
      for (const r of data ?? []) {
        if (r.themengebiet_id && !gesehen.has(r.themengebiet_id)) {
          gesehen.set(r.themengebiet_id, r.themengebiet?.name ?? 'Themengebiet')
        }
      }
      const liste = [...gesehen].map(([id, name]) => ({ id, name }))
      setThemengebiete(liste)
      setFreigegeben(new Set(liste.map((t) => t.id))) // Standard: alle freigegeben
    })()
  }, [pruefungId])

  function themengebietUmschalten(id: string) {
    setFreigegeben((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })
  }

  async function teilen(e: FormEvent) {
    e.preventDefault()
    setFehler(null)
    setHinweis(null)
    setBusy(true)
    try {
      await pruefungTeilen(pruefungId, email, modus, [...freigegeben], empfaengerLeitet)
      setHinweis(
        `Eingeladen: ${email.trim()}. Die Person sieht die Einladung unter „Geteilt mit mir", ` +
          'sobald sie eingeloggt ist.',
      )
      setEmail('')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Teilen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Prüfung teilen: ${pruefungName}`}>
      <form onSubmit={teilen} className="space-y-4">
        <TextInput
          label="E-Mail des Trainers"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="trainer@beispiel.de"
          required
          autoFocus
        />

        <div>
          <span className="block text-sm font-medium text-ifm-blue mb-1">Modus</span>
          <div className="space-y-2">
            {MODI.map((m) => (
              <label
                key={m}
                className={`flex gap-2 rounded-lg border p-3 cursor-pointer ${
                  modus === m ? 'border-ifm-blue bg-ifm-lightblue/40' : 'border-ifm-gray/30'
                }`}
              >
                <input
                  type="radio"
                  name="pmodus"
                  checked={modus === m}
                  onChange={() => setModus(m)}
                  className="mt-1 accent-ifm-blue"
                />
                <span>
                  <span className="block font-medium text-ifm-blue">{PRUEFUNG_MODUS_LABEL[m]}</span>
                  <span className="block text-xs text-ifm-gray">
                    {PRUEFUNG_MODUS_BESCHREIBUNG[m]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {modus !== 'kopie' && (
          <div>
            <span className="block text-sm font-medium text-ifm-blue mb-1">
              {modus === 'korrektur' ? 'Zu korrigierende Themengebiete' : 'Bearbeitbare Themengebiete'}
            </span>
            <p className="mb-2 text-xs text-ifm-gray">
              {modus === 'korrektur'
                ? 'Der eingeladene Trainer darf in den ausgewählten Themengebieten Feedback geben und sie als korrigiert markieren.'
                : 'Nur in den ausgewählten Themengebieten darf der Trainer Fragen tauschen/neu würfeln. Alle anderen Fragen bleiben fixiert.'}
            </p>
            {themengebiete.length === 0 ? (
              <p className="text-xs text-ifm-gray">Keine Themengebiete im Snapshot.</p>
            ) : (
              <div className="space-y-1">
                {themengebiete.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 rounded-lg border border-ifm-gray/30 px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={freigegeben.has(t.id)}
                      onChange={() => themengebietUmschalten(t.id)}
                      className="accent-ifm-blue"
                    />
                    <span className="text-sm text-ifm-blue">{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {modus === 'korrektur' && (
          <div>
            <span className="block text-sm font-medium text-ifm-blue mb-1">
              Wer leitet die Prüfung?
            </span>
            <label className="flex items-start gap-2 rounded-lg border border-ifm-gray/30 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={empfaengerLeitet}
                onChange={(e) => setEmpfaengerLeitet(e.target.checked)}
                className="mt-0.5 accent-ifm-blue"
              />
              <span>
                <span className="block text-sm text-ifm-blue">
                  Der eingeladene Trainer leitet die Prüfung (öffnet die Lobby, startet/beendet).
                </span>
                <span className="block text-xs text-ifm-gray">
                  Ohne Haken leitest du die Prüfung. Du behältst die Kontrolle in jedem Fall.
                </span>
              </span>
            </label>
          </div>
        )}

        {fehler && <ErrorBanner message={fehler} />}
        {hinweis && (
          <p className="text-sm text-ifm-green rounded-lg bg-ifm-green/10 p-3">{hinweis}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Schließen
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Teilen …' : 'Teilen'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
