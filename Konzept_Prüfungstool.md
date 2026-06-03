# Konzept — IFM-Prüfungstool

Stand: 2026-06-03
Autoren: Niko + Claude

Dieses Dokument beschreibt das geplante Online-Prüfungstool für die Kurse von Niko (vorerst „Zertifizierter WEG-Verwalter" und „Haus- und Grundstücksverwaltung"). Es dient als Bauvorlage für die Umsetzung.

---

## 1. Zielsetzung

Ein leichtgewichtiges Web-Tool, mit dem Niko (und optional Co-Trainer) selbst Prüfungen erstellen, durchführen und auswerten kann. Schwerpunkt: faire Teilpunkte-Vergabe bei Multiple-Choice-Fragen, Echtzeit-Start, sauberer PDF-Export im IFM-Design. Ersatz für Google Forms, das bei Teilpunkten an seine Grenzen stößt.

---

## 2. Tech-Stack

| Komponente | Technologie | Begründung |
|---|---|---|
| Frontend | Statische HTML/JS-App auf **GitHub Pages** (oder Cloudflare Pages) | Kostenlos, einfach zu deployen, kein Server-Betrieb |
| Backend / DB | **Supabase** (Postgres + Auth + Realtime) Free-Tier | Echtzeit-Start, Auth, sichere Server-seitige Auswertung |
| PDF-Generierung | Im Browser via `pdfmake` oder `jsPDF` (clientseitig im Trainer-Dashboard) | Kein Server nötig, IFM-Design pixelgenau steuerbar |
| Hosting-Kosten | 0 € | Beide Tiers reichen für Niko-Volumen locker |

Datenfluss: Teilnehmer öffnet Link → JS-Frontend lädt Prüfung aus Supabase → Antworten werden live in Supabase gespeichert → bei Abgabe rechnet eine Supabase-Edge-Function die Punkte → Trainer sieht Abgaben im Dashboard und generiert PDFs lokal im Browser.

---

## 3. Nutzerrollen

**Trainer.** Eigenes Konto (E-Mail + Passwort über Supabase Auth). Legt Kurse, Fragenpools und Prüfungen an. Startet Prüfungssitzungen. Sieht Abgaben, vergibt Feedback, exportiert PDFs.

**Teilnehmer.** Kein Konto. Öffnet einen Prüfungs-Link, gibt seinen Namen ein (Pflichtfeld), wartet im Lobby-Bereich, schreibt die Prüfung. Nach Abgabe sieht er nur sein Gesamtergebnis.

---

## 4. Datenmodell (vereinfacht)

```
trainer
  id, email, name, created_at

kurs
  id, owner_id (trainer), name, beschreibung, created_at

themengebiet
  id, kurs_id, name, sortierung
  -- z.B. „Rechtliche Grundlagen" für WEG-Kurs

frage
  id, kurs_id, themengebiet_id, text, typ ('single' | 'multi'), erstellt_am
  -- typ=single → 1 richtige Antwort, 1 Punkt max
  -- typ=multi  → 2 richtige Antworten, 2 Punkte max

antwortoption
  id, frage_id, text, ist_richtig, sortierung

prüfungsvorlage
  id, kurs_id, name, dauer_minuten, bestehensschwelle_prozent,
  bestehensschwelle_pro_themengebiet_prozent (optional)

vorlage_themengebiet
  id, vorlage_id, themengebiet_id, anzahl_fragen, punkte_gesamt
  -- WEG-Vorlage: 4 Zeilen, je Themengebiet Frageanzahl + Punktegewicht

prüfung
  id, vorlage_id, datum, status ('entwurf'|'lobby'|'läuft'|'beendet'),
  start_zeit (nullable), end_zeit (nullable),
  late_join_modus ('zeit_reduziert'|'volle_zeit'|'gesperrt'),
  geteilt_an (Liste Trainer-IDs), sharing_modus

prüfung_frage
  id, prüfung_id, frage_id, sortierung
  -- Fragen werden bei Prüfungsstart fixiert (snapshot)

teilnehmer
  id, prüfung_id, name, gestartet_am, abgegeben_am,
  punkte_gesamt, punkte_max, prozent,
  anonymisiert_am (für 7-Tage-Regel)

antwort
  id, teilnehmer_id, prüfung_frage_id,
  ausgewählte_optionen (Array), unsicher_markiert,
  zuletzt_geändert
  -- Auto-Save schreibt hier in Echtzeit

feedback
  id, teilnehmer_id, ebene ('frage'|'themengebiet'|'gesamt'),
  bezug_id, text
```

