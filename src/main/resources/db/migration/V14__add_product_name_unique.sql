-- Case-insensitive name uniqueness for live products, mirroring the SKU rule in V9.

-- De-duplicate live names first: the public demo allows free-text product
-- creation, so production may already contain duplicates that would make
-- index creation fail. Later duplicates get a disambiguating id suffix.
UPDATE product SET name = name || ' #' || id
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY id) AS rn
    FROM product WHERE deleted_at IS NULL
  ) ranked WHERE rn > 1
);

-- Partial index on the lowercased name: uniqueness applies to LIVE products
-- only, so a soft-deleted product's name can be reused, exactly as with SKU.
CREATE UNIQUE INDEX uq_product_name ON product (LOWER(name))
    WHERE deleted_at IS NULL;
