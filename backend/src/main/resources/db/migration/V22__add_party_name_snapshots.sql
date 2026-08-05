-- Invoices are documents, and a document states the party it was issued to or from. Until now the
-- name was read through the association at display time, which made it master data rather than
-- document content: deleting a supplier erased the counterparty from its own settled invoices, and
-- deleting a product made the invoice detail unreadable outright (ADR 033 records the measurements).
--
-- These columns snapshot the names at issuance. They are written once, when the invoice is created,
-- and never updated - renaming a supplier must not rewrite the history of documents already issued.

-- Nullable, both of them: a purchase names a supplier and no customer, a sale names a customer or
-- nobody at all (a walk-in cash sale). VARCHAR(255) matches supplier.name and customer.name.
ALTER TABLE invoice ADD COLUMN supplier_name VARCHAR(255);
ALTER TABLE invoice ADD COLUMN customer_name VARCHAR(255);

-- Added nullable, backfilled, then made NOT NULL below: every line has a product, so the snapshot
-- is mandatory once it exists, but it cannot be mandatory before the existing rows are filled.
ALTER TABLE invoice_item ADD COLUMN product_name VARCHAR(255);

-- Backfill by foreign key with plain UPDATE ... FROM. Deliberately NOT filtered on deleted_at:
-- these statements are native SQL and never see the entities' @SQLRestriction, so a party that was
-- already soft-deleted before this migration still hands over its name. Filtering here would leave
-- exactly the rows this change exists to fix without a snapshot - and product_name could then never
-- take its NOT NULL.
UPDATE invoice i SET supplier_name = s.name FROM supplier s WHERE s.id = i.supplier_id;
UPDATE invoice i SET customer_name = c.name FROM customer c WHERE c.id = i.customer_id;
UPDATE invoice_item ii SET product_name = p.name FROM product p WHERE p.id = ii.product_id;

-- A line whose product row is gone entirely - not soft-deleted, absent - cannot be recovered from
-- the database. No such row can exist today (product deletion is soft and the FK is enforced), so
-- this is a belt-and-braces fill that keeps the NOT NULL below from failing on data nobody expects.
UPDATE invoice_item SET product_name = 'Unknown product #' || product_id WHERE product_name IS NULL;

ALTER TABLE invoice_item ALTER COLUMN product_name SET NOT NULL;
