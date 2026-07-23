# Module: security

Authentication and the user model: JWT-based stateless auth, plus the web
security infrastructure (filter chain, CORS, entry point).

## Exposed API

`User`, `UserService` (findByUsername - controllers resolve their principal
here), and the security configuration classes wiring the JWT filter chain.

## Internals

`UserRepository`.

## Invariants

- Stateless JWT (ADR 003); passwords BCrypt-hashed.
- Controllers never touch the user repository - principal resolution goes
  through the exposed service.

[Back to Domain Modules](index.md)
