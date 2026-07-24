-- Sales invoices alongside purchase invoices: a customer counterparty
-- instead of a supplier, with an optional customer for anonymous cash sales.

ALTER TABLE invoice ADD COLUMN invoice_type VARCHAR(16) NOT NULL DEFAULT 'PURCHASE';
ALTER TABLE invoice ALTER COLUMN invoice_type DROP DEFAULT;

ALTER TABLE invoice ALTER COLUMN supplier_id DROP NOT NULL;

ALTER TABLE invoice ADD COLUMN customer_id BIGINT REFERENCES customer(id) ON DELETE RESTRICT;

-- Purchase invoices always name a supplier and never a customer; sale
-- invoices never name a supplier and may or may not have a customer.
ALTER TABLE invoice ADD CONSTRAINT chk_invoice_counterparty CHECK (
    (invoice_type = 'PURCHASE' AND supplier_id IS NOT NULL AND customer_id IS NULL)
    OR (invoice_type = 'SALE' AND supplier_id IS NULL)
);
