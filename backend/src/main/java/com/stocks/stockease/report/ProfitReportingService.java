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
 * Gross profit, per product and per supplier, derived at read time from the movement ledger.
 *
 * <p>One definition of gross profit serves both reports, which is why they live together: the reports
 * page shows them side by side, and a reader comparing a supplier's total against the products
 * underneath it must never find the two disagreeing. The shared SQL fragments below are what enforce
 * that - the supplier query reuses the product query's expressions and period join rather than
 * restating them.
 *
 * <p>Profit here is revenue minus the cost of goods SOLD, never cash spent on stock. Purchases and
 * supplier returns move cash rather than profit and are absent by design; they belong to
 * {@link CashFlowReportingService} (ADR 024, ADR 025).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProfitReportingService {

    // Historical report: soft-deleted products are INCLUDED (movements reference them regardless); the
    // deleted flag lets callers mark them.
    //
    // Cost is cost of goods SOLD, not cash spent on stock: only the units that left count, priced at
    // the cost their own sale captured, and a customer return reverses revenue and cost together at
    // the same prices. Purchases and supplier returns are absent by design - they move cash, not
    // profit, and belong to the cash-flow report (ADR 024). That also retired the invoice_item join,
    // which existed solely to price supplier returns.
    private static final String PRODUCT_PROFIT_EXPRESSIONS = """
            SELECT p.id, p.name, p.sku, (p.deleted_at IS NOT NULL) AS deleted,
              COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.sold_price
                                WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.sold_price
                                ELSE 0 END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.unit_cost
                                WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.unit_cost
                                ELSE 0 END), 0) AS cost
            FROM product p
            """;

    // The period predicate belongs to the JOIN, not to WHERE: in the WHERE clause it would discard
    // the NULL-extended rows the LEFT JOIN produces, so a product with no movements in the window
    // would vanish from the report instead of appearing with zeros. Casting the parameters lets one
    // statement serve the filtered and unfiltered calls. The window is a closed range of dates, so
    // the upper bound covers the whole of `to`.
    private static final String PRODUCT_PROFIT_JOIN = """
            LEFT JOIN stock_movement m ON m.product_id = p.id
              AND (CAST(:from AS date) IS NULL OR m.created_at >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR m.created_at < CAST(:to AS date) + INTERVAL '1 day')
            """;

    private static final String PRODUCT_PROFIT_SELECT = PRODUCT_PROFIT_EXPRESSIONS + PRODUCT_PROFIT_JOIN;

    private static final String PRODUCT_PROFIT_GROUP = """
            GROUP BY p.id, p.name, p.sku, p.deleted_at
            ORDER BY p.id
            """;

    // A product purchased from several suppliers counts fully for each of them - documented
    // simplification (gross profit model, no per-supplier cost allocation).
    // The per-product expressions repeat those of the product report on purpose: the two are one
    // definition of gross profit and the reports page shows them side by side, so they move
    // together (ADR 024). Only the shape around them differs - this one groups by supplier.
    // The period join is the product report's own constant rather than a copy of it, so the two
    // cannot answer the same period differently.
    private static final String SUPPLIER_PROFIT_SQL = """
            WITH product_profit AS (
              SELECT p.id,
                COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.sold_price
                                  WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.sold_price
                                  ELSE 0 END), 0) AS revenue,
                COALESCE(SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity * m.unit_cost
                                  WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity * m.unit_cost
                                  ELSE 0 END), 0) AS cost
              FROM product p
            """ + PRODUCT_PROFIT_JOIN + """
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

    private final JdbcClient jdbcClient;

    private static final RowMapper<ProductProfitReport> PRODUCT_PROFIT_MAPPER = (rs, rowNum) -> {
        BigDecimal revenue = rs.getBigDecimal("revenue");
        BigDecimal cost = rs.getBigDecimal("cost");
        return new ProductProfitReport(rs.getLong("id"), rs.getString("name"), rs.getString("sku"),
                rs.getBoolean("deleted"), revenue, cost, revenue.subtract(cost));
    };

    private static final RowMapper<SupplierProfitReport> SUPPLIER_PROFIT_MAPPER = (rs, rowNum) -> {
        BigDecimal revenue = rs.getBigDecimal("revenue");
        BigDecimal cost = rs.getBigDecimal("cost");
        return new SupplierProfitReport(rs.getLong("id"), rs.getString("name"), revenue, cost,
                revenue.subtract(cost));
    };

    /**
     * Returns gross profit for every product, including soft-deleted ones, over an optional period.
     *
     * <p>The period is a closed range of movement dates: a movement counts when it was recorded on
     * or between the two dates. Either bound may be null, which leaves that end open. Products
     * without movements in the window still appear, with zeros.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per product, ordered by product ID
     */
    public List<ProductProfitReport> profitPerProduct(LocalDate from, LocalDate to) {
        return jdbcClient.sql(PRODUCT_PROFIT_SELECT + PRODUCT_PROFIT_GROUP)
                .param("from", from)
                .param("to", to)
                .query(PRODUCT_PROFIT_MAPPER)
                .list();
    }

    /**
     * Returns gross profit for one product over an optional booking period.
     *
     * @param productId product identifier
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return the product's profit row, or empty if no such product exists
     */
    public Optional<ProductProfitReport> profitForProduct(long productId, LocalDate from, LocalDate to) {
        return jdbcClient.sql(PRODUCT_PROFIT_SELECT + "WHERE p.id = :id\n" + PRODUCT_PROFIT_GROUP)
                .param("id", productId)
                .param("from", from)
                .param("to", to)
                .query(PRODUCT_PROFIT_MAPPER)
                .optional();
    }

    /**
     * Returns gross profit attributed to each supplier across the products it has supplied, over an
     * optional period.
     *
     * <p>The period is a closed range of movement dates, exactly as the product reports read it: a
     * movement counts when it was recorded on or between the two dates. Either bound may be null,
     * which leaves that end open. Suppliers without movements in the window still appear, with zeros.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per supplier that has supplied at least one product, ordered by supplier ID
     */
    public List<SupplierProfitReport> profitPerSupplier(LocalDate from, LocalDate to) {
        return jdbcClient.sql(SUPPLIER_PROFIT_SQL)
                .param("from", from)
                .param("to", to)
                .query(SUPPLIER_PROFIT_MAPPER)
                .list();
    }
}
