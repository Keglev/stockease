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
- No customer master-data management beyond reporting needs; demo data is
  fictional.

[Back to Domain Modules](index.md)
