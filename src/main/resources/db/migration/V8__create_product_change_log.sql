-- Field-level audit of mutable product attributes. Quantity is
-- deliberately NOT logged here: stock_movement is the single source
-- of quantity history.

CREATE TABLE product_change_log (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
    user_id     BIGINT NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
    -- Free text by design: values are stored as the user-visible
    -- rendering of the change, so new loggable fields need no
    -- schema change. Valid names are constrained in Java.
    field       VARCHAR(32) NOT NULL,
    old_value   VARCHAR(255),
    new_value   VARCHAR(255),
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_log_product ON product_change_log(product_id);
CREATE INDEX idx_change_log_user    ON product_change_log(user_id);
