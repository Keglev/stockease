-- The business identifier of an invoice: the supplier's document number on a purchase, the
-- operator's own number on a sale (ADR 022). The numeric id stays the technical and routing key.

-- Added nullable so existing rows can be filled before the NOT NULL takes effect.
ALTER TABLE invoice ADD COLUMN invoice_number VARCHAR(64);

-- Backfill: these rows predate the field, so no real document number can be recovered for them.
-- 'INV-' || id is unique by construction and obviously synthetic, which is the honest thing for a
-- number nobody assigned. The deployed database is the demo baseline, which the weekly reset
-- replaces wholesale with properly numbered invoices, so these values live at most a week.
UPDATE invoice SET invoice_number = 'INV-' || id WHERE invoice_number IS NULL;

ALTER TABLE invoice ALTER COLUMN invoice_number SET NOT NULL;

-- Partial index: uniqueness applies to LIVE invoices only, so a number whose old row is
-- soft-deleted can be issued again - a mistyped invoice is deleted and re-entered under the same
-- number. A plain unique constraint would block that forever. PostgreSQL-specific, exactly as
-- with the product SKU rule in V9.
CREATE UNIQUE INDEX uq_invoice_number ON invoice(invoice_number)
    WHERE deleted_at IS NULL;
