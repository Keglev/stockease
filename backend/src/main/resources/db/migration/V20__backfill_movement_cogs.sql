-- Backfills the cost snapshot on historical sale and customer-return movements.
--
-- Gross profit now charges the cost of the units actually sold, read from unit_cost on the SOLD
-- movement (ADR 024). Rows written before that change carry no such snapshot, and the exact
-- purchase price at each historical sale was never recorded anywhere, so it cannot be recovered.
-- The CURRENT purchase price is therefore used as the approximation - it is exact for every
-- product whose price never moved, and the only alternative would be leaving historical sales with
-- a NULL cost, which reads as zero cost and overstates past profit.
--
-- This writes to the append-only movement ledger, which V18 established as something done only
-- deliberately and only in a migration; ADR 021 is the precedent and ADR 024 records this one.
UPDATE stock_movement
SET unit_cost = p.purchase_price
FROM product p
WHERE stock_movement.product_id = p.id
  AND stock_movement.reason IN ('SOLD', 'RETURN_FROM_CUSTOMER')
  AND stock_movement.unit_cost IS NULL;
