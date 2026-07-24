# Quality Requirements

Quality goals from the [introduction](index.md), made concrete and checkable.

## Correctness of stock arithmetic

Every quantity change flows through one pessimistically locked method that
rejects negative stock. The rollback story - a sale exceeding stock fails
its entire close - is exercised by an integration test through the real
event pipeline, not asserted on mocks.

## Verifiable boundaries

Module dependencies fail the build when violated: the Modulith boundary
test runs in every CI execution, without booting a context.

## Test discipline

The suite (265+ tests) combines unit tests, Spring slices, and integration
tests against real PostgreSQL via Testcontainers. Beyond coverage, the
suite uses deliberate test-quality techniques: controlled pairs and
sensitivity experiments (prove the test CAN fail), detachment proofs for
persistence effects, randomized execution order for committed fixtures, and
interlocking scenario numbers that make wrong implementations fail multiple
assertions at once. Design decisions at risk of well-meaning "fixes" - like
the reporting double-count (ADR 006) - are pinned by tests whose failure
message says so.

Coverage is published with every backend build - see the coverage report
linked in the sidebar.

[Back to Architecture Index](index.md)
