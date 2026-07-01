/** Anzeigename eines Trainers: "Vorname Nachname" mit Fallback auf name/email. */
export function trainerAnzeigeName(t: {
  vorname?: string | null
  nachname?: string | null
  name?: string | null
  email?: string | null
}): string {
  const voll = `${t.vorname ?? ''} ${t.nachname ?? ''}`.trim()
  return voll || t.name || t.email || 'Trainer'
}
