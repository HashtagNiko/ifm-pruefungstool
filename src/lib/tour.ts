import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

/**
 * Geführte Produkt-Tour über alle Module. Spotlight via driver.js, anker an der
 * Sidebar (auf jeder Seite vorhanden) + einem Element der Kurse-Seite.
 */
const SCHRITTE: DriveStep[] = [
  {
    popover: {
      title: 'Willkommen beim IFM-Prüfungstool',
      description:
        'Kurze Tour durch alle Bereiche: Kurse & Fragen anlegen, Prüfungen durchführen, ' +
        'auswerten und als PDF exportieren. Du kannst jederzeit mit „Weiter" durchklicken oder ' +
        'oben rechts über das ?-Symbol neu starten.',
    },
  },
  {
    element: '[data-tour="menu-kurse"]',
    popover: {
      title: '1. Kurse',
      description:
        'Hier legst du Kurse an (z. B. „WEG-Verwalter") und definierst pro Kurs die ' +
        'Themengebiete. Über das Teilen-Symbol kannst du einen Kurs an andere Trainer ' +
        'freigeben (nur verwenden, gemeinsam bearbeiten oder als Kopie).',
    },
  },
  {
    element: '[data-tour="neuer-kurs"]',
    popover: {
      title: 'Neuen Kurs anlegen',
      description: 'Mit diesem Button erstellst du einen neuen Kurs. Ein Klick auf einen Kurs öffnet die Themengebiete.',
    },
  },
  {
    element: '[data-tour="menu-fragenpool"]',
    popover: {
      title: '2. Fragenpool',
      description:
        'Pflege deine Fragen je Kurs: Single-Choice (1 richtig) oder Multi-Choice (2 richtig), ' +
        'mit Antwortoptionen und Themengebiet. Bestehende Fragen kannst du auch per JSON-Datei ' +
        'importieren.',
    },
  },
  {
    element: '[data-tour="menu-vorlagen"]',
    popover: {
      title: '3. Vorlagen',
      description:
        'Eine Prüfungsvorlage ist der Bauplan: Dauer, Bestehensschwellen (gesamt und je ' +
        'Themengebiet) und wie viele Fragen je Themengebiet gezogen werden.',
    },
  },
  {
    element: '[data-tour="menu-pruefungen"]',
    popover: {
      title: '4. Prüfungen',
      description:
        'Aus einer Vorlage erstellst du eine konkrete Prüfung (Fragen werden zufällig gezogen). ' +
        'Du öffnest die Lobby, startest die Prüfung, siehst live, wer beigetreten hat und abgibt, ' +
        'und wertest danach jeden Teilnehmer aus – inklusive PDF- und ZIP-Export im IFM-Design.',
    },
  },
  {
    element: '[data-tour="menu-geteilt"]',
    popover: {
      title: '5. Geteilt mit mir',
      description:
        'Hier erscheinen Kurse, die andere Trainer mit dir geteilt haben. Einladungen kannst du ' +
        'annehmen oder ablehnen; eigene Freigaben verwaltest du ebenfalls hier.',
    },
  },
  {
    popover: {
      title: 'Und die Teilnehmer?',
      description:
        'Teilnehmer brauchen kein Konto. Sie öffnen einen Link, geben ihren Namen ein, warten in ' +
        'der Lobby und schreiben dann die Prüfung – eine Frage pro Seite, mit Auto-Speichern und ' +
        'Timer. Den Link findest du in jeder Prüfung.',
    },
  },
  {
    element: '[data-tour="tour-hilfe"]',
    popover: {
      title: 'Tour jederzeit neu starten',
      description: 'Über dieses ?-Symbol kannst du die Tour auf jeder Seite erneut starten.',
    },
  },
  {
    popover: {
      title: 'Fertig!',
      description:
        'Das war der Überblick. Am besten einfach ausprobieren: Kurs anlegen → Fragen → Vorlage → ' +
        'Prüfung starten. Viel Erfolg!',
    },
  },
]

export function starteTour(navigate: (pfad: string) => void) {
  // Auf die Kurse-Seite wechseln, damit die Seitenelemente vorhanden sind
  navigate('/kurse')
  const d = driver({
    showProgress: true,
    progressText: 'Schritt {{current}} von {{total}}',
    nextBtnText: 'Weiter',
    prevBtnText: 'Zurück',
    doneBtnText: 'Fertig',
    steps: SCHRITTE,
  })
  // kurze Verzögerung, bis die Kurse-Seite gerendert ist
  window.setTimeout(() => d.drive(), 350)
}
