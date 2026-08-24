-- NEW_PRODUCT leaves the domain (ADR 021). Stock now increases only by closing a purchase invoice,
-- so an opening-balance movement - stock with a caller-supplied cost and no document behind it - has
-- no place left in the model.
--
-- The rows must go, not just the enum value. MovementReason no longer has a NEW_PRODUCT constant, so
-- any surviving row would fail enum mapping the moment something read it, turning a historical row
-- into a runtime error on an unrelated query.
--
-- The delete is FK-safe: nothing references stock_movement. It is the leaf of the movement graph -
-- it points at product, app_user and invoice_item, and no table points back at it.
--
-- Deleting history is acceptable here only because this data is demo-ephemeral: the deployed
-- database is the demo baseline, which the weekly reset (ADR 005) replaces wholesale, and the
-- reseeded baseline books its opening stock through closed purchase invoices instead.

DELETE FROM stock_movement WHERE reason = 'NEW_PRODUCT';
