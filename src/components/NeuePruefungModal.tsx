import { useState, type FormEvent } from 'react'
import { erstellePruefung } from '../lib/pruefungErstellen'
import { Button, ErrorBanner, Modal } from './ui'

export interface VorlageOption {
  id: string
  name: string
  kurs_id: string
  kursName: string
}

const LATE_JOIN_OPTIONEN = [
  { wert: 'zeit_reduziert', label: 'Restzeit (Späteinsteiger bekommt nur verbleibende Zeit)' },
  { wert: 'volle_zeit', label: 'Volle Zeit ab Einstieg' },
  { wert: 'gesperrt', label: 'Gesperrt (kein Einstieg nach Start)' },
] as const

export default function NeuePruefungModal({
  vorlagen,
  ownerId,
  onClose,
  onCreated,
}: {
  vorlagen: VorlageOption[]
  ownerId: string
  onClose: () => void
  onCreated: (pruefungId: string) => void
}) {
  const [vorlageId, setVorlageId] = useState(vorlagen[0]?.id ?? '')
  const [datum, setDatum] = useState('')
  const [lateJoin, setLateJoin] =
    useState<(typeof LATE_JOIN_OPTIONEN)[number]['wert']>('zeit_reduziert')
  const [uebungsmodus, setUebungsmodus] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function anlegen(e: FormEvent) {
    e.preventDefault()
    const vorlage = vorlagen.find((v) => v.id === vorlageId)
    if (!vorlage) {
      setFehler('Bitte eine Vorlage wählen.')
      return
    }
    setFehler(null)
    setBusy(true)
    try {
      const pruefung = await erstellePruefung({
        vorlageId: vorlage.id,
        kursId: vorlage.kurs_id,
        ownerId,
        datum: datum || null,
        lateJoinModus: lateJoin,
        uebungsmodus,
      })
      onCreated(pruefung.id)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Erstellen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Neue Prüfung">
      <form onSubmit={anlegen} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-ifm-blue mb-1">Vorlage</span>
          <select
            value={vorlageId}
            onChange={(e) => setVorlageId(e.target.value)}
            className="w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue"
            required
          >
            {vorlagen.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.kursName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-ifm-blue mb-1">
            Datum (optional)
          </span>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue"
          />
        </label>

        {!uebungsmodus && (
          <label className="block">
            <span className="block text-sm font-medium text-ifm-blue mb-1">
              Späteinsteiger-Modus
            </span>
            <select
              value={lateJoin}
              onChange={(e) => setLateJoin(e.target.value as typeof lateJoin)}
              className="w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue"
            >
              {LATE_JOIN_OPTIONEN.map((o) => (
                <option key={o.wert} value={o.wert}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex gap-2 rounded-lg border border-ifm-gray/30 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={uebungsmodus}
            onChange={(e) => setUebungsmodus(e.target.checked)}
            className="mt-1 accent-ifm-blue"
          />
          <span>
            <span className="block font-medium text-ifm-blue">
              Als Übungs-/Demo-Prüfung
            </span>
            <span className="block text-xs text-ifm-gray">
              Dauerhaft offen, ohne Trainer-Start. Teilnehmer geben ihren Namen ein, warten kurz
              und können die Prüfung beliebig oft wiederholen (Timer läuft je Versuch). Ideal zum
              Testen.
            </span>
          </span>
        </label>

        <p className="text-sm text-ifm-gray">
          Beim Anlegen werden die Fragen zufällig aus dem Pool gezogen und als Snapshot
          eingefroren.
          {!uebungsmodus &&
            ' Im Entwurf kannst du danach noch einzelne Fragen tauschen oder neu würfeln.'}
        </p>

        {fehler && <ErrorBanner message={fehler} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={busy || vorlagen.length === 0}>
            {busy ? 'Erstelle …' : 'Prüfung erstellen'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
