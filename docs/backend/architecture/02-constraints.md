# Constraints

## Technical

- **Free-tier hosting.** Koyeb and Supabase free tiers rule out a staging
  environment, a message broker, and anything requiring always-on background
  infrastructure. These are accepted trade-offs, not oversights - restraint
  decisions reference this constraint (ADR 007, ADR 010).
- **LTS-only runtime.** Java 21 and Spring Boot 4.x; major upgrades run as
  their own isolated change, never combined with other work.
- **Schema immutability.** Applied Flyway migrations are never edited; every
  schema concern is a new migration.

## Organizational

- **Solo development with review discipline.** No direct pushes to main:
  every change is a pull request against a protected branch with a required
  test gate, reviewed before squash-merging - main's history reads as a
  sequence of complete, explained changes.
- **Portfolio purpose.** The system targets technical reviewers in the
  German market; domain conventions (every sale invoiced, German document
  vocabulary) are requirements, not flavor.

[Back to Architecture Index](index.md)
