# ADR 020: Losses Carry a Remark from a Fixed Taxonomy

**Status**: Accepted
**Date**: July 29, 2026

---

## Context

Every movement in the system says why it happened. PURCHASE and SOLD point at
the invoice line that caused them, the return reasons point at the item they
reverse, NEW_PRODUCT carries the cost basis of an opening balance. The reason
enum is the explanation, and it is enough - except for two members of it.

LOST and DESTROYED recorded that units left the building and stopped there. A
warehouse manager reading the loss report could see that four crates of drill
bits were written off and had no way to learn whether they expired, were
smashed in transit, arrived unusable from the supplier, or simply went missing
on site. Those are different problems with different owners: one is a
purchasing conversation, one is a carrier claim, one is a shelf-life policy.
The report totalled them into a single number labelled "loss".

Free text was the obvious first answer and the wrong one. A note field
produces "broken", "Broken", "kaputt" and "see mail from Tuesday" in the same
column, which is unreadable to a report and unusable as a filter.

## Decision

**LOST and DESTROYED movements carry a mandatory remark drawn from a fixed
taxonomy**: EXPIRED, IN_TRANSIT_TO_CUSTOMER, INTERNAL, FROM_SUPPLIER. Every
other reason forbids the field. A movement whose reason and remark disagree
does not exist.

**One taxonomy serves both reasons.** "What happened to it" has the same
answers whether the units are written off as lost or as destroyed, and the
distinction between the two reasons is about the units' fate, not its cause.
A shared list is also what keeps the loss report groupable across the pair -
two parallel enums would make "how much did expiry cost us" a question that has
to be asked twice and added up.

**The rule is enforced at three layers, and they are not redundant.** The form
adds and removes the control with the reason, so an invalid combination cannot
be expressed in the UI. The service validates the pair and answers with a
message an operator can act on, because the UI is not the only client. The
database CHECK - `(reason IN ('LOST','DESTROYED')) = (movement_remark IS NOT
NULL)` - makes the inconsistent pair unrepresentable, following V12's
counterparty constraint. Boolean equality states requiredness and prohibition
in one expression: the column is present exactly when the reason calls for it.

**The remark is informational for now.** Losses are valued identically
whichever remark they carry; the loss report's figures do not change with this
decision. What changes is that the data to group them by now exists.

## Alternatives considered

**Free-text note.** Rejected above: it optimizes for the writer and defeats
every reader. A taxonomy costs an occasional "none of these fit" and returns a
column that can be counted.

**Optional remark.** Rejected as the worst of both. Optional fields on
corrections go unfilled precisely when the day is busy, which is when losses
happen, so the data would be missing exactly where it matters and the report
would need an "unknown" bucket large enough to swamp the real ones.

**A separate loss-reason table.** Rejected as premature. A lookup table earns
its join when the values change without a deploy or carry attributes of their
own. These do neither yet; an enum with a CHECK is the cheaper form of the same
guarantee, and the migration to a table stays open.

**Per-reason taxonomies for LOST and DESTROYED.** Rejected: see above. It
splits one question across two lists for no gain.

## Consequences

- The loss report can group by cause when a requirement for it appears; no
  further modelling is needed, only the query.
- Recording a loss is one field slower. That is the intended trade: the field is
  the whole point of the change.
- Existing rows had no remark to recover, so V17 backfills them as INTERNAL -
  the neutral member, honest about saying nothing more than "a loss inside the
  business". The deployed data is the demo baseline, which the nightly reset
  (ADR 005) replaces wholesale, so the backfilled values live at most a day.
- Adding a taxonomy member is a migration-free enum change plus two translation
  keys. Removing one is not, and should be treated as the breaking change it is.

[Back to Decisions Index](index.md)