Sensible Felder (Name, Antworten) sind durch Row-Level Security so geschützt, dass Teilnehmer nur ihre eigenen Antworten sehen, Trainer nur Daten ihrer Prüfungen.

---

## 5. Workflow Trainer

### 5.1 Setup
1. Trainer registriert sich (E-Mail bestätigen).
2. Legt Kurs an, z. B. „Zertifizierter WEG-Verwalter".
3. Definiert Themengebiete für den Kurs.
4. Pflegt nach und nach den Fragenpool: Frage eintippen, Typ wählen, Antwortoptionen mit Häkchen für richtig/falsch markieren, Themengebiet zuordnen.

### 5.2 Prüfungsvorlage anlegen (einmalig pro Prüfungstyp)
Beispiel WEG:
- Name: „WEG-IHK-Standard"
- Dauer: 90 Minuten
- Bestehensschwelle gesamt: 50 %
- Bestehensschwelle je Themengebiet: 50 %
- Themengebiete: 4 Zeilen mit jeweils Frageanzahl und Punktegewicht
  - Grundlagen Immobilienverwaltung: 12 Fragen, 18 Punkte
  - Rechtliche Grundlagen: 15 Fragen, 25 Punkte
  - Kaufmännische Grundlagen: 13 Fragen, 22 Punkte
  - Technische Grundlagen: 10 Fragen, 15 Punkte
  - (Niko bestimmt die exakten Werte; Tool prüft Konsistenz mit Frageanzahl 50.)

### 5.3 Neue Prüfung erstellen
1. „Neue Prüfung aus Vorlage WEG-IHK-Standard"
2. Datum eintragen, Late-Joiner-Modus wählen (zeit_reduziert / volle_zeit / gesperrt)
3. Tool zieht aus Pool zufällig die definierte Anzahl Fragen je Themengebiet und friert sie als Snapshot ein.
4. Tool generiert eindeutigen Prüfungs-Link, z. B. `https://prüfungstool.app/p/abc123`.
5. Status: `entwurf`. Trainer kann den Snapshot noch einmal anschauen, einzelne Fragen austauschen lassen, oder die ganze Auswahl neu würfeln.

### 5.4 Prüfung durchführen
1. Trainer klickt „Lobby öffnen" → Status `lobby`. Teilnehmer können beitreten.
2. Trainer sieht Live-Liste der Wartenden mit Namen.
3. Trainer klickt „Prüfung starten" → Status `läuft`. Alle Teilnehmer bekommen synchron die erste Frage. Timer läuft.
4. Trainer-Dashboard zeigt live, wer abgegeben hat.
5. Wenn alle abgegeben haben oder Timer abgelaufen ist → Status `beendet`.

### 5.5 Auswertung
1. Im Dashboard pro Teilnehmer: Gesamtpunkte, Prozent, Status „bestanden/nicht bestanden" (entscheidet sich aus den beiden Schwellen).
2. Klick auf Teilnehmer öffnet Detailansicht: alle Fragen, gegebene Antworten, richtige Antworten, Punkte je Frage.
3. Trainer trägt optional Feedback ein, auf drei Ebenen: pro Frage, pro Themengebiet, gesamt.
4. „PDF generieren" produziert ein IFM-PDF für diesen Teilnehmer.
5. „ZIP-Export" packt PDFs aller Teilnehmer in eine ZIP.

---

## 6. Workflow Teilnehmer

