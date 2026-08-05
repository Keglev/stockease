# Module: customer

Sales counterparties. A customer is optional on a sales invoice - an anonymous
cash sale (Barverkauf) is simply a sale without one (ADR 009).

## Exposed API

`Customer` entity and `CustomerService`.

## Internals

`CustomerRepository`.

## Invariants

- Email uniqueness holds only among live rows with an email set (partial
  index) - soft-deleted customers free their address.
- Name is the only required field; contact data is optional by design.
- Customers are editable master data: the record is replaced wholesale, and
  renaming one does not rewrite invoices already issued to them. Demo data is
  fictional.

[Back to Domain Modules](index.md)
