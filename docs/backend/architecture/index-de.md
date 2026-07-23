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

> **Status: Skelett.** Die uebrigen arc42-Abschnitte sind Platzhalter und
> werden abschnittsweise gefuellt; Entscheidungsinhalte stehen bereits im
> [ADR-Index](09-decisions/index.md) (EN).
