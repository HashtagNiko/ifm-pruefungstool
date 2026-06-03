import { useState, type ChangeEvent } from 'react'
import {
  importFragen,
  parseExport,
  type ParseErgebnis,
} from '../lib/fragenImport'
import { Button, ErrorBanner, Modal } from './ui'

export default function FragenImportModal({
  kursId,
  onClose,
  onImported,
}: {
  kursId: string
  onClose: () => void
  onImported: (anzahl: number) => void
}) {
  const [ergebnis, setErgebnis] = useState<ParseErgebnis | null>(null)
  const [dateiname, setDateiname] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function dateiGewaehlt(e: ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0]
    if (!datei) return
    setDateiname(datei.name)
    setFehler(null)
    const text = await datei.text()
    setErgebnis(parseExport(text))
  }

  async function importieren() {
    if (!ergebnis?.daten) return
    setBusy(true)
    setFehler(null)
    try {
      const r = await importFragen(kursId, ergebnis.daten.fragen)
      onImported(r.anzahlFragen)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Import fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const themengebiete = ergebnis?.daten
    ? Array.from(new Set(ergebnis.daten.fragen.map((f) => f.themengebiet)))
    : []

  return (
    <Modal open onClose={onClose} title="Fragen importieren">
      <div className="space-y-4">
        <p className="text-sm text-ifm-gray">
          JSON-Export auswählen. Fehlende Themengebiete werden automatisch angelegt; der
          Import hängt die Fragen an den Kurs an (bestehende bleiben erhalten).
        </p>

        <label className="block">
          <span className="block text-sm font-medium text-ifm-blue mb-1">JSON-Datei</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={dateiGewaehlt}
            className="block w-full text-sm text-ifm-blue file:mr-3 file:rounded-lg file:border-0 file:bg-ifm-blue file:px-4 file:py-2 file:text-white file:font-medium hover:file:bg-ifm-blue/90"
          />
        </label>

        {ergebnis && (
          <div className="rounded-lg bg-ifm-lightblue/50 p-4 text-sm space-y-2">
            {dateiname && <div className="text-ifm-gray">Datei: {dateiname}</div>}

            {ergebnis.fehler.length > 0 ? (
              <div className="space-y-1">
                <div className="font-medium text-ifm-red">
                  Import nicht möglich ({ergebnis.fehler.length} Fehler):
                </div>
                <ul className="list-disc pl-5 text-ifm-red max-h-40 overflow-auto">
                  {ergebnis.fehler.slice(0, 20).map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="text-ifm-blue">
                  <strong>{ergebnis.daten?.fragen.length}</strong> Fragen bereit zum Import.
                </div>
                <div className="text-ifm-blue">
                  Themengebiete: {themengebiete.join(', ')}
                </div>
                {ergebnis.warnungen.length > 0 && (
                  <details className="text-ifm-blue">
                    <summary className="cursor-pointer text-ifm-gray">
                      {ergebnis.warnungen.length} Hinweis(e) zum Punkteschema
                    </summary>
                    <ul className="list-disc pl-5 mt-1 max-h-40 overflow-auto">
                      {ergebnis.warnungen.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        )}

        {fehler && <ErrorBanner message={fehler} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={importieren}
            disabled={busy || !ergebnis?.daten}
          >
            {busy ? 'Importiere …' : 'Importieren'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
