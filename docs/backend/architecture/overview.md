# Backend Architecture

StockEase is a modular inventory management backend: products, suppliers,
customers, purchase and sales invoices, append-only stock movements, change
auditing and reporting in a single Spring Boot deployable.

> **This is a one-page summary.** For the structured arc42 documentation -
> introduction and goals, constraints, context, building blocks, runtime,
> deployment, concepts, decisions, quality, risks and glossary - see the
> [full architecture documentation](index.md).

## Technology stack

| Component        | Technology                        | Version |
|------------------|-----------------------------------|---------|
| Language         | Java                              | 21      |
| Framework        | Spring Boot                       | 4.1.0   |
| Modularity       | Spring Modulith                   | Boot-managed |
| Database         | PostgreSQL (Supabase)             | 16      |
| Migrations       | Flyway                            | Boot-managed |
| Testing          | JUnit 5, Mockito, Testcontainers  | Boot-managed |
| Build            | Maven                             | 3.x     |
| Container        | Docker                            | latest  |
| CI/CD            | GitHub Actions                    | -       |
| Hosting          | Koyeb                             | -       |

## Key architectural principles

- **Modular monolith.** Eight domain modules plus shared infrastructure in one
  deployable; boundaries are enforced by Spring Modulith and verified by a test
  on every build - not by convention.
- **Events inside the transaction.** Closing an invoice publishes an event; a
  synchronous listener books the stock movements in the same transaction.
  Either everything commits or nothing does.
- **Append-only records.** Invoices and movements are never edited. Corrections
  are new records: delete-and-recreate while open, return flows once closed.
- **Derived over stored.** Price snapshots are copied from invoice items at
  booking time; totals and overdue status are computed at read time, never
  persisted.
- **One schema owner.** Flyway owns the schema; Hibernate only validates it.

## Documentation map

- [Full arc42 documentation](index.md) (English) - [Deutsche Fassung](index-de.md)
- [Domain modules](05-domains/index.md)
- [Architecture decisions](09-decisions/index.md)
