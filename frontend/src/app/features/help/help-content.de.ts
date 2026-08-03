import { HelpTopic } from './help-content.types';

/**
 * German help prose, the twin of help-content.en.ts. Same topics in the same order, same section
 * ids - help-content.spec.ts is what holds the two together (ADR 029).
 *
 * <p>The role corrections made in the English file are carried here too; see the comments at the
 * same paragraphs for what the controllers actually allow.
 */
export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    id: 'overview',
    sections: [
      {
        id: 'kpis',
        heading: 'Die vier Kennzahlen oben',
        paragraphs: [
          'Die Übersicht beginnt mit vier Kennzahlen: Produkte, Bestand niedrig, Überfällige Rechnungen und Bruttogewinn. Ein negativer Bruttogewinn wird in der Fehlerfarbe angezeigt, damit er sofort auffällt.',
          'Bestand niedrig zählt nur Produkte, die mindestens einmal eingelagert waren. Ein angelegtes, aber nie eingekauftes Produkt gilt als neu, nicht als niedrig. Ein Klick auf die Kennzahl öffnet eine Liste der betroffenen Produkte mit Name, SKU und aktueller Menge.'
        ]
      },
      {
        id: 'cards',
        heading: 'Gewinn- und Fälligkeitskarten',
        paragraphs: [
          'Die Gewinnkarte zeigt den Bruttogewinn je Produkt und lässt sich zwischen Diagramm und Tabelle umschalten. Die Fälligkeitskarte zeigt anstehende und überfällige Rechnungen, wahlweise als Diagramm nach Fälligkeitszeiträumen oder als kurze Liste der nächsten Rechnungen.',
          'Mit der Schaltfläche Aktualisieren laden Sie alle Kennzahlen neu.'
        ]
      }
    ]
  },
  {
    id: 'products',
    sections: [
      {
        id: 'basics',
        heading: 'Produkte verwalten',
        paragraphs: [
          // Korrigiert gegen ProductController: createProduct ist hasRole('ADMIN'), updateName und
          // updatePrice erlauben beide Rollen. Bearbeiten ist also nicht Administratoren vorbehalten.
          'Die Produktliste zeigt jedes Produkt mit SKU, Menge und Einkaufspreis. Das Anlegen eines Produkts ist Administratoren vorbehalten; den Namen eines Produkts dürfen beide Rollen korrigieren.',
          'Der Einkaufspreis wird im Alltag nicht frei bearbeitet: Er wird automatisch aktualisiert, wenn eine Einkaufsrechnung geschlossen wird, und entspricht damit immer dem letzten tatsächlichen Einkauf.'
        ]
      },
      {
        id: 'lifecycle',
        heading: 'Löschen und Historie',
        paragraphs: [
          // Korrigiert: Löschen ist Administratoren vorbehalten, aber es gibt keinen Endpunkt zum
          // Wiederherstellen. ProductService.restore existiert, wird jedoch von keinem Controller
          // veröffentlicht - aus der Anwendung heraus ist das Löschen daher endgültig.
          'Das Löschen eines Produkts ist Administratoren vorbehalten. Ein gelöschtes Produkt verschwindet aus der täglichen Arbeit, bleibt aber Teil der Historie: Berichte und alte Rechnungen zeigen es weiterhin, als gelöscht markiert. Innerhalb der Anwendung lässt sich das Löschen nicht rückgängig machen.',
          'Jede Änderung an einem Produkt wird protokolliert. Aus der Produktliste heraus öffnen Sie die Änderungshistorie und sehen, wer wann was geändert hat.'
        ]
      }
    ]
  },
  {
    id: 'invoices',
    sections: [
      {
        id: 'types',
        heading: 'Einkaufs- und Verkaufsrechnungen',
        paragraphs: [
          'Bestand kommt über Rechnungen ins System und verlässt es auch darüber. Eine Einkaufsrechnung erhöht den Bestand beim Schließen, eine Verkaufsrechnung verringert ihn beim Schließen. Die Rechnungsnummer vergeben Sie selbst, passend zu Ihrer Papier- oder ERP-Nummerierung.'
        ]
      },
      {
        id: 'lifecycle',
        heading: 'Von Offen zu Geschlossen',
        paragraphs: [
          // Geprüft gegen InvoiceController: closeInvoice, markInvoiceAsPaid und deleteInvoice sind
          // hasRole('ADMIN'). Die Aussage stimmt unverändert.
          'Eine Rechnung beginnt als Offen und kann bearbeitet werden. Beim Schließen werden die Lagerbewegungen gebucht und bei Einkäufen der Einkaufspreis der Produkte aktualisiert. Das Schließen, das Löschen offener Rechnungen und das Markieren als bezahlt sind Administrator-Aktionen.',
          'Jede Rechnung hat ein Fälligkeitsdatum. Überfällige unbezahlte Rechnungen sind in der Liste mit einem Chip markiert und werden auf der Übersicht gezählt.'
        ]
      },
      {
        id: 'returns',
        heading: 'Retouren',
        paragraphs: [
          // Geprüft gegen ReturnController: registerReturn ist hasAnyRole('ADMIN', 'USER').
          'Retouren werden an der Rechnung selbst erfasst: Öffnen Sie eine geschlossene Rechnung und retournieren Sie eine Position ganz oder teilweise, solange Stückzahlen übrig sind. Beide Rollen können Retouren erfassen. Eine vollständig retournierte Rechnung wird entsprechend gekennzeichnet.'
        ]
      }
    ]
  },
  {
    id: 'movements',
    sections: [
      {
        id: 'purpose',
        heading: 'Wozu diese Seite dient',
        paragraphs: [
          'Die Seite Lagerbewegungen erfasst ausschließlich Verluste: Ware, die verloren ging oder zerstört wurde. Wählen Sie Produkt, Grund und Menge; eine Bemerkung ist immer Pflicht, damit der Verlust später nachvollziehbar bleibt.',
          'Alles andere wird hier nicht gebucht. Einkäufe und Verkäufe entstehen durch das Schließen von Rechnungen, Retouren werden an der Rechnung selbst erfasst. So bleibt jede Bewegung ihrem Beleg zuordenbar.'
        ]
      }
    ]
  },
  {
    id: 'reports',
    sections: [
      {
        id: 'tabs',
        heading: 'Die sieben Reiter',
        paragraphs: [
          'Die Berichte sind in sieben Reiter gegliedert: Gewinn, Cashflow, Bestand, Verluste, Fälligkeiten, Änderungen und Analyse.'
        ],
        bullets: [
          'Gewinn: Bruttogewinn je Produkt, mit dem Einkaufspreis zum Verkaufszeitpunkt — spätere Preisänderungen schreiben die Vergangenheit nicht um.',
          'Cashflow: tatsächlich geflossenes Geld. Nur bezahlte Rechnungen zählen, dargestellt als Summen, Monatsverlauf und Produkttabelle.',
          'Bestand: aktueller Bestandswert je Produkt.',
          'Verluste: verlorene und zerstörte Ware im gewählten Zeitraum.',
          'Fälligkeiten: anstehende und überfällige Rechnungen mit ihren Nummern.',
          'Änderungen: die letzten Produktänderungen aller Benutzer.',
          'Analyse: Preis- und Bestandsverlauf eines einzelnen Produkts.'
        ]
      },
      {
        id: 'controls',
        heading: 'Zeiträume, Filter und Export',
        paragraphs: [
          'Die meisten Reiter teilen dieselben Bedienelemente: einen Zeitraum (30, 90 oder 180 Tage, dieses Jahr oder alles), einen Umschalter zwischen Diagramm und Tabelle sowie einen Textfilter über Name und SKU. Der CSV-Export enthält immer genau das, was der Filter gerade zeigt.'
        ]
      },
      {
        id: 'analytics',
        heading: 'Analyse',
        paragraphs: [
          'In der Analyse wählen Sie zuerst einen Lieferanten, dann eines seiner Produkte — tippen Sie mindestens drei Buchstaben zum Suchen — und drücken Anzeigen. Sie erhalten den Einkaufspreis im Zeitverlauf und den Bestand gegenüber den verkauften Stückzahlen.'
        ]
      }
    ]
  },
  {
    id: 'partners',
    sections: [
      {
        id: 'both',
        heading: 'Lieferanten und Kunden',
        paragraphs: [
          'Lieferanten und Kunden funktionieren gleich: eine Liste mit Seitennavigation, in der Partner angelegt und bearbeitet werden, und jede Rechnung ist genau einem Partner zugeordnet.',
          'Aus der Kundenliste öffnen Sie eine Zusammenfassung der Käufe des Kunden. Lieferanten-Auswahlfelder in der App sind Suchfelder: Tippen Sie mindestens drei Buchstaben und wählen Sie aus den Treffern.'
        ]
      }
    ]
  },
  {
    id: 'demo',
    sections: [
      {
        id: 'access',
        heading: 'Demo ausprobieren',
        paragraphs: [
          'Auf der Startseite betreten Sie die Demo mit einem Klick, als Administrator oder als Benutzer — ohne Passwort. Ein DEMO-Abzeichen in der Werkzeugleiste zeigt Ihnen jederzeit, in welchem System Sie sind.'
        ]
      },
      {
        id: 'data',
        heading: 'Demodaten und Zurücksetzen',
        paragraphs: [
          'Die Demo enthält realistische Beispieldaten, verteilt über die vergangenen Monate, damit zeitbezogene Berichte eine aussagekräftige Historie zeigen. Alle Demodaten werden jede Nacht um 03:00 UTC zurückgesetzt; Sie können also alles gefahrlos ausprobieren.'
        ]
      },
      {
        id: 'roles',
        heading: 'Was die Rollen dürfen',
        paragraphs: [
          // Enger gefasst als "verwalten Produkte": Anlegen und Löschen sind Administratoren
          // vorbehalten, das Bearbeiten nicht.
          'Administratoren legen Produkte an und löschen sie und steuern den Rechnungszyklus: Schließen, als bezahlt markieren, offene Rechnungen löschen. Benutzer können alles einsehen, Rechnungen schreiben, Produktnamen korrigieren sowie Retouren und Verluste erfassen.'
        ]
      }
    ]
  },
  {
    id: 'language-theme',
    sections: [
      {
        id: 'toggles',
        heading: 'Sprache und Design',
        paragraphs: [
          'Die Werkzeugleiste bietet zwei Umschalter: einer wechselt die Oberfläche zwischen Deutsch und Englisch, der andere zwischen hellem und dunklem Design. Beides wirkt sofort und steht auch auf den öffentlichen Seiten vor der Anmeldung zur Verfügung.'
        ]
      }
    ]
  }
];
