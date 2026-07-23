# Module: shared

Cross-module web infrastructure - deliberately small.

## Exposed API

`ApiResponse` and `PaginatedResponse` envelope records.

## Web layer

`GlobalExceptionHandler` and `HealthController` in `shared.web`.

## Invariants

- No domain logic, no entities, no events - anything with domain meaning
  belongs to a domain module.

[Back to Domain Modules](index.md)