1. Teilnehmer öffnet den Link.
2. Eingabemaske: Name (Pflichtfeld). Kurzer Hinweistext: „Bitte gib deinen vollständigen Namen ein. Mit Klick auf ‚Beitreten' kommst du in den Wartebereich."
3. Lobby: „Die Prüfung beginnt, sobald der Trainer startet. Bitte das Fenster geöffnet lassen."
4. Trainer startet → Frage 1 erscheint. Timer oben sichtbar.
5. Pro Frage: Frage und Antwortoptionen (Antwortreihenfolge zufällig pro Teilnehmer). Bei Typ `single` Radio-Buttons, bei Typ `multi` Checkboxen (es können beliebig viele angekreuzt werden — die Punkteregel ist transparent dokumentiert, siehe Abschnitt 7).
6. „Unsicher"-Schalter pro Frage, eigene Übersicht „Fragen markiert als unsicher".
7. Navigation: „Vorherige" / „Nächste" / Übersichtsleiste mit allen Fragen, farbig markiert (beantwortet / leer / unsicher).
8. Antworten werden bei jeder Änderung automatisch in Supabase gespeichert. Bei Reload sind alle Antworten wieder da.
9. Bei 5 Minuten Restzeit: dezente Erinnerung („Noch 5 Minuten").
10. „Abgeben"-Button: Warnt, wenn unbeantwortete oder als „unsicher" markierte Fragen vorhanden sind. Zweite Bestätigung „Möchtest du die Prüfung wirklich abgeben?".
11. Bei Timer-Ende: automatische Abgabe mit aktuellem Stand.
12. Nach Abgabe: Ergebnisseite mit Gesamtpunkten, Maximalpunkten und Prozent. **Keine Detailansicht.** Hinweis: „Dein Trainer schickt dir eine ausführliche Auswertung als PDF."
13. Nach Schließen des Browsers ist der Link für diesen Teilnehmer entwertet.

### Late-Joiner-Verhalten (Modus pro Prüfung wählbar)
- `zeit_reduziert`: Späteinsteiger bekommt nur die Restzeit, die zum Zeitpunkt seines Einstiegs noch übrig ist.
- `volle_zeit`: Bekommt die volle Prüfungsdauer ab seinem Start (nur sinnvoll, wenn man Cheating-Risiko akzeptiert).
- `gesperrt`: Wer nach Prüfungsbeginn kommt, sieht eine Meldung „Die Prüfung läuft bereits. Bitte wende dich an deinen Trainer für einen Nachholtermin."

---

## 7. Punkteschema (verbindlich, deckungsgleich mit IHK)

### Single-Choice (1 richtige Antwort, max. 1 Punkt)
- Richtige Option angeklickt → 1 Punkt
- Falsche Option angeklickt → 0 Punkte
- Nichts angeklickt → 0 Punkte
- UI erzwingt Einfachauswahl (Radio-Buttons).

### Multi-Choice (immer 2 richtige Antworten, max. 2 Punkte)
| Angekreuzt | richtig davon | Punkte |
|---|---|---|
| 0 | – | 0 |
| 1 | 1 | 1 |
| 1 | 0 | 0 |
| 2 | 2 | 2 |
| 2 | 1 | 1 |
| 2 | 0 | 0 |
| 3 oder mehr | (egal) | 0 |

UI lässt beliebig viele Kreuze zu (wie IHK), Auswertung folgt strikt der Tabelle. Punkte werden **server-seitig** in einer Supabase-Edge-Function berechnet, nicht im Browser — sonst manipulierbar.

### Bestehen
- Pro Themengebiet: erreicht-Prozent ≥ Schwelle (z. B. 50 %).
- Gesamt: alle Themengebiete bestanden **und** Gesamtschwelle erreicht.
- Anzeige für Teilnehmer: nur Punkte und Prozent, **kein** Bestanden/Nicht-Bestanden-Label im Tool.
- Anzeige im PDF (siehe Abschnitt 9): voll ausführlich.

---

## 8. PDF-Export

Ein PDF pro Teilnehmer, im IFM-Design (Vorbild: `IFM-Vorlage Word.docx`).

### Kopfzeile (auf jeder Seite)
- Links oben: IFM-Logo (das hochgeladene PNG)
- Rechts oben: „Qualifizierung | Coaching | Consulting" — Wörter in Dunkelblau `#2A4566`, Trennstriche in Rot `#AD0131`, **fett**

### Fußzeile (auf jeder Seite)
- Erste Zeile: „© IFM Institut für Managementberatung GmbH" links, „Seite X von Y" rechts
- Zweite Zeile: Trainer-Name links (aus dem Konto), `www.ifm-business.de` rechts in IFM-Dunkelblau und fett

### Inhalt Seite 1 — Übersicht
- Titel: „Prüfungsauswertung [Kursname]"
- Untertitel: Datum der Prüfung
- Block „Teilnehmer": Name
- Tabelle Themengebiete:

| Themengebiet | Punkte | Max | Prozent | Bestanden |
|---|---|---|---|---|
| Grundlagen Immobilienverwaltung | 14 | 18 | 78 % | ✓ |
| Rechtliche Grundlagen | 11 | 25 | 44 % | ✗ |
| … | | | | |

- Darunter, **fett und groß**: „Gesamtergebnis: bestanden" oder „Gesamtergebnis: nicht bestanden"
- Daneben: Gesamt-Punkte / Max-Punkte / Prozent
- Optional: Gesamtfeedback-Text vom Trainer (falls eingegeben)

### Inhalt ab Seite 2 — Fragen-Detail
Pro Frage, in der **ursprünglichen Anlegereihenfolge** (nicht die gemischte Teilnehmer-Reihenfolge):

- Fragenummer und -text
- Themengebiet als kleines Label
- Antwortoptionen aufgelistet, jeweils mit:
  - Häkchen oder Kreuz, was der Teilnehmer gewählt hat
  - Markierung in Grün `#1BA56E`, ob die Option richtig gewesen wäre
  - Bei falsch gewählter Option: zusätzlich Markierung in Rot `#AD0131`
- Punkte für diese Frage: erreicht / max
- Falls Trainer Feedback zu dieser Frage hinterlegt hat: in Hellblau-Box `#E1EAF5` darunter

### Themengebiet-Feedback
Am Ende jedes Themengebiet-Blocks: optionaler Feedback-Text vom Trainer (falls eingegeben).

### Schriftart
**Ubuntu**, mit Arial als Fallback. Größen: 24pt Titel, 12pt Fließtext, 9pt Fußzeile.

---

## 9. Multi-Trainer & Sharing

### Eigene Inhalte
Jeder Trainer hat eigene Kurse, eigenen Fragenpool, eigene Prüfungsvorlagen und eigene Prüfungen. Standardmäßig sieht ein Trainer nur seine eigenen Sachen.

### Sharing-Modi (wählbar bei jedem Teil-Vorgang)
| Modus | Was der Empfänger darf |
|---|---|
| **Nur verwenden** | Sieht die Vorlage / Prüfung. Kann eigene Prüfungssitzungen damit erstellen, eigene Teilnehmer einladen, eigene Abgaben verwalten. Kann den Inhalt nicht ändern. |
| **Gemeinsam bearbeiten** | Sieht und bearbeitet das Original mit. Beide Trainer arbeiten auf demselben Datensatz, alle Änderungen sind für beide sichtbar. |
| **Kopie übernehmen** | Empfänger erhält einen eigenständigen Klon im eigenen Account. Beide können unabhängig weiterentwickeln. |

Geteilt werden können: einzelne Fragen, ein gesamter Fragenpool, eine Prüfungsvorlage, oder eine konkrete Prüfung. Empfänger sieht Einladungen in seinem Dashboard und nimmt sie an.

---

## 10. Datenschutz und Aufbewahrung

Das Tool ist kein offizielles Prüfungssystem, sondern eine moderne interne Lösung für Niko (und Co-Trainer). Trotzdem werden personenbezogene Daten (Name + Antworten) verarbeitet.

**Aufbewahrungsregel:**
- 7 Tage nach Abgabe wird der Teilnehmer-Datensatz **anonymisiert**: Name wird durch „Anonymisiert" ersetzt, Antworten und Punkte bleiben für Statistik-Zwecke erhalten. Damit kann der Trainer langfristig sehen, wie schwer einzelne Fragen waren, ohne weiterhin Klarnamen zu speichern.
- PDFs werden **nicht serverseitig gespeichert**, sondern bei Bedarf im Browser des Trainers neu generiert. Nach Anonymisierung steht im PDF nur noch „Anonymisiert" beim Namen.
- Trainer kann eine ganze Prüfung jederzeit manuell löschen (inkl. aller Teilnehmer-Datensätze).
- **Empfehlung:** PDFs in den ersten 7 Tagen runterladen und bei den Teilnehmern verteilen, bevor die Namen verschwinden.

Datenstandort: Supabase-Region EU (Frankfurt) wählen.

---

## 11. UI-Richtung

Web-App im IFM-Design, responsive für Handy / Tablet / Laptop.

**Farbpalette** (aus `CLAUDE.md` übernommen):
- Dunkelblau `#2A4566` — Primärfarbe, Buttons, Überschriften
- Rot `#AD0131` — Akzent, Trennstriche, „falsch"-Marker
- Gelb `#FABB17` — Hinweise, „unsicher"-Marker
- Grün `#1BA56E` — Erfolg, „richtig"-Marker, bestanden
- Hellblau `#E1EAF5` — Hintergrund-Boxen, Hinweis-Container
- Grau `#8293A7` — Sekundärtext

**Schriftart:** Ubuntu (Google-Fonts CDN), Fallback Arial.

**Layout-Anker:**
- Trainer-Dashboard: linkes Menü (Kurse, Fragenpool, Vorlagen, Prüfungen, Geteilt mit mir), Hauptbereich mit Listen und Detailseiten.
- Teilnehmer-Prüfungsansicht: minimalistisch, eine Frage groß zentriert, Timer und Fortschrittsbalken oben, Navigation unten, Fragenübersicht ausklappbar.
- Mobile: Single-Column, große Touch-Targets.

---

## 12. Hosting und Kosten

| Posten | Anbieter | Tier | Kosten |
|---|---|---|---|
| Frontend-Hosting | GitHub Pages oder Cloudflare Pages | Free | 0 € |
| Datenbank + Auth + Realtime | Supabase | Free (500 MB DB, 5 GB Bandwidth/Monat) | 0 € |
| Domain | `exams.shnoozy.top` (Subdomain auf Nikos bestehender Domain `shnoozy.top`) | – | 0 € (Domain ist schon vorhanden) |
| Logo, Fonts | im Repo / Google Fonts | – | 0 € |

Für Niko-Volumen (1–2 Trainer, ein paar Kurse, ~30 Teilnehmer pro Prüfung, ~5 Prüfungen im Jahr) absolut unkritisch. Free-Tier reicht über Jahre.

**Repo:** Privat halten möglich (auf Cloudflare Pages oder mit GitHub Pro). Auf GitHub Free wäre für GitHub Pages das Repo öffentlich nötig — was OK ist, weil die eigentlichen Fragen in der DB liegen, nicht im Code.

---

## 13. Offene Punkte / Spätere Erweiterungen

Nicht im Erstausbau, aber für später denkbar:

- Bilder / Tabellen in Fragen (aktuell nur Text — kann nachgerüstet werden, wenn die IHK das ändert).
- Import / Export von Fragen als CSV oder JSON.
- Statistik-Auswertung pro Frage (wie oft falsch beantwortet → Frage zu schwer oder zu mehrdeutig?).
- Übungsmodus für Teilnehmer (ohne Wertung, mit sofortiger Antwortauflösung).
- Trainer-Kommentar während laufender Prüfung („Wir verlängern um 10 Minuten").
- Mehrsprachigkeit.

---

## 14. Nächste Schritte

1. Niko liest dieses Konzept und kommentiert / ändert.
2. Offene Punkte werden geklärt (Niko entscheidet zur Punkteverteilung WEG-Vorlage, H&G-Prüfungslogik im Detail, Aussehen des Wartebereich-Bildschirms).
3. Sobald Konzept finalisiert: Aufsetzen des Supabase-Projekts, GitHub-Repo, IFM-Design-System (Tailwind-Config mit Farben) — Erstgerüst.
4. Iteration in dieser Reihenfolge:
   - Auth + Trainer-Dashboard (leer)
   - Kurs + Fragenpool-Verwaltung
   - Prüfungsvorlage + Prüfung erstellen
   - Teilnehmer-Lobby + Prüfungslauf + Auto-Save
   - Auswertung + Punkteberechnung
   - PDF-Export
   - Multi-Trainer + Sharing
   - Polishing + Mobile-Feintuning
5. Pilot: WEG-Prüfung des nächsten Kurses als erster Echteinsatz.
