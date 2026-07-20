-- Adds a stock keeping unit identifier to existing products.
ALTER TABLE product ADD COLUMN sku VARCHAR(64);

UPDATE product SET sku = 'SKU-' || id WHERE sku IS NULL;

ALTER TABLE product ALTER COLUMN sku SET NOT NULL;
