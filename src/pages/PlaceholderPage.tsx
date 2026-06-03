/**
 * Leere Platzhalter-Seite für die Dashboard-Bereiche.
 * Wird Schritt für Schritt durch die echten Features ersetzt
 * (Konzept Abschnitt 14: Kurse/Fragenpool -> Vorlagen -> Prüfungen -> …).
 */
export default function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ifm-blue">{title}</h1>
      <p className="mt-2 text-ifm-gray max-w-2xl">{description}</p>

      <div className="mt-8 rounded-2xl border-2 border-dashed border-ifm-gray/30 bg-white/60 p-10 text-center text-ifm-gray">
        Hier entsteht „{title}". Noch nichts angelegt.
      </div>
    </div>
  )
}
