-- Removes the 'admin' account seeded by V3. Its password ('admin123') is hardcoded in
-- V3__seed_data.java and therefore public in this repository's history, so the account is a
-- standing credential leak wherever the migration has run - production included. It is replaced
-- by BootstrapAdminInitializer, which provisions a personal admin from environment variables at
-- startup; no credential ever enters the repository again.
--
-- The dependent rows go first because every reference to app_user(id) is declared
-- ON DELETE RESTRICT (V6 invoice.closed_by, V7 stock_movement.user_id, V8 product_change_log.user_id).
-- Deleting the account while any of them still points at it aborts the migration, so the references
-- are cleared in dependency order and the account is deleted last.
--
-- closed_by is nulled rather than the invoice deleted: an invoice is business data, not the
-- account's data. It belongs to a supplier or customer and stays valid without knowing who closed
-- it, whereas deleting it would cascade through its items and the stock movements they produced,
-- destroying real history to remove a leaked login. The column is nullable by design (V6), so
-- nulling it costs only the audit attribution on the invoices this one account closed.

UPDATE invoice SET closed_by = NULL WHERE closed_by = (SELECT id FROM app_user WHERE username = 'admin');

DELETE FROM product_change_log WHERE user_id = (SELECT id FROM app_user WHERE username = 'admin');

DELETE FROM stock_movement WHERE user_id = (SELECT id FROM app_user WHERE username = 'admin');

DELETE FROM app_user WHERE username = 'admin';
