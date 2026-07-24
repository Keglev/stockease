-- Soft delete markers and the SKU uniqueness rule that depends on them.

ALTER TABLE product ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE supplier ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE invoice ADD COLUMN deleted_at TIMESTAMP;

-- Partial index: uniqueness applies to LIVE products only, so a SKU
-- whose old row is soft-deleted can be issued again. A plain unique
-- constraint would block re-creation forever. PostgreSQL-specific;
-- this is why the test suite runs against real PostgreSQL.
CREATE UNIQUE INDEX uq_product_sku ON product(sku)
    WHERE deleted_at IS NULL;
