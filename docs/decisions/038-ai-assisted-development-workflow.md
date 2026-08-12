# ADR 038: AI-Assisted Development With Human Decision Authority

**Scope**: [Cross-cutting]
**Status**: Accepted
**Date**: August 12, 2026

---

## Context

This is a solo project held to standards that normally presuppose a team: an
internal size-and-style standard the code is measured against, arc42
documentation for both tiers, thirty-seven prior decision records, and a test
suite whose discipline is itself documented. One developer produced that volume
with AI assistance, and pretending otherwise in a portfolio project would
misrepresent how the work was done.

So the question was never whether to use AI assistance. It was what controls make
its output trustworthy, and what makes the authorship legible to a reviewer who
was not present. Both matter for different reasons. An assistant that writes
plausible code faster than a human can check it produces a codebase nobody
understands, which is a worse outcome than slower unassisted work. And a
repository that hides the assistance invites the reader to assume either more or
less human judgement than was actually applied.

The failure mode this decision guards against is specific and was observed
repeatedly: a language model produces confident, well-formed, wrong output, and
the wrongness is invisible at the diff level. It is caught by a machine that
disagrees - a test, a counter run a second way, a CI environment that differs
from the laptop - not by reading the change again.

## Decision

**Two roles, one decision authority.**

A conversational model acts as architect and reviewer. It is where designs are
argued, alternatives are rejected, premises are challenged, and specifications
are written. It produces no commits.

An editor-integrated agent executes those written specifications against the
repository. It reads the code, makes the change, runs the checks, and reports
what it did and where it deviated from the specification it was given.

**The owner makes every architecture and domain decision**, writes the standards
the code is held to, reviews every diff, and merges every pull request. Nothing
reaches `main` that the owner has not read. Where a specification turns out to be
wrong about the code, the agent stops and reports rather than making the change
fit - a stop is a successful outcome, and several of this repository's pull
requests are narrower than their specification because of it.

**The controls, as they actually operate here:**

- **One specification in flight at a time.** Work is serialized. A second change
  is not begun while a first is unreviewed, so no diff is ever judged against a
  moving base.
- **Premises are verified against a fresh clone before a specification is
  written.** A figure carried from an earlier conversation is treated as
  unverified. Several specifications in this repository's history were written
  against numbers that turned out to be stale, and the verification step is what
  found that rather than the review step.
- **Surveys precede fixes.** Where the work is corrective, findings are gathered
  and reported before any repair is designed, so the size of the problem is known
  before a solution is chosen and no fix is smuggled in as part of a survey.
- **A new test must be observed to fail before it is trusted.** A test written
  alongside the code it covers passes on arrival, which proves nothing. It is made
  to fail for the reason it exists, then made to pass.
- **Test assertions are not changed as a side effect.** Changing one is its own
  decision, taken explicitly and recorded. A refactoring pull request that alters
  an assertion is rejected on that ground alone.
- **CI gates the full suite and coverage thresholds** on both tiers, and the gate
  is not advisory: coverage floors fail the build, and a module-boundary violation
  fails it without a human in the loop.

## Alternatives considered

**Unassisted development.** Rejected on scope, not on principle. The
documentation, the decision records, and the test discipline recorded here are
what a reviewer is meant to assess, and a solo developer producing them
unassisted would have produced perhaps a third of it in the same time. The
interesting question for a portfolio is whether the judgement is sound, and
judgement is what the owner retains under this arrangement.

**Assistance without written specifications or review gates.** The common
arrangement: ask for a change, read the result, keep it if it looks right.
Rejected because "looks right" is exactly the filter this class of error passes
through. Confident wrong output is well-formed by construction. Without a written
specification there is nothing to hold the result against, and without a gate the
only check is the reading that the failure mode is designed to survive.

**Full delegation without human decision authority.** Letting the agent choose
scope, design, and when work is done. Rejected because the decisions worth
recording in this repository - the booking model, the storage contract, what a
domain module is - are the ones a model has no standing to make. It has no stake
in the consequences and no memory of why the last three attempts failed. The
decision records exist because those choices needed an owner.

