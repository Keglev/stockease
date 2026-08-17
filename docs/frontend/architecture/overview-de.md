# Frontend-Architektur

Das StockEase-Frontend ist eine Single-Page-Angular-Anwendung auf der REST-API
des Backends: Produktstammdaten, Lieferanten und Kunden, Eingangs- und
Ausgangsrechnungen, Lagerbewegungen, ein Aenderungsprotokoll und ein
Berichtsbereich, hinter einer einzigen authentifizierten Huelle.

> **Dies ist eine einseitige Zusammenfassung.** Einfuehrung und Ziele des
> Frontend-Kontexts - Qualitaetsziele, Zielgruppe und die Abgrenzung zum
> Backend - finden sich unter [Einfuehrung und Ziele](index-de.md).

## Technologie-Stack

| Komponente       | Technologie                         | Version |
|------------------|-------------------------------------|---------|
| Sprache          | TypeScript                          | 6.0     |
| Framework        | Angular (standalone, Signals)       | 22.0    |
| UI-Komponenten   | Angular Material und CDK            | 22.0    |
| Diagramme        | Apache ECharts, direkt verwendet    | 6.1.0   |
| Uebersetzung     | ngx-translate                       | 18.0    |
| Asynchronitaet   | RxJS                                | 7.8     |
| Tests            | Vitest mit jsdom                    | 4.0     |
| Build            | Angular CLI (`@angular/build`)      | 22.0    |
| CI/CD            | GitHub Actions                      | -       |
| Hosting          | Vercel CDN                          | -       |

## Aufbau der Anwendung

Die Anwendung ist durchgaengig standalone: Es gibt kein einziges `NgModule`, und
`main.ts` startet eine einzelne Wurzelkomponente mit einer Provider-Liste in
`app/app.config.ts`. `zone.js` ist weder installiert noch im Produktions-Bundle
enthalten, und `angular.json` konfiguriert keinen Polyfills-Eintrag; Komponenten
halten ihren Zustand in Signals und veroeffentlichen ihn ueber `input()` und
`output()`.

Das Routing ist ausnahmslos lazy. Jeder Eintrag in `app/app.routes.ts` verwendet
`loadComponent`, sodass kein Fachbereich im initialen Bundle liegt. Drei Routen
sind oeffentlich - Landing-Page, Anmeldung und Abmeldung -, alles Weitere ist
Kind von `/app`, das die Shell-Komponente hinter einem Auth-Guard laedt. Eine
zuletzt deklarierte Wildcard-Route rendert die Nicht-gefunden-Seite.

## Shell, Seiten und Karten

Drei Rollen teilen sich die Arbeit, und die Aufteilung wird durch Review
durchgesetzt, nicht durch das Framework:

- **Die Shell** (`shared/shell`) ist der Rahmen um jede authentifizierte Seite:
  Toolbar, Navigationsleiste und der Router-Outlet. Sie besitzt den Timer fuer
  die automatische Abmeldung bei Inaktivitaet - weshalb dieser nicht laufen
  kann, waehrend jemand eine oeffentliche Seite liest.
- **Eine Seite** besitzt ihre Daten. Sie ruft die Services auf, haelt die
  geladenen Zeilen, zeigt das Fehlerbanner, berechnet alles, was ihre Kinder
  darstellen, und entscheidet, was lazy geladen wird.
- **Eine Karte** ist rein darstellend. Ihre Werte kommen bereits berechnet als
  Inputs an, und ihre Bedienelemente melden eine Entscheidung ueber einen
  Output, statt sie selbst auszufuehren. Der Berichtsbereich ist das
  ausgearbeitete Beispiel: Jeder Tab-Inhalt ist eine Karte, und die Seite
  dahinter besitzt jeden Abruf und jede Ableitung.

## Wo der Zustand liegt

Es gibt keinen globalen Store. Zustand liegt dort, wo er gebraucht wird:

- **Services** (`app/core`) besitzen alles Uebergreifende und Langlebige:
  Sitzung und Token, aktuelle Sprache, Theme, Formatierung, Benachrichtigungen
  und Health-Status. Sie sind `providedIn: 'root'` und stellen Signals bereit.
- **Komponenten** halten ihren eigenen Ansichtszustand in Signals und leiten mit
  `computed` ab, statt im Template neu zu berechnen.
- **Drei gemeinsame Signal-Stores** tragen Muster, die haeufig genug auftraten,
  um benannt zu werden: `shared/list/list-page-store.ts` fuer Registerseiten,
  die eine begrenzte Liste einmal laden und clientseitig blaettern,
  `shared/list/paged-list-store.ts` fuer Seiten, die stattdessen jeweils eine
  Seite vom Server holen, sowie `shared/dialog/dialog-submit-store.ts` fuer den
  Absendezustand von Dialogen.

## Kommunikation mit dem Backend

Fachservices rufen die API ueber Angulars `HttpClient` auf; die Basis-URL liefert
`src/environments/` je Build. Zwei funktionale Interceptors liegen vor jeder
Anfrage: einer haengt das Bearer-Token an, der andere wandelt eine
fehlgeschlagene Antwort in einen `ApiError` mit Status und maschinenlesbarem Code
des Backends um. Die meisten Endpunkte antworten in einer Huelle aus
`success`/`message`/`data`, die die Fachservices auspacken - bewusst nicht der
Interceptor, weil die Berichtsendpunkte ihre Nutzdaten direkt zurueckgeben.

## Sprache und Formatierung

Die Oberflaeche erscheint auf Englisch und Deutsch. Uebersetzungen werden als je
eine Datei pro Namensraum und Sprache unter `frontend/src/i18n/` gepflegt und
zur Bauzeit zu den beiden Bundles zusammengesetzt, die die Anwendung zur
Laufzeit laedt (ADR 037). ngx-translate loest Schluessel zur Laufzeit auf,
sodass die Sprache ohne Neuladen wechselt (ADR 015), und der Start wartet auf
das erste Bundle, damit keine Seite rohe Schluessel anzeigt. Datums- und
Waehrungsangaben werden zur Renderzeit ueber `Intl` formatiert, nicht ueber eine
zur Bauzeit festgelegte Locale (ADR 031).

## Tests

Vitest fuehrt die Suite ueber Angulars `unit-test`-Builder gegen jsdom aus. Die
Coverage-Schwellen stehen in `angular.json` als Regressionsuntergrenzen
unterhalb der erreichten Werte. Der Frontend-Workflow fuehrt Linting, einen
Produktions-Build, die Suite mit Coverage und eine Drift-Pruefung aus, die die
Uebersetzungs-Bundles neu zusammensetzt und fehlschlaegt, wenn die eingecheckten
davon abweichen.

## Dokumentationsuebersicht

- [Einfuehrung und Ziele](index-de.md) - [English version](overview.md)
- [Architekturentscheidungen](../../decisions/index.md) (EN)
- [Backend-Architektur](../../backend/architecture/overview-de.md)
