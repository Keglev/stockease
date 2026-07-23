# Backend-Architektur

StockEase ist ein modulares Warenwirtschafts-Backend: Produkte, Lieferanten,
Kunden, Eingangs- und Ausgangsrechnungen, unveraenderliche Lagerbewegungen,
Aenderungsprotokollierung und Berichte in einer einzigen Spring-Boot-Anwendung.

> **Dies ist eine einseitige Zusammenfassung.** Die strukturierte
> arc42-Dokumentation - Einfuehrung und Ziele, Randbedingungen, Kontext,
> Bausteine, Laufzeitsicht, Verteilung, Konzepte, Entscheidungen, Qualitaet,
> Risiken und Glossar - beginnt in der
> [vollstaendigen Architekturdokumentation](index-de.md).

## Technologie-Stack

| Komponente       | Technologie                       | Version |
|------------------|-----------------------------------|---------|
| Sprache          | Java                              | 21      |
| Framework        | Spring Boot                       | 4.1.0   |
| Modularitaet     | Spring Modulith                   | Boot-verwaltet |
| Datenbank        | PostgreSQL (Supabase)             | 16      |
| Migrationen      | Flyway                            | Boot-verwaltet |
| Tests            | JUnit 5, Mockito, Testcontainers  | Boot-verwaltet |
| Build            | Maven                             | 3.x     |
| Container        | Docker                            | aktuell |
| CI/CD            | GitHub Actions                    | -       |
| Hosting          | Koyeb                             | -       |

## Architekturprinzipien

- **Modularer Monolith.** Acht Fachmodule plus gemeinsame Infrastruktur in
  einer Anwendung; die Modulgrenzen werden durch Spring Modulith erzwungen und
  bei jedem Build durch einen Test verifiziert - nicht durch Konvention.
- **Ereignisse innerhalb der Transaktion.** Das Abschliessen einer Rechnung
  veroeffentlicht ein Ereignis; ein synchroner Listener bucht die
  Lagerbewegungen in derselben Transaktion. Alles wird gemeinsam festgeschrieben
  oder gemeinsam zurueckgerollt.
- **Unveraenderliche Belege.** Rechnungen und Bewegungen werden nie editiert.
  Korrekturen sind neue Datensaetze: Loeschen und Neuanlegen im offenen Zustand,
  Retourenfluesse nach dem Abschluss.
- **Abgeleitet statt gespeichert.** Preis-Schnappschuesse werden beim Buchen
  aus den Rechnungspositionen uebernommen; Summen und Ueberfaelligkeit werden
  zur Lesezeit berechnet, nie persistiert.
- **Ein Schema-Eigentuemer.** Flyway besitzt das Schema; Hibernate validiert es
  nur.

## Dokumentationsuebersicht

- [Vollstaendige arc42-Dokumentation](index-de.md) - [English version](index.md)
- [Fachmodule](05-domains/index.md) (EN)
- [Architekturentscheidungen](09-decisions/index.md) (EN)
