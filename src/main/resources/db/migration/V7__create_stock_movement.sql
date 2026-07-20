-- Immutable audit trail of every quantity change, with money snapshots.

CREATE TABLE stock_movement (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
    user_id         BIGINT NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
    type            VARCHAR(16) NOT NULL,
    reason          VARCHAR(32) NOT NULL,
    quantity        INTEGER NOT NULL CHECK (quantity >= 1),
    -- Links a movement to the invoice line it fulfils. Required for
    -- PURCHASE and RETURNED_TO_SUPPLIER, NULL for every other reason;
    -- enforced in the service layer, not here, because the rule
    -- depends on the reason value.
    invoice_item_id BIGINT REFERENCES invoice_item(id) ON DELETE RESTRICT,
    -- Revenue snapshot per unit. Set only for SOLD (actual selling
    -- price, may be below cost) and RETURN_FROM_CUSTOMER (refund per
    -- unit, subtracted from revenue). NULL otherwise.
    sold_price      NUMERIC(12,2),
    -- Cost snapshot per unit. Set only for NEW_PRODUCT: initial stock
    -- has no invoice line, so the purchase price at creation time is
    -- captured here as its cost basis. For PURCHASE the cost lives on
    -- the referenced invoice_item.unit_price instead.
    unit_cost       NUMERIC(12,2),
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- Movements are queried per product, per user, over time ranges and
-- grouped by reason for the reporting endpoints.
CREATE INDEX idx_movement_product    ON stock_movement(product_id);
CREATE INDEX idx_movement_user       ON stock_movement(user_id);
CREATE INDEX idx_movement_created_at ON stock_movement(created_at);
CREATE INDEX idx_movement_reason     ON stock_movement(reason);
