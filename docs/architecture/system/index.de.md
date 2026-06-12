# Systemarchitektur — Index

**[English Version](./index.md)**

**Umfang**: Dieser Index umfasst das /system-Verzeichnis. Für Testdokumentation siehe [Testing Architecture](../testing/testing-architecture.md). Für Bereitstellung siehe das [deployment](../deployment/)-Verzeichnis.

---

## Dokumente in diesem Verzeichnis

### Übersicht
- [Architektur-Übersicht (Deutsch)](./overview.de.md) — Zusammenfassung, C4-Diagramme, Technologie-Stack, Designentscheidungen, API-Übersicht, Qualitätsattribute
- [Architecture Overview (English)](./overview.md) — English version

### Anwendungsarchitektur
- [Backend-Architektur](./backend.md) — Schichtenarchitektur, Projektstruktur, Controller/Service/Repository/Entity/Security-Code, DB-Migrationen, Konfiguration
- [Service-Schichten](./layers.md) — Schichtenverantwortlichkeiten, Datenflussdiagramme, Transaktionsgrenzen, Komponentenabhängigkeiten, Fehlerbehandlungsstrategie
- [Sicherheitsarchitektur](./security.md) — HTTPS/TLS, JWT-Ablauf, RBAC-Matrix, BCrypt, CORS, Eingabevalidierung, SQL-Injection-Prävention, Audit-Logging

### Integration
- [Frontend-Integration](./frontend-integration.md) — React-Architektur, Komponentenhierarchie, State Management, API-Integration, Authentifizierungsablauf, i18n, Dark Mode

---

## Lesepfade nach Rolle

**Neu im Projekt** — Beginnen Sie mit der [Architektur-Übersicht](./overview.de.md), dann [Backend-Architektur](./backend.md).

**Backend-Entwickler** — [Backend-Architektur](./backend.md) → [Service-Schichten](./layers.md) → [Sicherheitsarchitektur](./security.md).

**Sicherheit / DevOps** — [Sicherheitsarchitektur](./security.md) → [Backend-Architektur](./backend.md) → Bereitstellungsdokumentation.

**Frontend-Entwickler** — [Frontend-Integration](./frontend-integration.md) → [Sicherheitsarchitektur](./security.md) für JWT- und CORS-Details.

---

## Verwandte Verzeichnisse

- [Testing Architecture](../testing/testing-architecture.md) — Einstiegspunkt für alle Testdokumentation
- [Deployment](../deployment/) — CI/CD-Pipeline, Docker, Staging-Konfiguration
- [Entscheidungen (ADRs)](../decisions/) — Architekturentscheidungsaufzeichnungen
- [Muster](../patterns/) — Repository-Muster, Sicherheitsmuster
- [Komponenten](../components/) — Analytics-Service, Observability

---

**Zuletzt aktualisiert**: Juni 2026
**Status**: Aktuell

[Zurück zum Architektur-Index](../index.md)
