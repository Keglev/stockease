import { HelpTopic } from './help-content.types';

/**
 * English help prose. Its German twin is help-content.de.ts, and help-content.spec.ts pins that the
 * two carry the same topics in the same order with the same section ids (ADR 029).
 *
 * <p>Three role claims in here were written from the feature descriptions and then checked against
 * the controllers before shipping; where the code disagreed, the prose changed rather than the
 * code. The comments at those paragraphs say what was found, so the next edit does not quietly
 * restore the wrong version.
 */
export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    id: 'overview',
    sections: [
      {
        id: 'kpis',
        heading: 'The four numbers at the top',
        paragraphs: [
          'The overview page starts with four key figures: Products, Low stock, Overdue invoices and Gross profit. A negative gross profit is shown in the error color so it stands out.',
          'Low stock only counts products that have been stocked at least once. A product you created but never purchased is treated as new, not as low. Click the Low stock figure to open a list of the affected products with name, SKU and current quantity.'
        ]
      },
      {
        id: 'cards',
        heading: 'Profit and due-date cards',
        paragraphs: [
          'The profit card shows gross profit per product and can be switched between a chart and a table. The due-date card shows upcoming and overdue invoices, either as a chart of due-date buckets or as a short list of the next invoices.',
          'Use the refresh button to reload all figures at once.'
        ]
      }
    ]
  },
  {
    id: 'products',
    sections: [
      {
        id: 'basics',
        heading: 'Managing products',
        paragraphs: [
          // Corrected against ProductController: createProduct is @PreAuthorize("hasRole('ADMIN')"),
          // but updateName and updatePrice both accept ADMIN or USER. Editing is not admin-only.
          "The product list shows every product with its SKU, quantity and purchase price. Creating a product is reserved for administrators; correcting a product's name is open to both roles.",
          'The purchase price is not edited freely in day-to-day work: it is updated automatically when a purchase invoice is closed, so it always reflects the last real purchase.'
        ]
      },
      {
        id: 'lifecycle',
        heading: 'Deleting and history',
        paragraphs: [
          // Corrected: deletion is admin-only, but there is no restore endpoint. ProductService has
          // a restore method; no controller exposes it, so nobody can restore from the application.
          'Deleting a product is reserved for administrators. A deleted product is hidden from daily work but remains part of the history: reports and past invoices still show it, marked as deleted. Deletion cannot be undone from within the application.',
          'Every change to a product is recorded. From the product list you can open the change history to see who changed what and when.'
        ]
      }
    ]
  },
  {
    id: 'invoices',
    sections: [
      {
        id: 'types',
        heading: 'Purchase and sale invoices',
        paragraphs: [
          'Stock enters and leaves the system through invoices. A purchase invoice adds stock when it is closed; a sale invoice removes stock when it is closed. The invoice number is assigned by you, matching your paper or ERP numbering.'
        ]
      },
      {
        id: 'lifecycle',
        heading: 'From open to closed',
        paragraphs: [
          // Verified against InvoiceController: closeInvoice, markInvoiceAsPaid and deleteInvoice
          // are all hasRole('ADMIN'). Claim holds as written.
          "An invoice starts as Open and can be edited. Closing it books the stock movements and, for purchases, updates each product's purchase price. Closing, deleting an open invoice and marking an invoice as paid are administrator actions.",
          'Each invoice has a due date. Overdue unpaid invoices are marked with a chip in the list and counted on the overview page.'
        ]
      },
      {
        id: 'returns',
        heading: 'Returns',
        paragraphs: [
          // Verified against ReturnController: registerReturn is hasAnyRole('ADMIN', 'USER').
          'Returns are recorded on the invoice itself: open a closed invoice and return part or all of a line as long as units remain. Both roles can record returns. A fully returned invoice is marked accordingly.'
        ]
      }
    ]
  },
  {
    id: 'movements',
    sections: [
      {
        id: 'purpose',
        heading: 'What this page is for',
        paragraphs: [
          'The stock movements page records losses only: goods that were lost or destroyed. Pick the product, the reason and the quantity; a remark is always required so the loss can be explained later.',
          'Nothing else is booked here. Purchases and sales are booked by closing invoices, and returns are recorded on the invoice itself. This keeps every movement traceable to its document.'
        ]
      }
    ]
  },
  {
    id: 'reports',
    sections: [
      {
        id: 'tabs',
        heading: 'The seven tabs',
        paragraphs: [
          'Reports are organized in seven tabs: Profit, Cash flow, Stock, Losses, Due dates, Changes and Analytics.'
        ],
        bullets: [
          'Profit: gross profit per product, with the cost captured at the moment of sale — later price changes do not rewrite past profit.',
          'Cash flow: money actually paid, not booked. Only paid invoices count, shown as totals, a monthly timeline and a per-product table.',
          'Stock: current stock value per product.',
          'Losses: lost and destroyed goods in the selected period.',
          'Due dates: upcoming and overdue invoices with their numbers.',
          'Changes: the most recent product changes across all users.',
          'Analytics: price and stock history for a single product.'
        ]
      },
      {
        id: 'controls',
        heading: 'Periods, filters and export',
        paragraphs: [
          'Most tabs share the same controls: a period (30, 90 or 180 days, this year, or everything), a switch between chart and table, and a text filter over name and SKU. The CSV export always mirrors exactly what the filter currently shows.'
        ]
      },
      {
        id: 'analytics',
        heading: 'Analytics',
        paragraphs: [
          "In Analytics you first pick a supplier, then one of that supplier's products — type at least three letters to search — and press Show. You get the purchase price over time and the stock level against sold units."
        ]
      }
    ]
  },
  {
    id: 'partners',
    sections: [
      {
        id: 'both',
        heading: 'Suppliers and customers',
        paragraphs: [
          'Suppliers and customers work the same way: a list with paging, where partners are created and edited, and each invoice is linked to exactly one partner.',
          "From the customer list you can open a summary showing that customer's purchases. Supplier pickers across the app are search-first: type at least three letters and choose from the matches."
        ]
      }
    ]
  },
  {
    id: 'demo',
    sections: [
      {
        id: 'access',
        heading: 'Trying the demo',
        paragraphs: [
          'On the start page you can enter the demo with one click, either as Administrator or as User — no password needed. A DEMO badge in the toolbar reminds you which system you are in.'
        ]
      },
      {
        id: 'data',
        heading: 'Demo data and reset',
        paragraphs: [
          'The demo contains realistic sample data spread over the past months, so time-based reports show meaningful history. All demo data is reset every Monday at 03:00 UTC; feel free to change anything.'
        ]
      },
      {
        id: 'roles',
        heading: 'What the roles may do',
        paragraphs: [
          // Narrowed from "manage products": creating and deleting are admin-only, editing is not.
          'Administrators create and delete products, and control the invoice lifecycle: closing, marking as paid, deleting open invoices. Users can browse everything, write invoices, correct product names, record returns and record losses.'
        ]
      }
    ]
  },
  {
    id: 'language-theme',
    sections: [
      {
        id: 'toggles',
        heading: 'Language and theme',
        paragraphs: [
          'The toolbar offers two toggles: one switches the interface between English and German, the other between light and dark. Both apply immediately, and both are also available on the public pages before you sign in.'
        ]
      }
    ]
  }
];