**Code-generated API documentation.** A different question, recorded here because
it turns on the same principle: which artifact is authored and which is derived.
Generating the OpenAPI document from controller annotations, in the springdoc
style, was rejected. The document under `docs/backend/api` is the authored source
of truth for the HTTP contract, and the frontend's types are generated from it
(ADR 014); generating the document from code as well would produce a second
candidate contract, and the two would disagree the first time an annotation and
the specification drifted. A Swagger UI page was likewise not shipped. It would
render the same document the published Redoc reference already renders, so it adds
nothing for a reader, and its one distinguishing feature is interactive calls -
which on this deployment would mean a public page able to exercise twenty
write endpoints against a demo whose login endpoint is deliberately
credential-free.

## Consequences

The process is justified by what it caught, so three cases are recorded here with
what caught each. All three are verifiable in this repository.

**A test that passed on the laptop and failed only under CI.** Several services
resolve their startup state from browser storage at construction, and spec files
share a worker. A currency assertion in the customer-summary spec passed locally
and failed in CI on the same commit, because the test runner orders spec files
differently on different machines and the previous file's stored language was
still set. What caught it was the environment difference, not review: the change
was read and approved twice before CI disagreed. The repair was not the failing
assertion but the class - a global storage clear, documented in
`global-test-setup.ts`.

That case has a second half worth stating, because it shows the limit of a fix
that looks complete. Under coverage instrumentation in a shared worker, hooks
registered at a spec file's root level were observed not to run for most files -
in one reproduction the global clear ran for 31 of 795 tests, while hooks inside
a `describe` ran every time. The shortfall could not be reproduced on demand
afterwards. The per-file clears therefore stay, documented as load-bearing rather
than redundant, and the observation is recorded as one observation rather than as
a rule.

**A test that passed while proving nothing.** Two tests in the typeahead spec had
byte-identical bodies. Both passed, and both were correct - but the helper that
typed into the field dispatched a focus event before the keystroke, so the
focus-then-type case and the minimum-characters case exercised the same code
path. One of the two proved nothing the other did not, while reading as coverage
of a distinct behaviour. What caught it was reading the two bodies against their
names rather than against the code. The repair gave the focus case its own
stimulus and left the assertion untouched, which is the shape the
no-assertion-changes rule requires.

**A measurement script whose first run produced dozens of false findings.**
Counters written to survey the codebase are themselves untested code, and they
fail in the direction of confidence. One documentation-coverage check reported
forty-seven files as missing class documentation; every one was a false positive,
because the check stopped walking upward at a decorator's closing bracket instead
of stepping over the decorator to the comment above it. A separate template
counter over-reported file sizes wherever a multi-line comment appeared, which
moved two files across a threshold they had never crossed. What caught both was
re-measuring with a second, independently written method and finding the two
disagreed. The standing rule that every counter is validated against a known case
before its numbers are believed exists because this recurred, and it is now part
of the internal standard rather than a habit.

**Residual limits, stated plainly.**

- The controls catch what a machine can disagree with. A design that is coherent,
  tested, and wrong for the domain is not caught by any of them - only by the
  owner, which is why decision authority sits there and not in the process.
- Review effort scales with diff size, and the review is the binding constraint.
  A large mechanical change is reviewed less closely per line than a small one,
  whatever the intention.
- Test coverage of 99% on one tier says the lines ran, not that the assertions
  are meaningful. The typeahead case above is what that gap looks like, and it was
  found by reading, not by the number.
- This record describes the process as of its date. It is not a guarantee about
  any particular commit, and a reader assessing the work should read the diffs.

The commit history and the pull request record are the evidence. Each pull
request states what was verified, what was measured, and what was left undone,
including the cases where the specification was found to be wrong and the work
stopped short of it.

[Back to Decisions Index](index.md)
