# Glossary

German commercial terms are first-class in this domain - the system models
German business practice, and the vocabulary appears in code, documents and
decisions.

| Term | Meaning in this system |
|------|------------------------|
| Warenwirtschaft | Merchandise management - the system's domain: goods, documents and stock, distinct from accounting. |
| Eingangsrechnung | Purchase invoice (type PURCHASE): supplier required, books stock IN on close. |
| Ausgangsrechnung | Sales invoice (type SALE): every sale is invoiced, following German practice; books stock OUT on close. |
| Barverkauf | Anonymous cash sale - a sales invoice with no customer attached. |
| Buchhaltung | Bookkeeping/accounting - the neighboring discipline deliberately outside scope: payment is recorded as a fact, financial arithmetic is never performed (ADR 011). |
| Chargenverwaltung | Lot/batch tracking - evaluated and rejected (ADR 010); stock is pooled. |
| Opening balance | The redefined NEW_PRODUCT movement: stock that predates any invoice in the system, with a caller-supplied cost basis. |
| Booking | The act of turning an invoice into stock movements - happens exactly once, at close. |
| Read model | The reporting module's bounded exemption from the domain model: native SQL, own records, read-only (ADR 006). |

[Back to Architecture Index](index.md)
