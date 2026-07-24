-- Purchase-side schema: suppliers, immutable invoices, invoice lines.

CREATE TABLE supplier (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    address     VARCHAR(500) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

-- Invoices are immutable after creation: only lifecycle fields
-- (status, closed_by, closed_at) ever change, via service flows.
CREATE TABLE invoice (
    id            BIGSERIAL PRIMARY KEY,
    -- RESTRICT everywhere: deletion is handled as soft delete in the
    -- service layer; the FK is a safety net, not the delete mechanism.
    supplier_id   BIGINT NOT NULL REFERENCES supplier(id) ON DELETE RESTRICT,
    -- Enum stored as text (not ordinal) so reordering Java enum
    -- constants can never corrupt persisted rows.
    status        VARCHAR(32) NOT NULL,
    due_date      DATE NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    fine_value    NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- Audit: which admin closed the invoice, and when.
    closed_by     BIGINT REFERENCES app_user(id) ON DELETE RESTRICT,
    closed_at     TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE invoice_item (
    id           BIGSERIAL PRIMARY KEY,
    invoice_id   BIGINT NOT NULL REFERENCES invoice(id) ON DELETE RESTRICT,
    product_id   BIGINT NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
    quantity     INTEGER NOT NULL CHECK (quantity >= 1),
    -- Purchase price snapshot at invoice time; deliberately NOT a
    -- reference to product.purchase_price, which may change later.
    unit_price   NUMERIC(12,2) NOT NULL,
    -- Supplier returns accumulate here; can never exceed the ordered
    -- quantity. Full return across all lines flips the invoice to
    -- FULLY_RETURNED (service layer).
    returned_qty INTEGER NOT NULL DEFAULT 0
                 CHECK (returned_qty >= 0 AND returned_qty <= quantity),
    -- One line per product per invoice; repeat purchases raise quantity.
    UNIQUE (invoice_id, product_id)
);

CREATE INDEX idx_invoice_status   ON invoice(status);
CREATE INDEX idx_invoice_due_date ON invoice(due_date);
CREATE INDEX idx_invoice_item_invoice ON invoice_item(invoice_id);
