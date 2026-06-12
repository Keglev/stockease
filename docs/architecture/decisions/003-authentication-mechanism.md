# ADR 003: Authentication Mechanism

**Status**: Accepted
**Date**: October 31, 2025

---

## Context

StockEase exposes REST APIs consumed by a separate React frontend deployed on a different domain. Users must authenticate and the system must enforce role-based access control (ADMIN vs USER). A decision was needed on the authentication mechanism: stateless JWT tokens or server-side sessions.

Requirements: support cross-origin requests (frontend on Vercel, backend on Koyeb), no shared session store between container replicas, work with auto-scaling, support role-based authorization per request, and be implementable with Spring Security.

---

## Decision

**JWT (JSON Web Token) bearer tokens** with HS256 signing, 10-hour expiry, role claim embedded in the payload, and validation via `JwtFilter` in the Spring Security filter chain.

---

## Rationale

### Stateless design fits the deployment model

Koyeb scales the backend horizontally to 1–2 replicas. Session-based authentication requires a shared session store (Redis or sticky sessions) so that any replica can validate a session. JWT is self-contained — each token carries the user identity and role, so any replica can validate it independently using the shared secret. No external session store is needed.

### Cross-origin compatibility

The frontend (Vercel) and backend (Koyeb) are on different domains. Browser session cookies do not work reliably across origins without complex configuration. JWT tokens sent as `Authorization: Bearer` headers work cleanly across origins with standard CORS configuration.

### Role authorization per request

The JWT payload includes a `role` claim. `JwtFilter` validates the token and calls `CustomUserDetailsService.loadUserByUsername()` on every authenticated request to populate the Spring `SecurityContext`, enabling `@PreAuthorize("hasRole('ADMIN')")` enforcement without an extra authorization lookup.

### BCrypt for password storage

Passwords are hashed with BCrypt (cost factor 10) before storage. The JWT secret and database credentials are injected via environment variables — never hardcoded.

---

## Alternatives Considered

**Session-based authentication with Spring Session** — rejected. Requires a shared session store (Redis) to support multiple replicas, adds infrastructure complexity, and does not work well across origins without sticky sessions or cookie configuration.

**OAuth2 / OpenID Connect (e.g. Auth0, Keycloak)** — rejected for current scope. Adds significant infrastructure and configuration overhead that is not justified for a single-tenant inventory application with two roles. Can be adopted later if multi-tenancy or social login is needed.

**HTTP Basic Authentication** — rejected. Requires sending credentials on every request, no expiry mechanism, no role embedding, not suitable for SPA clients.

---

## Consequences

**Positive**: stateless design supports horizontal scaling with no shared state, cross-origin requests work cleanly, no session store infrastructure needed. Role authorization is enforced per request via the `SecurityContext` populated by `JwtFilter`.

**Negative**: tokens cannot be invalidated before expiry without a token blacklist (not currently implemented). If the JWT secret is compromised, all tokens are compromised until the secret is rotated and all users re-authenticate. Token expiry (24 hours) is a fixed trade-off between security and user convenience.

---

## Security Constraints

- JWT secret must be 32+ characters, randomly generated, stored only as an environment variable
- Tokens expire after 10 hours (hardcoded `EXPIRATION_TIME = 36000000` ms)
- HTTPS enforced in production — tokens must never travel over plain HTTP
- Failed authentication returns 401 with a generic message — no information about whether the username or password was wrong

---

## Implementation Status

- `JwtUtil` — token generation and validation — implemented
- `JwtFilter` — filter chain integration — implemented
- `SecurityConfig` — stateless session policy, public/protected endpoint rules — implemented
- BCrypt password encoding (cost factor 10) — implemented
- Environment variable injection for JWT secret — implemented

---

[Back to Decisions Index](./index.md)
