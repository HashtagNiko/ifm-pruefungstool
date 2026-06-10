import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

/**
 * Seitenübergreifende, geführte Produkt-Tour (driver.js). Die Tour navigiert
 * automatisch durch die Module und hebt auf jeder Seite die konkreten Funktionen
 * hervor. Fehlt ein Element (z. B. leeres Konto), zeigt driver.js den Schritt
 * zentriert – die Tour läuft trotzdem durch.
 */
type TourSchritt = DriveStep & { route: string }

const SCHRITTE: TourSchritt[] = [
  // ---- Intro ----
  {
    route: '/kurse',
    popover: {
      title: 'Willkommen beim IFM-Prüfungstool',
      description:
        'Diese Tour führt dich durch alle Bereiche. Sie wechselt automatisch die Seiten – ' +
        'klick dich einfach mit „Weiter" durch. Unten rechts kannst du sie über das ?-Symbol ' +
        'jederzeit neu starten.',
    },
  },
  {
    route: '/kurse',
    element: '[data-tour="menu"]',
    popover: {
      title: 'Das Menü',
      description:
        'Links navigierst du zwischen den Bereichen: Kurse, Fragenpool, Vorlagen, Prüfungen und ' +
        '„Geteilt mit mir". Wir gehen sie jetzt der Reihe nach durch.',
    },
  },

  // ---- Kurse ----
  {
    route: '/kurse',
    popover: {
      title: 'Bereich: Kurse',
      description:
        'Ein Kurs bündelt alles: Themengebiete, Fragen und Prüfungsvorlagen. Beispiel: ' +
        '„Zertifizierter WEG-Verwalter".',
    },
  },
  {
    route: '/kurse',
    element: '[data-tour="neuer-kurs"]',
    popover: {
      title: 'Neuen Kurs anlegen',
      description:
        'Hier erstellst du einen Kurs. Ein Klick auf eine Kurs-Karte öffnet die Detailseite, auf ' +
        'der du die Themengebiete (z. B. „Rechtliche Grundlagen") anlegst und sortierst.',
    },
  },
  {
    route: '/kurse',
    popover: {
      title: 'Kurs-Karten',
      description:
        'Jede Kurs-Karte hat Aktionen: Teilen (an andere Trainer freigeben), Bearbeiten und ' +
        'Löschen. Geteilte Kurse erkennst du an einem Badge.',
    },
  },

  // ---- Fragenpool ----
  {
    route: '/fragenpool',
    popover: {
      title: 'Bereich: Fragenpool',
      description: 'Hier verwaltest du alle Fragen eines Kurses.',
    },
  },
  {
    route: '/fragenpool',
    element: '[data-tour="fp-kurs"]',
    popover: {
      title: 'Kurs wählen',
      description: 'Oben wählst du den Kurs, dessen Fragen du sehen und bearbeiten möchtest.',
    },
  },
  {
    route: '/fragenpool',
    element: '[data-tour="fp-filter"]',
    popover: {
      title: 'Nach Themengebiet filtern',
      description: 'Mit diesem Filter zeigst du nur Fragen eines bestimmten Themengebiets an.',
    },
  },
  {
    route: '/fragenpool',
    element: '[data-tour="fp-neue-frage"]',
    popover: {
      title: 'Neue Frage',
      description:
        'Frage anlegen: Text, Typ (Single = 1 richtig, Multi = 2 richtig), Themengebiet und ' +
        'Antwortoptionen mit Richtig-Markierung. Die Punkteregeln werden automatisch geprüft.',
    },
  },
  {
    route: '/fragenpool',
    element: '[data-tour="fp-import"]',
    popover: {
      title: 'Fragen importieren',
      description:
        'Bestehende Fragen kannst du per JSON-Datei importieren – fehlende Themengebiete werden ' +
        'dabei automatisch angelegt.',
    },
  },

  // ---- Vorlagen ----
  {
    route: '/vorlagen',
    popover: {
      title: 'Bereich: Vorlagen',
      description:
        'Eine Prüfungsvorlage ist der wiederverwendbare Bauplan einer Prüfung.',
    },
  },
  {
    route: '/vorlagen',
    element: '[data-tour="vl-kurs"]',
    popover: {
      title: 'Kurs wählen',
      description: 'Vorlagen gehören zu einem Kurs – hier wählst du ihn aus.',
    },
  },
  {
    route: '/vorlagen',
    element: '[data-tour="vl-neue"]',
    popover: {
      title: 'Neue Vorlage',
      description:
        'In der Vorlage legst du Dauer, Bestehensschwellen (gesamt und je Themengebiet) und fest, ' +
        'wie viele Fragen je Themengebiet gezogen werden. Das Tool prüft, ob genug Fragen im Pool ' +
        'sind.',
    },
  },

  // ---- Prüfungen ----
  {
    route: '/pruefungen',
    popover: {
      title: 'Bereich: Prüfungen',
      description: 'Hier erstellst und steuerst du konkrete Prüfungssitzungen.',
    },
  },
  {
    route: '/pruefungen',
    element: '[data-tour="pr-neue"]',
    popover: {
      title: 'Neue Prüfung',
      description:
        'Aus einer Vorlage wird eine Prüfung erzeugt: Die Fragen werden zufällig aus dem Pool ' +
        'gezogen und als Snapshot eingefroren. Du wählst Datum und Späteinsteiger-Modus.',
    },
  },
  {
    route: '/pruefungen',
    popover: {
      title: 'Prüfung durchführen & auswerten',
      description:
        'Ein Klick auf eine Prüfung öffnet die Steuerung: Lobby öffnen, starten, live verfolgen ' +
        '(wer wartet/schreibt/abgegeben hat), Teilnehmer-Link teilen. Danach wertest du jeden ' +
        'Teilnehmer aus – mit Feedback, PDF- und ZIP-Export im IFM-Design.',
    },
  },

  // ---- Geteilt ----
  {
    route: '/geteilt',
    popover: {
      title: 'Bereich: Geteilt mit mir',
      description:
        'Kurse, die andere Trainer mit dir geteilt haben, erscheinen hier als Einladung – zum ' +
        'Annehmen oder Ablehnen. Darunter siehst du deine eigenen Freigaben und kannst sie ' +
        'widerrufen. Modi: nur verwenden, gemeinsam bearbeiten, Kopie übernehmen.',
    },
  },

  // ---- Teilnehmer + Abschluss ----
  {
    route: '/pruefungen',
    popover: {
      title: 'Und die Teilnehmer?',
      description:
        'Teilnehmer brauchen kein Konto. Sie öffnen den Prüfungs-Link, geben ihren Namen ein, ' +
        'warten in der Lobby und schreiben dann – eine Frage pro Seite, mit Auto-Speichern und ' +
        'Timer. Den Link findest du in jeder Prüfung.',
    },
  },
  {
    route: '/pruefungen',
    element: '[data-tour="tour-hilfe"]',
    popover: {
      title: 'Tour jederzeit neu starten',
      description: 'Über dieses ?-Symbol unten rechts startest du die Tour auf jeder Seite erneut.',
    },
  },
  {
    route: '/kurse',
    popover: {
      title: 'Fertig!',
      description:
        'Am besten gleich ausprobieren: Kurs anlegen → Fragen → Vorlage → Prüfung starten. ' +
        'Viel Erfolg!',
    },
  },
]

export function starteTour(navigate: (pfad: string) => void) {
  const steps: DriveStep[] = SCHRITTE.map(({ route: _route, ...rest }) => rest)
  const routes: string[] = SCHRITTE.map((s) => s.route)

  let d: Driver

  // Wechselt zum Zielschritt; navigiert vorher die Seite, falls nötig.
  function geheZu(ziel: number, aktuell: number) {
    const bewegen = () => (ziel > aktuell ? d.moveNext() : d.movePrevious())
    if (routes[ziel] && routes[ziel] !== routes[aktuell]) {
      navigate(routes[ziel])
      window.setTimeout(bewegen, 400)
    } else {
      bewegen()
    }
  }

  d = driver({
    showProgress: true,
    progressText: 'Schritt {{current}} von {{total}}',
    nextBtnText: 'Weiter',
    prevBtnText: 'Zurück',
    doneBtnText: 'Fertig',
    steps,
    onNextClick: () => {
      const i = d.getActiveIndex() ?? 0
      geheZu(i + 1, i)
    },
    onPrevClick: () => {
      const i = d.getActiveIndex() ?? 0
      geheZu(i - 1, i)
    },
  })

  navigate(routes[0])
  window.setTimeout(() => d.drive(), 350)
}
