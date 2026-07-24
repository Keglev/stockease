package com.stocks.stockease.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

/**
 * Read model over the schema, answering aggregation questions with native SQL rather than through the
 * domain model. Reports are derived at read time and never stored.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportingService {

    /** Shown instead of a counterparty name for sale invoices that name no customer. */
    private static final String CASH_SALE = "Cash sale";

    // Historical report: soft-deleted products are INCLUDED (movements reference them regardless); the
    // deleted flag lets callers mark them.
    // Supplier-return recovery joins the invoice line because RETURNED_TO_SUPPLIER movements carry no
    // price snapshot of their own.
    private static final String PRODUCT_PROFIT_SELECT = """
            SELECT p.id, p.name, p.sku, (p.deleted_at IS NOT NULL) AS deleted,
              COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.sold_price
                                WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.sold_price
                                ELSE 0 END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN m.reason IN ('PURCHASE','NEW_PRODUCT') THEN m.quantity * m.unit_cost
                                WHEN m.reason = 'RETURNED_TO_SUPPLIER' THEN -m.quantity * ii.unit_price
                                ELSE 0 END), 0) AS cost
            FROM product p
            LEFT JOIN stock_movement m ON m.product_id = p.id
            LEFT JOIN invoice_item ii ON ii.id = m.invoice_item_id
            """;

    private static final String PRODUCT_PROFIT_GROUP = """
            GROUP BY p.id, p.name, p.sku, p.deleted_at
            ORDER BY p.id
            """;

    /** Outstanding value per invoice, netting out quantities already returned. */
    private static final String OUTSTANDING_SUBQUERY = """
            JOIN (SELECT ii.invoice_id, SUM((ii.quantity - ii.returned_qty) * ii.unit_price) AS outstanding
                  FROM invoice_item ii GROUP BY ii.invoice_id) t ON t.invoice_id = i.id
            """;

    private final JdbcClient jdbcClient;

    private static final RowMapper<ProductProfitReport> PRODUCT_PROFIT_MAPPER = (rs, rowNum) -> {
        BigDecimal revenue = rs.getBigDecimal("revenue");
        BigDecimal cost = rs.getBigDecimal("cost");
        return new ProductProfitReport(rs.getLong("id"), rs.getString("name"), rs.getString("sku"),
                rs.getBoolean("deleted"), revenue, cost, revenue.subtract(cost));
    };

    private static final RowMapper<InvoiceDueSummary> DUE_SOON_MAPPER = (rs, rowNum) -> new InvoiceDueSummary(
            rs.getLong("id"), rs.getString("invoice_type"), counterparty(rs.getString("counterparty")),
            rs.getObject("due_date", LocalDate.class), rs.getBigDecimal("outstanding"), null);

    private static final RowMapper<InvoiceDueSummary> OVERDUE_MAPPER = (rs, rowNum) -> new InvoiceDueSummary(
            rs.getLong("id"), rs.getString("invoice_type"), counterparty(rs.getString("counterparty")),
            rs.getObject("due_date", LocalDate.class), rs.getBigDecimal("outstanding"),
            rs.getLong("days_overdue"));

    /** An invoice naming neither supplier nor customer is an anonymous cash sale. */
    private static String counterparty(String name) {
        return name == null ? CASH_SALE : name;
    }

    /**
     * Returns gross profit for every product, including soft-deleted ones.
     *
     * @return one row per product, ordered by product ID
     */
    public List<ProductProfitReport> profitPerProduct() {
        return jdbcClient.sql(PRODUCT_PROFIT_SELECT + PRODUCT_PROFIT_GROUP).query(PRODUCT_PROFIT_MAPPER).list();
    }

    /**
     * Returns gross profit for one product.
     *
     * @param productId product identifier
     * @return the product's profit row, or empty if no such product exists
     */
    public Optional<ProductProfitReport> profitForProduct(long productId) {
        return jdbcClient.sql(PRODUCT_PROFIT_SELECT + "WHERE p.id = :id\n" + PRODUCT_PROFIT_GROUP)
                .param("id", productId)
                .query(PRODUCT_PROFIT_MAPPER)
                .optional();
    }

    /**
     * Returns gross profit attributed to each supplier across the products it has supplied.
     *
     * @return one row per supplier that has supplied at least one product, ordered by supplier ID
     */
    public List<SupplierProfitReport> profitPerSupplier() {
        // A product purchased from several suppliers counts fully for each of them - documented
        // simplification (gross profit model, no per-supplier cost allocation).
        String sql = """
                WITH product_profit AS (
                  SELECT p.id,
                    COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.sold_price
                                      WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.sold_price
                                      ELSE 0 END), 0) AS revenue,
                    COALESCE(SUM(CASE WHEN m.reason IN ('PURCHASE','NEW_PRODUCT') THEN m.quantity * m.unit_cost
                                      WHEN m.reason = 'RETURNED_TO_SUPPLIER' THEN -m.quantity * ii.unit_price
                                      ELSE 0 END), 0) AS cost
                  FROM product p
                  LEFT JOIN stock_movement m ON m.product_id = p.id
                  LEFT JOIN invoice_item ii ON ii.id = m.invoice_item_id
                  GROUP BY p.id
                ), supplier_products AS (
                  SELECT DISTINCT i.supplier_id, ii.product_id
                  FROM invoice i JOIN invoice_item ii ON ii.invoice_id = i.id
                  WHERE i.invoice_type = 'PURCHASE'
                )
                SELECT s.id, s.name, COALESCE(SUM(pp.revenue),0) AS revenue, COALESCE(SUM(pp.cost),0) AS cost
                FROM supplier s
                JOIN supplier_products sp ON sp.supplier_id = s.id
                JOIN product_profit pp ON pp.id = sp.product_id
                GROUP BY s.id, s.name
                ORDER BY s.id
                """;
        return jdbcClient.sql(sql).query((rs, rowNum) -> {
            BigDecimal revenue = rs.getBigDecimal("revenue");
            BigDecimal cost = rs.getBigDecimal("cost");
            return new SupplierProfitReport(rs.getLong("id"), rs.getString("name"), revenue, cost,
                    revenue.subtract(cost));
        }).list();
    }

    /**
     * Returns what each live product has sold and what it still holds.
     *
     * @return one row per live product, ordered by product ID
     */
    public List<StockStatusReport> stockStatus() {
        // Current-state report: soft-deleted products are EXCLUDED (their stock is not operational).
        String sql = """
                SELECT p.id, p.name, p.sku,
                  COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity
                                    WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity
                                    ELSE 0 END), 0) AS sold_units,
                  COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.sold_price
                                    WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.sold_price
                                    ELSE 0 END), 0) AS sold_revenue,
                  p.quantity AS in_stock_units,
                  p.quantity * p.purchase_price AS in_stock_value
                FROM product p
                LEFT JOIN stock_movement m ON m.product_id = p.id
                WHERE p.deleted_at IS NULL
                GROUP BY p.id, p.name, p.sku, p.quantity, p.purchase_price
                ORDER BY p.id
                """;
        return jdbcClient.sql(sql).query((rs, rowNum) -> new StockStatusReport(rs.getLong("id"),
                rs.getString("name"), rs.getString("sku"), rs.getInt("sold_units"),
                rs.getBigDecimal("sold_revenue"), rs.getInt("in_stock_units"),
                rs.getBigDecimal("in_stock_value"))).list();
    }

    /**
     * Returns units written off as lost or destroyed, valued at each product's current purchase price.
     *
     * @return one row per product with at least one loss movement, ordered by product ID
     */
    public List<LossReport> lossReport() {
        // Loss lines are valued at the product's CURRENT purchase price: pooled stock has no per-unit
        // cost, so this is a documented approximation consistent with the gross profit model.
        String sql = """
                SELECT p.id, p.name, p.sku, (p.deleted_at IS NOT NULL) AS deleted,
                  COALESCE(SUM(CASE WHEN m.reason = 'LOST' THEN m.quantity ELSE 0 END), 0) AS lost_units,
                  COALESCE(SUM(CASE WHEN m.reason = 'DESTROYED' THEN m.quantity ELSE 0 END), 0) AS destroyed_units,
                  SUM(m.quantity) * p.purchase_price AS loss_value
                FROM product p
                JOIN stock_movement m ON m.product_id = p.id AND m.reason IN ('LOST','DESTROYED')
                GROUP BY p.id, p.name, p.sku, p.deleted_at, p.purchase_price
                ORDER BY p.id
                """;
        return jdbcClient.sql(sql).query((rs, rowNum) -> new LossReport(rs.getLong("id"), rs.getString("name"),
                rs.getString("sku"), rs.getBoolean("deleted"), rs.getInt("lost_units"),
                rs.getInt("destroyed_units"), rs.getBigDecimal("loss_value"))).list();
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
                SELECT i.id, i.invoice_type, COALESCE(s.name, c.name) AS counterparty, i.due_date, t.outstanding
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
                SELECT i.id, i.invoice_type, COALESCE(s.name, c.name) AS counterparty, i.due_date, t.outstanding,
                  (CURRENT_DATE - i.due_date) AS days_overdue
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
}
