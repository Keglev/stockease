package com.stocks.stockease.report;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

/**
 * What stock did and what it is worth: one product's history, every product's current position, and
 * the units written off along the way.
 *
 * <p>All four reports are answerable only because the ledger is complete - stock enters and leaves
 * exclusively through booked movements (ADR 021) - so each of them re-reads the same movement rows
 * and only the grouping differs. They live together because a change to how a movement is
 * interpreted has to land in all of them at once.
 *
 * <p>Two rules recur and are deliberately not uniform. Whether soft-deleted products are included
 * depends on whether the report is historical or current: history and losses include them because
 * retiring a product does not unmake what it did, while the stock-status report excludes them
 * because their stock is not operational. And loss lines are valued at the product's CURRENT
 * purchase price, a documented approximation - pooled stock carries no per-unit cost.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StockReportingService {

    /** Native, so a soft-deleted product still answers: {@code @SQLRestriction} hides those from mapped queries. */
    private static final String PRODUCT_EXISTS_SQL = "SELECT 1 FROM product WHERE id = :id";

    // The window is applied AFTER the running sums, and that ordering is the whole correctness
    // of this query. Filtering the movements first would restart the count inside the window, so
    // a product bought a year ago and asked about over the last 30 days would appear to have
    // begun at zero. The sums run over every movement the product ever had; the outer WHERE only
    // decides which of the resulting points are returned.
    //
    // The sign comes from the movement's own persisted type rather than from a list of reasons
    // restated here. That column is written from MovementReason.getType(), which is the same
    // authority StockMovementService.recordMovement reads to compute its delta - so the two can
    // never disagree about which way a reason moves stock.
    private static final String STOCK_HISTORY_SQL = """
            WITH daily AS (
              SELECT CAST(m.created_at AS date) AS day,
                SUM(CASE WHEN m.type = 'INCREASE' THEN m.quantity ELSE -m.quantity END) AS net_change,
                SUM(CASE WHEN m.reason = 'SOLD' THEN m.quantity
                         WHEN m.reason = 'RETURN_FROM_CUSTOMER' THEN -m.quantity
                         ELSE 0 END) AS net_sold
              FROM stock_movement m
              WHERE m.product_id = :id
              GROUP BY CAST(m.created_at AS date)
            ), running AS (
              SELECT day,
                SUM(net_change) OVER (ORDER BY day) AS stock_level,
                SUM(net_sold) OVER (ORDER BY day) AS sold_units
              FROM daily
            )
            SELECT day, stock_level, sold_units
            FROM running
            WHERE (CAST(:from AS date) IS NULL OR day >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR day <= CAST(:to AS date))
            ORDER BY day
            """;

    // Current-state report: soft-deleted products are EXCLUDED (their stock is not operational).
    private static final String STOCK_STATUS_SQL = """
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

    // Loss lines are valued at the product's CURRENT purchase price: pooled stock has no per-unit
    // cost, so this is a documented approximation consistent with the gross profit model.
    //
    // The window joins the reason filter rather than sitting in a WHERE clause, as in the profit
    // queries - but here it narrows the report rather than preserving zero rows, because this
    // join is an INNER one. That is the existing semantics continued, not a new decision: the
    // unwindowed query already lists only products that lost something, so a product that lost
    // nothing in the window has nothing to report and drops out exactly as one that never lost
    // anything does. A losses report lists losses.
    private static final String LOSS_REPORT_SQL = """
            SELECT p.id, p.name, p.sku, (p.deleted_at IS NOT NULL) AS deleted,
              COALESCE(SUM(CASE WHEN m.reason = 'LOST' THEN m.quantity ELSE 0 END), 0) AS lost_units,
              COALESCE(SUM(CASE WHEN m.reason = 'DESTROYED' THEN m.quantity ELSE 0 END), 0) AS destroyed_units,
              SUM(m.quantity) * p.purchase_price AS loss_value
            FROM product p
            JOIN stock_movement m ON m.product_id = p.id AND m.reason IN ('LOST','DESTROYED')
              AND (CAST(:from AS date) IS NULL OR m.created_at >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR m.created_at < CAST(:to AS date) + INTERVAL '1 day')
            GROUP BY p.id, p.name, p.sku, p.deleted_at, p.purchase_price
            ORDER BY p.id
            """;

    // Same valuation rule as lossReport - units at the product's CURRENT purchase price - but
    // multiplied per row rather than once per group: that query groups by product, so one price
    // applies to the whole sum, while this one spans products and each row carries its own.
    //
    // Same date-window handling too, and the same absent-not-zeroed contract: the reason filter
    // sits in the WHERE clause and a remark nobody used in the window simply has no row. A
    // losses report lists losses, and the caller learns nothing from a row of zeroes.
    //
    // The product join carries no deleted_at filter, as in lossReport: a write-off happened
    // whether or not the product was retired afterwards, and dropping it would quietly shrink
    // a historical total.
    private static final String LOSSES_BY_REMARK_SQL = """
            SELECT m.movement_remark AS remark,
              COALESCE(SUM(CASE WHEN m.reason = 'LOST' THEN m.quantity ELSE 0 END), 0) AS lost_units,
              COALESCE(SUM(CASE WHEN m.reason = 'DESTROYED' THEN m.quantity ELSE 0 END), 0) AS destroyed_units,
              SUM(m.quantity * p.purchase_price) AS loss_value
            FROM stock_movement m
            JOIN product p ON p.id = m.product_id
            WHERE m.reason IN ('LOST','DESTROYED')
              AND (CAST(:from AS date) IS NULL OR m.created_at >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR m.created_at < CAST(:to AS date) + INTERVAL '1 day')
            GROUP BY m.movement_remark
            ORDER BY m.movement_remark
            """;

    private final JdbcClient jdbcClient;

    /**
     * Returns one product's stock level and cumulative sales over the days that moved it.
     *
     * <p>Derivable at all only because the ledger is complete: stock enters and leaves exclusively
     * through booked movements (ADR 021), and V18 removed the pre-ledger rows that once made the
     * running sum disagree with the product's own quantity. The final point therefore equals that
     * quantity, which is the invariant the tests pin.
     *
     * <p>A soft-deleted product still answers - what it did is history, and retiring it does not
     * unmake it.
     *
     * @param productId product identifier
     * @param from first day to return, or {@code null} for no lower bound
     * @param to last day to return, or {@code null} for no upper bound
     * @return the product's history within the window, oldest first, or empty if no such product
     *         exists; a product that never moved answers an empty list rather than an empty optional
     */
    public Optional<List<StockHistoryPoint>> stockHistory(long productId, LocalDate from, LocalDate to) {
        if (!productExists(productId)) {
            return Optional.empty();
        }
        return Optional.of(stockHistoryPoints(productId, from, to));
    }

    /** Runs the history query itself, once the product is known to exist. */
    private List<StockHistoryPoint> stockHistoryPoints(long productId, LocalDate from, LocalDate to) {
        return jdbcClient.sql(STOCK_HISTORY_SQL)
                .param("id", productId)
                .param("from", from)
                .param("to", to)
                .query((rs, rowNum) -> new StockHistoryPoint(rs.getObject("day", LocalDate.class),
                        rs.getInt("stock_level"), rs.getInt("sold_units")))
                .list();
    }

    /**
     * Returns what each live product has sold and what it still holds.
     *
     * @return one row per live product, ordered by product ID
     */
    public List<StockStatusReport> stockStatus() {
        return jdbcClient.sql(STOCK_STATUS_SQL).query((rs, rowNum) -> new StockStatusReport(rs.getLong("id"),
                rs.getString("name"), rs.getString("sku"), rs.getInt("sold_units"),
                rs.getBigDecimal("sold_revenue"), rs.getInt("in_stock_units"),
                rs.getBigDecimal("in_stock_value"))).list();
    }

    /**
     * Returns units written off as lost or destroyed over an optional period, valued at each
     * product's current purchase price.
     *
     * <p>The period is a closed range of movement dates, read the same way the profit report reads
     * them: a write-off counts when it was recorded on or between the two dates. Either bound may be
     * null, which leaves that end open.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per product with at least one loss movement in the window, ordered by product ID
     */
    public List<LossReport> lossReport(LocalDate from, LocalDate to) {
        return jdbcClient.sql(LOSS_REPORT_SQL)
                .param("from", from)
                .param("to", to)
                .query((rs, rowNum) -> new LossReport(rs.getLong("id"), rs.getString("name"),
                        rs.getString("sku"), rs.getBoolean("deleted"), rs.getInt("lost_units"),
                        rs.getInt("destroyed_units"), rs.getBigDecimal("loss_value")))
                .list();
    }

    /**
     * Returns write-offs grouped by the remark recorded against them.
     *
     * <p>The same losses {@link #lossReport} lists per product, re-aggregated by cause. The remark
     * taxonomy is shared by both write-off reasons precisely so this grouping is meaningful
     * (ADR 020); this method reads that decision rather than making one.
     *
     * @param from first booking date to count, or {@code null} for no lower bound
     * @param to last booking date to count, or {@code null} for no upper bound
     * @return one row per remark with at least one loss movement in the window, ordered by remark
     */
    public List<LossByRemark> lossesByRemark(LocalDate from, LocalDate to) {
        return jdbcClient.sql(LOSSES_BY_REMARK_SQL)
                .param("from", from)
                .param("to", to)
                .query((rs, rowNum) -> new LossByRemark(rs.getString("remark"), rs.getInt("lost_units"),
                        rs.getInt("destroyed_units"), rs.getBigDecimal("loss_value")))
                .list();
    }

    /**
     * Reports whether a product row exists at all, soft-deleted or not.
     *
     * <p>Native for the same reason {@link #stockHistory} is: {@code @SQLRestriction} hides retired
     * products from every mapped query, and a report asked about one should 404 only when there is
     * no such product, never because it has since been retired.
     *
     * @param productId product identifier
     * @return {@code true} if a product row carries that identifier
     */
    public boolean productExists(long productId) {
        return jdbcClient.sql(PRODUCT_EXISTS_SQL)
                .param("id", productId)
                .query(Integer.class)
                .optional()
                .isPresent();
    }
}
