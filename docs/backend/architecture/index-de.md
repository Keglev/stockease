# Einfuehrung und Ziele

StockEase demonstriert produktionsreife Backend-Entwicklung an einer
realistischen Warenwirtschafts-Domaene. Es ist ein Portfolio-Projekt nach den
Massstaeben einer kommerziellen Codebasis: erzwungene Modulgrenzen, ein durch
Migrationen verwaltetes Schema, ein unveraenderliches Buchungsmodell und eine
Testsuite, die die Invarianten nachweist.

## Anforderungsueberblick

Das System bildet den Warenkreislauf eines kleinen Handelsbetriebs ab:
Produktstammdaten, Lieferanten und Kunden, Eingangs- und Ausgangsrechnungen
(jeder Verkauf wird fakturiert, wie in Deutschland ueblich), aus dem
Rechnungslebenszyklus abgeleitete Lagerbewegungen, ein Aenderungsprotokoll und
lesende Berichte.

## Qualitaetsziele

1. **Korrekte Bestandsarithmetik.** Ein einziger, gesperrter Schreibpfad fuer
   Mengen; negativer Bestand ist konstruktiv unmoeglich.
2. **Verifizierbare Grenzen.** Modulabhaengigkeiten sind Architekturgesetz,
   erzwungen durch Spring Modulith und einen Grenztest bei jedem Build.
3. **Nachvollziehbarkeit.** Wer hat was wann geaendert: Produktaenderungen,
   Lebenszyklus-Stempel und Bewegungsdatensaetze sind unveraenderliche Fakten.

## Stakeholder

Ein Solo-Entwickler, der fuer technische Gutachter baut: Recruiter und
Ingenieure, die Codequalitaet, Architekturbegruendung und
Dokumentationspraxis fuer den deutschen Markt bewerten.

## Dokumentationsuebersicht

- [Backend-Architektur](overview-de.md) -
  [English version](overview.md)
- [Constraints](02-constraints.md) (EN)
- [System Context](03-context.md) (EN)
- [Solution Strategy](04-solution-strategy.md) (EN)
- [Building Blocks](05-building-blocks.md) (EN)
- [Domain Modules](05-domains/index.md) (EN)
- [Runtime View](06-runtime.md) (EN)
- [Deployment View](07-deployment.md) (EN)
- [Cross-cutting Concepts](08-concepts.md) (EN)
- [Architecture Decisions](09-decisions/index.md) (EN)
- [Quality Requirements](10-quality-requirements.md) (EN)
- [Risks and Technical Debt](11-risks-technical-debt.md) (EN)
- [Glossary](12-glossary.md) (EN)
- [Architecture decisions](../../decisions/index.md) (EN)

[Zurueck zur Dokumentations-Startseite](/stockease/)
