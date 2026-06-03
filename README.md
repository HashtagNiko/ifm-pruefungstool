# IFM-Prüfungstool

Leichtgewichtiges Online-Prüfungstool für die IFM-Kurse (vorerst „Zertifizierter
WEG-Verwalter" und „Haus- und Grundstücksverwaltung"). Trainer erstellen Prüfungen,
führen sie in Echtzeit durch und werten mit fairer Teilpunkte-Vergabe aus; Export als
PDF im IFM-Design.

Vollständiges Konzept: [Konzept_Prüfungstool.md](./Konzept_Prüfungstool.md).

## Tech-Stack

- **Frontend:** Vite + React + TypeScript, [Tailwind CSS v4](https://tailwindcss.com)
- **Backend / DB / Auth / Realtime:** [Supabase](https://supabase.com) (Postgres), EU-Region Frankfurt
- **Hosting:** GitHub Pages oder Cloudflare Pages (statischer Build)
- **PDF:** clientseitig im Browser (geplant: `pdfmake` / `jsPDF`)

## IFM-Design

Farben und Schrift sind als Tailwind-Theme in [src/index.css](./src/index.css) hinterlegt
(`bg-ifm-blue`, `text-ifm-red`, …):

| Token | Hex | Verwendung |
|---|---|---|
| `ifm-blue` | `#2A4566` | Primärfarbe, Buttons, Überschriften |
| `ifm-red` | `#AD0131` | Akzent, Trennstriche, „falsch" |
| `ifm-yellow` | `#FABB17` | Hinweise, „unsicher" |
| `ifm-green` | `#1BA56E` | Erfolg, „richtig", bestanden |
| `ifm-lightblue` | `#E1EAF5` | Hintergrund-/Hinweis-Boxen |
| `ifm-gray` | `#8293A7` | Sekundärtext |

Schrift: **Ubuntu** (Google Fonts), Fallback Arial.

## Setup

```bash
npm install
cp .env.example .env   # Supabase-Keys eintragen
npm run dev
```

Die App startet auch ohne Supabase-Keys (Gerüst-Modus); für Backend-Funktionen müssen
`VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in `.env` gesetzt sein.

## Skripte

| Befehl | Zweck |
|---|---|
| `npm run dev` | Lokaler Dev-Server |
| `npm run build` | Production-Build nach `dist/` |
| `npm run preview` | Build lokal vorschauen |

## Datenbank

Das Schema (Tabellen, RLS-Policies, Auth-Trigger) liegt versioniert in
[supabase/migrations/](./supabase/migrations/) und ist auf dem Supabase-Projekt
(Region Frankfurt) angewandt. TypeScript-Typen: [src/lib/database.types.ts](./src/lib/database.types.ts)
(neu generieren via Supabase nach Schema-Änderungen).

**Row-Level Security:** Auf allen Tabellen aktiv. Trainer sehen ausschließlich eigene
Daten (Kurse, Fragen, Vorlagen, Prüfungen). Teilnehmer-Schreibzugriff (Lobby/Prüfungslauf)
wird mit dem entsprechenden Feature ergänzt. Sharing (Konzept Abschnitt 9) folgt später.

## Status

Grundgerüst (Schritt 3 aus „Nächste Schritte" im Konzept). Implementierung iterativ:
Auth → Trainer-Dashboard → Fragenpool → Vorlagen → Prüfungslauf → Auswertung →
PDF-Export → Sharing.
