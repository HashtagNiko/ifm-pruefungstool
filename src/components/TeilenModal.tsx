import { useState, type FormEvent } from 'react'
import {
  kursTeilen,
  MODUS_BESCHREIBUNG,
  MODUS_LABEL,
  type FreigabeModus,
} from '../lib/sharing'
import { Button, ErrorBanner, Modal, TextInput } from './ui'

const MODI: FreigabeModus[] = ['nur_verwenden', 'gemeinsam', 'kopie']

export default function TeilenModal({
  kursId,
  kursName,
  onClose,
}: {
  kursId: string
  kursName: string
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [modus, setModus] = useState<FreigabeModus>('nur_verwenden')
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function teilen(e: FormEvent) {
    e.preventDefault()
    setFehler(null)
    setHinweis(null)
    setBusy(true)
    try {
      await kursTeilen(kursId, email, modus)
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
    <Modal open onClose={onClose} title={`Kurs teilen: ${kursName}`}>
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
                  name="modus"
                  checked={modus === m}
                  onChange={() => setModus(m)}
                  className="mt-1 accent-ifm-blue"
                />
                <span>
                  <span className="block font-medium text-ifm-blue">{MODUS_LABEL[m]}</span>
                  <span className="block text-xs text-ifm-gray">{MODUS_BESCHREIBUNG[m]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

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
