-- Payment is a financial fact orthogonal to the goods lifecycle: an invoice may be
-- paid before or after it is closed, so the column carries no status precondition.
-- Overdue stays derived (closed, unpaid, past due_date) and is never stored.

ALTER TABLE invoice ADD COLUMN paid_at TIMESTAMP NULL;
