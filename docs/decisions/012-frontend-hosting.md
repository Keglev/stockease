# ADR 012: Frontend Hosting on a CDN, Not a Container

**Status**: Accepted
**Date**: July 28, 2026

---

## Context

The backend is a Spring Boot deployable that Koyeb builds from the repository
Dockerfile and runs as a container (ADR 007, section 07). The Angular frontend
is a different kind of artifact: a static single-page application - HTML, CSS,
JavaScript and locale files - that talks to that backend over HTTPS. The
question is whether the same containerized deployment path should carry it.

## Decision

**The frontend is served from Vercel's CDN** at
[bestandskontrolle.vercel.app](https://bestandskontrolle.vercel.app), deployed
by its own workflow (PR #51) and not from a container.

A static bundle needs no server process. Putting one in front of it - nginx in
an image, a health check, a container to size and keep warm - buys nothing the
CDN does not already provide: edge caching, HTTPS with managed certificates,
and a preview deployment per pull request come with the platform rather than
with configuration this repository would own.

The deployment paths are separate on purpose. The frontend workflow gates on
the frontend test suite; a backend release does not redeploy the SPA and a
frontend release does not restart the API. Each side ships when its own checks
are green.

## Alternatives considered

**Serving the SPA from the backend container.** Rejected: it couples every
frontend fix to a backend redeploy and puts static-asset caching, compression
and SPA fallback routing into Spring's responsibility, where they are
configuration to maintain rather than platform behaviour.

**A separate frontend container on Koyeb.** Rejected: an nginx image and its
config file to maintain, paying for a running process to hand out files a CDN
serves closer to the user for free.

## Consequences

- No web-server configuration lives in this repository.
- The frontend's production URL is a platform concern; the backend's CORS
  policy names it as an allowed origin (PR #66).
- A frontend Dockerfile remains a queued item for local-run parity only -
  bringing the SPA up alongside the API in one compose command. It is not a
  production deployment path, and this decision is why.

[Back to Decisions Index](index.md)
