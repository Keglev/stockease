-- Adds the derived flag that scopes the low-stock alert to products that have ever held stock.
--
-- A product created as master data starts at zero (ADR 018) and a pure quantity threshold reported it
-- as low on the day it was created - an alert about something that was never stocked. The alert now
-- also requires this flag, which the purchase booking path sets and nothing ever clears (ADR 026).
--
-- The backfill derives the flag from the purchase ledger once; from here on the booking path maintains
-- it. This one-time cross-table read lives in the migration, where schema-wide knowledge is legitimate,
-- rather than in module code, where the product module reading the movement ledger would be exactly the
-- coupling the modulith structure exists to prevent.
ALTER TABLE product ADD COLUMN ever_stocked BOOLEAN NOT NULL DEFAULT false;

UPDATE product p SET ever_stocked = true WHERE EXISTS (
    SELECT 1 FROM stock_movement m WHERE m.product_id = p.id AND m.reason = 'PURCHASE');
