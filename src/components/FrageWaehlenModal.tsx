import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { setzeFrageInSlot } from '../lib/pruefungErstellen'
import { Button, ErrorBanner, Modal } from './ui'
import FrageModal from './FrageModal'

interface PoolFrage {
  id: string
  text: string
  typ: string
}

/**
 * Wählt für einen Snapshot-Slot gezielt eine bestimmte Frage aus dem Pool des
 * Themengebiets (statt zufällig zu würfeln). Neue Fragen lassen sich direkt anlegen.
 */
export default function FrageWaehlenModal({
  pruefungFrageId,
  kursId,
  themengebietId,
  themengebietName,
  aktuelleFrageId,
  belegteFrageIds,
  onClose,
  onGewaehlt,
}: {
  pruefungFrageId: string
  kursId: string
  themengebietId: string
  themengebietName: string
  aktuelleFrageId: string
  /** frage_ids, die in anderen Slots derselben Prüfung schon vergeben sind */
  belegteFrageIds: string[]
  onClose: () => void
  onGewaehlt: () => void
}) {
  const [pool, setPool] = useState<PoolFrage[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [neuOffen, setNeuOffen] = useState(false)

  const ladePool = useCallback(async () => {
    setLaden(true)
    const { data, error } = await supabase
      .from('frage')
      .select('id, text, typ')
      .eq('kurs_id', kursId)
      .eq('themengebiet_id', themengebietId)
      .order('erstellt_am', { ascending: true })
    if (error) setFehler(error.message)
    else setPool(data ?? [])
    setLaden(false)
  }, [kursId, themengebietId])

  useEffect(() => {
    ladePool()
  }, [ladePool])

  const belegt = new Set(belegteFrageIds.filter((fid) => fid !== aktuelleFrageId))

  async function waehlen(frageId: string) {
    if (frageId === aktuelleFrageId) {
      onClose()
      return
    }
    setBusyId(frageId)
    setFehler(null)
    try {
      await setzeFrageInSlot(pruefungFrageId, frageId)
      onGewaehlt()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Auswahl fehlgeschlagen.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Frage wählen – ${themengebietName}`} size="lg">
      <p className="text-sm text-ifm-gray mb-3">
        Wähle eine Frage für diesen Slot. Bereits in der Prüfung vergebene Fragen sind gesperrt.
      </p>

      {fehler && (
        <div className="mb-3">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {laden ? (
        <p className="text-ifm-gray">Lädt …</p>
      ) : pool.length === 0 ? (
        <p className="text-sm text-ifm-gray">Keine Fragen in diesem Themengebiet.</p>
      ) : (
        <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
          {pool.map((f) => {
            const istAktuell = f.id === aktuelleFrageId
            const istBelegt = belegt.has(f.id)
            const gesperrt = istBelegt || busyId !== null
            return (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={gesperrt}
                  onClick={() => waehlen(f.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    istAktuell
                      ? 'border-ifm-blue bg-ifm-lightblue/40'
                      : istBelegt
                        ? 'border-ifm-gray/20 opacity-50 cursor-not-allowed'
                        : 'border-ifm-gray/30 hover:bg-ifm-lightblue/30'
                  }`}
                >
                  <span className="flex-1 text-sm text-ifm-blue">{f.text}</span>
                  <span className="shrink-0 flex items-center gap-2 text-xs">
                    <span className="text-ifm-gray">
                      {f.typ === 'multi' ? 'Multi' : 'Single'}
                    </span>
                    {istAktuell && (
                      <span className="rounded-full bg-ifm-blue px-2 py-0.5 font-medium text-white">
                        aktuell
                      </span>
                    )}
                    {istBelegt && (
                      <span className="rounded-full bg-ifm-gray/20 px-2 py-0.5 text-ifm-gray">
                        schon in Prüfung
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 flex justify-between gap-2">
        <Button type="button" variant="secondary" onClick={() => setNeuOffen(true)}>
          + Neue Frage anlegen
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Schließen
        </Button>
      </div>

      {neuOffen && (
        <FrageModal
          kursId={kursId}
          themengebiete={[{ id: themengebietId, name: themengebietName }]}
          frage={null}
          onClose={() => setNeuOffen(false)}
          onSaved={() => {
            setNeuOffen(false)
            ladePool()
          }}
        />
      )}
    </Modal>
  )
}
