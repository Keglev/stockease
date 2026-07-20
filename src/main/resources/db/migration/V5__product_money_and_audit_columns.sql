-- Money as NUMERIC, creation timestamp, drop stored derived total.
ALTER TABLE product RENAME COLUMN price TO purchase_price;

ALTER TABLE product ALTER COLUMN purchase_price SET DATA TYPE NUMERIC(12,2);

ALTER TABLE product ADD COLUMN created_at TIMESTAMP DEFAULT now();

ALTER TABLE product ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE product DROP COLUMN total_value;
