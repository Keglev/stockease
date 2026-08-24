-- A loss with no recorded cause is the last movement the system could not explain: LOST and
-- DESTROYED said that units left, never why. The remark carries that reason from a fixed
-- taxonomy (ADR 020), so the answer is a value the reports can group by rather than free text.

-- Added nullable because existing rows have no value yet; the CHECK below is what makes it
-- required, and only for the two reasons that carry it.
ALTER TABLE stock_movement ADD COLUMN movement_remark VARCHAR(32);

-- Backfill before the constraint exists, or it would reject the very rows it is being added for.
-- Production rows predate the taxonomy, so no remark can be recovered for them: INTERNAL is the
-- neutral member of the taxonomy, honest about saying nothing more than "a loss inside the
-- business". The deployed data is the demo baseline, which the nightly reset replaces wholesale,
-- so these values survive at most one day.
UPDATE stock_movement SET movement_remark = 'INTERNAL' WHERE reason IN ('LOST', 'DESTROYED');

-- Boolean equality rather than two constraints: the left side is true exactly when the reason
-- carries a remark, the right side exactly when one is present, and requiring them to be equal
-- states requiredness and prohibition at once. An inconsistent pair - a LOST movement with no
-- remark, or a PURCHASE that carries one - is unrepresentable, mirroring V12's counterparty rule.
ALTER TABLE stock_movement ADD CONSTRAINT chk_movement_remark CHECK (
    (reason IN ('LOST', 'DESTROYED')) = (movement_remark IS NOT NULL)
);
