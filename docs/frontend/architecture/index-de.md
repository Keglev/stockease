# Einfuehrung und Ziele

Das StockEase-Frontend ist die Oberflaeche, in der im Lager oder im Buero
gearbeitet wird: Es uebersetzt die Warenwirtschafts-Domaene des Backends in
Seiten, die sich bedienen lassen, ohne die dahinterliegende API zu kennen. Es
ist nach denselben Massstaeben gebaut wie das Backend - typisiert gegen den
generierten API-Vertrag, auf jeder Ebene getestet und mit der Begruendung
dokumentiert, die neben dem Code bleibt.

## Anforderungsueberblick

Die Anwendung deckt den Warenkreislauf aus Sicht der Bedienung ab:
Produktstammdaten, Lieferanten- und Kundenregister, Eingangs- und
Ausgangsrechnungen mit ihrem Lebenszyklus, die daraus entstehenden
Lagerbewegungen, ein Aenderungsprotokoll, das von einem Produkt oder einer
handelnden Person aus erreichbar ist, ein Berichtsbereich sowie
benutzerbezogene Einstellungen fuer Sprache und Theme. Eine oeffentliche
Landing-Page und ein Hilfebereich stehen daneben fuer Leser ohne Konto.

## Qualitaetsziele

1. **Die Oberflaeche erfindet keine fachlichen Wahrheiten.** Werte werden so
   dargestellt, wie das Backend sie meldet. Wo der Client rechnet -
   Diagramm-Aggregation, CSV-Export, Berichtssummen -, geschieht das aus
   geladenen Zeilen, und nichts wird zurueckgeschrieben.
2. **Beide Sprachen bleiben vollstaendig.** Bei Laufzeituebersetzung prueft kein
   Compiler, ob ein Schluessel existiert; deshalb erzwingt eine Paritaetspruefung
   ueber die ausgelieferten Bundles bei jedem Build Vollstaendigkeit und
   Reihenfolge in Englisch und Deutsch, und eine zweite Pruefung weist ein
   Bundle zurueck, das nicht mehr zu seinen gepflegten Quellen passt.
3. **Zugaenglich und lesbar auf jedem Viewport.** Helles und dunkles Theme
   entstehen aus Material-System-Tokens statt aus fest codierten Farben, und die
   Shell passt ihre Navigation an den Breakpoint an, statt auf dem Telefon ein
   Desktop-Layout zu zeigen.

## Stakeholder

Ein Solo-Entwickler, der fuer technische Gutachter baut: Recruiter und
Ingenieure, die Codequalitaet, Architekturbegruendung und Dokumentationspraxis
fuer den deutschen Markt bewerten. Die deutsche Oberflaeche ist Teil dieses
Nachweises, keine nachtraeglich hinzugefuegte Uebersetzung.

## Abgrenzung

Dieser Baum dokumentiert die Browser-Anwendung in `frontend/`: ihren Aufbau,
ihren Zustand, ihren Zugriff auf die API sowie Build und Tests. Er dokumentiert
nicht die fachlichen Regeln selbst - was eine Rechnung darf, wie die
Bestandsarithmetik abgesichert ist, was das Protokoll festhaelt -, die auf dem
Server entschieden und erzwungen werden und in der
[Backend-Architektur](../../backend/architecture/index-de.md) beschrieben sind.

Entscheidungen, die beide Seiten betreffen, stehen im systemweiten
[Entscheidungsprotokoll](../../decisions/index.md) und nicht in einem der beiden
Baeume.

Dieser Baum uebernimmt die Abschnittsnummern des Backend-Baums, wo ein Abschnitt
auf das Frontend zutrifft; die Luecken sind beabsichtigt: Randbedingungen,
Systemkontext und Glossar sind systemweit und werden einmal im Backend-Baum
dokumentiert.

## Dokumentationsuebersicht

- [Frontend-Architektur im Ueberblick](overview-de.md) -
  [English version](overview.md)
- [Bausteine](05-building-blocks.md) (EN)
- [Laufzeitsicht](06-runtime.md) (EN)
- [Verteilungssicht](07-deployment.md) (EN)
- [Uebergreifende Konzepte](08-concepts.md) (EN)
- [Qualitaetsanforderungen](10-quality-requirements.md) (EN)
- [Architekturentscheidungen](../../decisions/index.md) (EN)

[Zurueck zur Dokumentations-Startseite](/stockease/)
