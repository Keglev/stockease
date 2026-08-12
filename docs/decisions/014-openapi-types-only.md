# ADR 014: Types-Only Generation from the OpenAPI Spec

**Status**: Accepted
**Date**: July 28, 2026

---

**ERRATA (August 12, 2026)**: the Context below cited ADR 008 for the OpenAPI
document's source-of-truth status. That cross-reference is wrong. ADR 008 decides
the documentation structure - arc42 adoption, the docs tree layout, the ported
theme and build pipeline - and says nothing about the HTTP contract or about any
artifact being a source of truth. No other decision record establishes that status
either, so the claim stands on this record's own authority, which is where it was
first stated. The decision this ADR takes is unaffected and unchanged; only the
attribution was incorrect.

## Context

The OpenAPI document under `docs/backend/api` is the source of truth for the
HTTP contract (ADR 008 - see the errata above; the citation is incorrect and the
claim rests here). The frontend needs the same request and response shapes, and
hand-copying them guarantees drift.

Generation is the obvious answer, but the API's response shape is not uniform
and not accidentally so: some endpoints return a bare payload, others wrap it
in the shared envelope, and which is which is part of the contract each
endpoint agreed to. That knowledge has to live somewhere the tests can reach.

## Decision

**Generate types, not a client** (PR #70). `openapi-typescript` reads the spec
and emits `src/app/core/api/api-types.ts`; the generated file is committed, so
a clone builds without running the generator and a regeneration shows up as a
reviewable diff. Every service is hand-written on Angular's `HttpClient`,
typed from the generated definitions, and each one states in code which of its
calls are enveloped and which are bare.

The generator is invoked through an **isolated, exactly pinned `npx`**
(`npx --yes --package openapi-typescript@7.13.0`) rather than installed as a
devDependency. It declares a TypeScript 5 peer range while this workspace pins
TypeScript 6; adding it to the dependency tree would either force a resolution
conflict or pin the workspace's compiler to the generator's convenience. Run
out-of-tree, it is a tool that produces a file, not a dependency with an
opinion about the toolchain.

## Alternatives considered

**Full client generation.** Rejected: the generated client returns whatever
the spec's schema says and flattens the per-endpoint envelope decision into
uniform call sites. That knowledge is deliberately kept in the services, where
it is visible and unit-tested; regenerating it away would trade a tested
contract for boilerplate nobody reads.

**A generator devDependency.** Rejected on the peer-range conflict above. This
is the same class of coupling recorded in ADR 016 - a tool that pins the
framework or compiler version it will tolerate is a tool that decides when the
project may upgrade.

**Hand-written types.** Rejected: it is exactly the drift the spec exists to
prevent.

## Consequences

- `npm run gen:api` regenerates the file; the diff is the contract change.
- A backend response shape change surfaces as a TypeScript error in the
  services rather than as a runtime `undefined`.
- The envelope contract stays where it is asserted, one service at a time.

[Back to Decisions Index](index.md)
