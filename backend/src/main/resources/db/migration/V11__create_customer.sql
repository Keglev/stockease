-- Sales-side counterpart to supplier: customers on SALE invoices.
-- Anonymous walk-in sales simply carry no customer reference.

CREATE TABLE customer (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(50),
    address     VARCHAR(500),
    city        VARCHAR(255),
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMP
);

-- Partial index: uniqueness applies only to live customers who have an
-- email, mirroring uq_product_sku - a soft-deleted customer's email can
-- be re-registered, and customers without an email never collide.
CREATE UNIQUE INDEX uq_customer_email ON customer (email)
    WHERE email IS NOT NULL AND deleted_at IS NULL;
