# ADR 037: Translations Are Authored Per Namespace and Assembled at Build Time

**Scope**: [Frontend]
**Status**: Accepted
**Date**: August 12, 2026

---

## Context

The application ships two translation bundles, `en.json` and `de.json`, each 581
lines carrying 413 leaf keys across 19 top-level namespaces. Every key the
frontend renders lives in one of those two files, and both are edited by hand.

That shape costs on two fronts. Any two branches adding keys touch the same
file per language, so a key change is a merge-conflict candidate by default -
not because the changes conflict in meaning, but because they land in one
document. And finding a key means scrolling a large document rather than
opening the file named for the feature.

The safety net is thinner than it looks. ngx-translate resolves keys as strings
at runtime; there is no compiler check that a key exists, and a missing one
surfaces as the key itself rendered into the page (ADR 015). What substitutes
for that check is the EN/DE parity spec, which pins both membership and
ordering across the two bundles. Ordering is part of the contract, not a
formatting preference: it is what makes a diff between the languages readable
and what catches a key appended to one side and forgotten on the other.

## Decision

**Translations are authored as one file per namespace per language**, under
`frontend/src/i18n/en/` and `frontend/src/i18n/de/`, each file containing that
namespace's body. **`frontend/src/i18n/namespaces.json` is the manifest**: an
ordered array naming the namespaces, and that order is the key order of the
assembled bundle.

**`frontend/tools/build-i18n.mjs` assembles the two runtime files at build
time.** The assembled bundles remain committed under `public/i18n/`, and CI
re-assembles them on every frontend pull request and fails on any difference.

The runtime contract is unchanged. One HTTP fetch per language, the same paths,
the same bytes. Nothing in the application knows the sources exist; this is a
change to how the artifact is produced, not to what is served.

## Why namespace granularity specifically

A split boundary that cut through a dynamically-constructed key would be
invisible to every check the project has, because such keys are never written
out in full anywhere. The protected dynamic prefixes - `audit.field.*`,
`invoices.status.*`, the `*.columns.*` family and the rest - each resolve
entirely within a single top-level namespace. Splitting at namespace boundaries
therefore cannot cut one, whatever else changes: the constraint is satisfied by
construction, not by remembering to respect it.

The manifest carries the same property for ordering. Because the assembler
walks the manifest to build each bundle, and both languages walk the same
manifest, the parity spec's ordering assertion cannot be broken by an authoring
mistake - only by editing the manifest, which is a visible one-line diff.

## Alternatives considered

**A runtime multi-file loader.** ngx-translate can be given a loader that
fetches several files per language and merges them. Rejected: it turns one
request per language into nineteen, requires custom loader code to maintain,
and introduces load-timing behaviour where there currently is none - all to buy
an authoring benefit the build-time split already delivers without touching
runtime at all.

**Lazy per-feature translation scopes.** Loading each feature's translations
with the feature. Rejected as disproportionate: it is an architectural change to
how the application boots, justified when translation payloads are large enough
to matter for load time. At 413 keys they are not.

**Gitignoring the assembled bundles.** Author the sources, generate the
artifacts, keep them out of the repository. Rejected because their correctness
would then depend on which command each environment happens to run - the CI
runner's build, the Vercel preview build, a local `ng serve`, and the test run
are four different entry points, and a missing hook in any of them produces an
application with no translations. That failure appears at runtime, in front of
a user, rather than at review time. Committing the artifacts and gating them
moves the failure to the pull request, where it is cheap.

**Status quo.** Rejected: the merge-conflict surface and the navigation cost
are real and grow with every namespace, and nothing about them improves on its
own.

## Consequences

- 38 small files replace 2 large ones. A key change touches the file named for
  its feature, and two branches editing different features no longer collide.
- The EN/DE parity spec is unchanged and still reads the shipped bundles. That
  is deliberate: it asserts against the artifact the browser actually fetches,
  which is the thing whose correctness matters.
- Adding a namespace requires a manifest entry as well as two source files. The
  assembler fails loudly if either half is missing. This friction is intended -
  a new top-level namespace is a decision, and the manifest is where it is
  recorded.
- The drift gate is the only thing standing between a hand-edited artifact and
  `main`. If that step is removed or skipped, an edit to `public/i18n/en.json`
  survives until the next assembly silently reverts it.

[Back to Decisions Index](index.md)
