package com.stocks.stockease.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.shared.SearchLimits;
import com.stocks.stockease.shared.SearchTerms;

import lombok.RequiredArgsConstructor;

/**
 * Reports read from the party side of an invoice: what is owed and when, what one customer has
 * bought, and what one supplier has sold this business.
 *
 * <p>These belong together because they all turn on the invoice's counterparty and its due date
 * rather than on stock, and because they share the outstanding-value definition below - what is
 * still owed on an invoice is its lines net of what has been returned, and the aging reports would
 * contradict each other if any of them computed that differently.
 *
 * <p>Owing is derived, never stored: an invoice is owed until it is marked paid, and overdue is
 * simply booked, unpaid and past due. A sale that names no customer is an anonymous cash sale and
 * carries the placeholder name rather than a blank.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CounterpartyReportingService {

    /** Shown instead of a counterparty name for sale invoices that name no customer. */
    private static final String CASH_SALE = "Cash sale";

    /**
     * The products one supplier has actually sold this business, matched by name.
     *
     * <p>The linkage runs through the purchase ledger rather than through master data, because there
     * is no supplier column on a product: a product belongs to whoever was invoiced for it. Stock
     * enters only through closed purchase invoices (ADR 021), so every stocked product is reachable
     * this way - and a product bought from two suppliers is reachable under both, which is correct
     * rather than a duplicate to be resolved. DISTINCT collapses the repeat purchases of one product
     * from one supplier, which is what makes this a picker rather than a purchase history.
     *
     * <p>Soft-deleted products are excluded, matching the product API's own search: this list exists
     * to be picked from, and a retired product is not something to start a new enquiry about. The
     * history endpoints still answer for one reached by identifier.
     */
    private static final String SUPPLIER_PRODUCT_SEARCH = """
            SELECT DISTINCT p.id, p.name, p.sku, p.quantity, p.purchase_price, p.created_at
            FROM invoice_item ii
            JOIN invoice i ON i.id = ii.invoice_id
            JOIN product p ON p.id = ii.product_id
            WHERE i.supplier_id = :supplierId
              AND i.invoice_type = 'PURCHASE'
              AND i.deleted_at IS NULL
              AND p.deleted_at IS NULL
            """;

    /**
     * One token's predicate, appended once per word the reader typed (ADR 035).
     *
     * <p>Built by concatenation because the SHAPE of the predicate depends on the term, which no
     * static query can express - but only the placeholder NAME is concatenated. Every value is still
     * bound, so a term is data here exactly as it was when it was one parameter.
     *
     * <p>Name OR SKU, matching the catalogue-wide product search. The two pickers sit on the same
     * screens and a reader has no way to tell which one is scoped, so they must answer the same way.
     */
    private static final String SUPPLIER_PRODUCT_TOKEN = """
              AND (p.name ILIKE '%%' || :%1$s || '%%' OR p.sku ILIKE '%%' || :%1$s || '%%')
            """;

    private static final String SUPPLIER_PRODUCT_ORDER = """
            ORDER BY p.name
            LIMIT :limit
            """;

    /** Outstanding value per invoice, netting out quantities already returned. */
    private static final String OUTSTANDING_SUBQUERY = """
            JOIN (SELECT ii.invoice_id, SUM((ii.quantity - ii.returned_qty) * ii.unit_price) AS outstanding
                  FROM invoice_item ii GROUP BY ii.invoice_id) t ON t.invoice_id = i.id
            """;

    private final JdbcClient jdbcClient;

    private static final RowMapper<InvoiceDueSummary> DUE_SOON_MAPPER = (rs, rowNum) -> new InvoiceDueSummary(
            rs.getLong("id"), rs.getString("invoice_number"), rs.getString("invoice_type"),
            counterparty(rs.getString("counterparty")), rs.getObject("due_date", LocalDate.class),
            rs.getBigDecimal("outstanding"), null);

    private static final RowMapper<InvoiceDueSummary> OVERDUE_MAPPER = (rs, rowNum) -> new InvoiceDueSummary(
            rs.getLong("id"), rs.getString("invoice_number"), rs.getString("invoice_type"),
            counterparty(rs.getString("counterparty")), rs.getObject("due_date", LocalDate.class),
            rs.getBigDecimal("outstanding"), rs.getLong("days_overdue"));

    private static final RowMapper<CustomerSummary> CUSTOMER_SUMMARY_MAPPER = (rs, rowNum) -> new CustomerSummary(
            rs.getLong("id"), rs.getString("name"), rs.getBoolean("deleted"), rs.getLong("sale_invoice_count"),
            rs.getLong("bought_units"), rs.getBigDecimal("bought_value"), rs.getLong("returned_units"),
            rs.getBigDecimal("returned_value"));

    private static final RowMapper<SupplierProduct> SUPPLIER_PRODUCT_MAPPER = (rs, rowNum) -> {
        BigDecimal price = rs.getBigDecimal("purchase_price");
        int quantity = rs.getInt("quantity");
        // Derived here rather than selected, matching how the product API mints the same field.
        return new SupplierProduct(rs.getLong("id"), rs.getString("name"), rs.getString("sku"), quantity, price,
                price == null ? null : price.multiply(BigDecimal.valueOf(quantity)),
                rs.getObject("created_at", LocalDateTime.class));
    };

    /** An invoice naming neither supplier nor customer is an anonymous cash sale. */
    private static String counterparty(String name) {
        return name == null ? CASH_SALE : name;
    }

    /**
     * Returns what one customer has bought and returned across its booked sale invoices.
     *
     * <p>Anonymous cash sales name no customer by construction, so they belong to no summary and are
     * invisible here.
     *
     * @param customerId customer identifier
     * @return the customer's summary, zero-filled if it has no booked sales, or empty if no such
     *         customer exists; a soft-deleted customer still reports, flagged as deleted
     */
    public Optional<CustomerSummary> customerSummary(long customerId) {
        // The invoice restriction lives in the JOIN condition, not in WHERE: moving it out would drop the
        // customer's own row whenever it has no booked sale, turning a zero-filled summary into "no such
        // customer". Soft-deleted invoices need no exclusion here - only OPEN invoices can be deleted, and
        // OPEN is already excluded.
        String sql = """
                SELECT c.id, c.name, (c.deleted_at IS NOT NULL) AS deleted,
                  COUNT(DISTINCT i.id) AS sale_invoice_count,
                  COALESCE(SUM(ii.quantity), 0) AS bought_units,
                  COALESCE(SUM(ii.quantity * ii.unit_price), 0) AS bought_value,
                  COALESCE(SUM(ii.returned_qty), 0) AS returned_units,
                  COALESCE(SUM(ii.returned_qty * ii.unit_price), 0) AS returned_value
                FROM customer c
                LEFT JOIN invoice i
                  ON i.customer_id = c.id AND i.invoice_type = 'SALE' AND i.status <> 'OPEN'
                LEFT JOIN invoice_item ii ON ii.invoice_id = i.id
                WHERE c.id = :id
                GROUP BY c.id, c.name, c.deleted_at
                """;
        return jdbcClient.sql(sql).param("id", customerId).query(CUSTOMER_SUMMARY_MAPPER).optional();
    }

    /**
     * Returns unpaid invoices grouped by due date and invoice type.
     *
     * @return one bucket per due date and type, ordered by due date
     */
    public List<DueDateBucket> dueDateBuckets() {
        // Unpaid, live invoices only; FULLY_RETURNED is excluded because nothing is owed on it.
        // Outstanding value nets out returned quantities.
        String sql = """
                SELECT i.due_date, i.invoice_type, COUNT(*) AS invoice_count,
                  COALESCE(SUM(t.outstanding), 0) AS total_value
                FROM invoice i
                """
                + OUTSTANDING_SUBQUERY
                + """
                WHERE i.paid_at IS NULL AND i.deleted_at IS NULL AND i.status <> 'FULLY_RETURNED'
                GROUP BY i.due_date, i.invoice_type
                ORDER BY i.due_date
                """;
        return jdbcClient.sql(sql).query((rs, rowNum) -> new DueDateBucket(
                rs.getObject("due_date", LocalDate.class), rs.getString("invoice_type"),
                rs.getLong("invoice_count"), rs.getBigDecimal("total_value"))).list();
    }

    /**
     * Returns unpaid invoices falling due within the given window.
     *
     * @param days size of the window in days from today
     * @return the matching invoices, ordered by due date
     */
    public List<InvoiceDueSummary> dueSoon(int days) {
        String sql = """
                SELECT i.id, i.invoice_number, i.invoice_type, COALESCE(s.name, c.name) AS counterparty,
                  i.due_date, t.outstanding
                FROM invoice i
                LEFT JOIN supplier s ON s.id = i.supplier_id
                LEFT JOIN customer c ON c.id = i.customer_id
                """
                + OUTSTANDING_SUBQUERY
                + """
                WHERE i.paid_at IS NULL AND i.deleted_at IS NULL AND i.status <> 'FULLY_RETURNED'
                  AND i.due_date <= CURRENT_DATE + :days
                ORDER BY i.due_date
                """;
        return jdbcClient.sql(sql).param("days", days).query(DUE_SOON_MAPPER).list();
    }

    /**
     * Returns invoices that are booked, unpaid and past their due date.
     *
     * @return the overdue invoices with how many days each is late, ordered by due date
     */
    public List<InvoiceDueSummary> overdue() {
        // The derived overdue predicate: booked (CLOSED), unpaid, past due. Never stored.
        String sql = """
                SELECT i.id, i.invoice_number, i.invoice_type, COALESCE(s.name, c.name) AS counterparty,
                  i.due_date, t.outstanding, (CURRENT_DATE - i.due_date) AS days_overdue
                FROM invoice i
                LEFT JOIN supplier s ON s.id = i.supplier_id
                LEFT JOIN customer c ON c.id = i.customer_id
                """
                + OUTSTANDING_SUBQUERY
                + """
                WHERE i.status = 'CLOSED' AND i.paid_at IS NULL AND i.deleted_at IS NULL
                  AND i.due_date < CURRENT_DATE
                ORDER BY i.due_date
                """;
        return jdbcClient.sql(sql).query(OVERDUE_MAPPER).list();
    }

    /**
     * Searches the products one supplier has sold this business, by a case-insensitive name match.
     *
     * <p>Discovery follows the supply relationship rather than the catalogue: the caller has already
     * named a supplier, and the useful next question is which of that supplier's products they mean.
     * See {@link #SUPPLIER_PRODUCT_SEARCH} for how the linkage is drawn and why a product bought from
     * two suppliers answers under both.
     *
     * <p>Every token of {@code term} must match the product's name or SKU, in any order (ADR 035),
     * exactly as the catalogue-wide search matches. A blank term matches everything the supplier has
     * sold, so it answers the first capped page alphabetically - which is what a focused, empty
     * picker browses, and the reason this endpoint no longer looks broken before it is typed into.
     *
     * @param supplierId supplier identifier
     * @param term search term, whitespace-separated; may be blank
     * @return the supplier's matching products, alphabetical, capped for typeahead use; empty if the
     *         supplier has bought nothing matching, or empty optional if no such live supplier exists
     */
    public Optional<List<SupplierProduct>> supplierProducts(long supplierId, String term) {
        // Mapped-query semantics on purpose, unlike the product check in StockReportingService: this
        // list is a picker, and a soft-deleted supplier is not one to start a new enquiry against.
        Integer found = jdbcClient.sql("SELECT 1 FROM supplier WHERE id = :id AND deleted_at IS NULL")
                .param("id", supplierId)
                .query(Integer.class)
                .optional()
                .orElse(null);
        if (found == null) {
            return Optional.empty();
        }

        List<String> tokens = SearchTerms.tokenize(term);
        StringBuilder sql = new StringBuilder(SUPPLIER_PRODUCT_SEARCH);
        for (int i = 0; i < tokens.size(); i++) {
            sql.append(SUPPLIER_PRODUCT_TOKEN.formatted("token" + i));
        }
        sql.append(SUPPLIER_PRODUCT_ORDER);

        var statement = jdbcClient.sql(sql.toString())
                .param("supplierId", supplierId)
                .param("limit", SearchLimits.TYPEAHEAD_LIMIT);
        for (int i = 0; i < tokens.size(); i++) {
            statement = statement.param("token" + i, tokens.get(i));
        }
        return Optional.of(statement.query(SUPPLIER_PRODUCT_MAPPER).list());
    }
}
