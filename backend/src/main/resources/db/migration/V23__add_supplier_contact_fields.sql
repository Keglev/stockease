-- Suppliers gain the contact fields the customer register has carried since V11. The two sides of
-- the ledger describe the same kind of party, and only one of them could record a phone number.
--
-- Widths mirror customer exactly - VARCHAR(255) for email and city, VARCHAR(50) for phone - so the
-- two tables stay comparable and neither drifts into its own conventions.
--
-- All three nullable, and no backfill: there is nothing to derive them from. Existing suppliers
-- simply have no email, phone or city until someone enters one, which is the same state a newly
-- created supplier is in. name and address stay NOT NULL - the supplier contract has always
-- required both, and this migration does not touch it.
--
-- No unique index on email, unlike uq_customer_email. That index exists because a customer's email
-- is how the sales side recognizes a returning buyer; nothing in the supplier flow looks a supplier
-- up by email, and a shared address at a parent company is ordinary rather than a mistake to block.
ALTER TABLE supplier ADD COLUMN email VARCHAR(255);
ALTER TABLE supplier ADD COLUMN phone VARCHAR(50);
ALTER TABLE supplier ADD COLUMN city VARCHAR(255);
