package com.stocks.stockease.audit;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.stocks.stockease.audit.internal.ProductChangeLogRepository;

import lombok.RequiredArgsConstructor;

/**
 * Read side of the product change log; the write side is the event listener that records changes
 * as they happen. Other modules depend on this service rather than reaching into the repository.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditService {

    /**
     * Most rows the changes listing will return.
     *
     * <p>This feeds a report view, not an export: a reader scans the recent history, and an
     * unbounded log would grow the payload without bound as the system ages. Raising the ceiling is
     * a one-constant change if a period ever legitimately holds more than this.
     */
    private static final int CHANGES_LIMIT = 500;

    /**
     * Enriched change rows, newest first, over an optional closed range of change dates.
     *
     * <p>Native and hand-mapped rather than JPQL, for the reason every report query is: {@code Product}
     * carries an {@code @SQLRestriction} that hides soft-deleted rows from every mapped query, and a
     * change made to a product that was retired afterwards is still a change that happened. The two
     * joins also make the N+1 question moot - one statement returns every column the report renders,
     * so no lazy association is ever touched.
     */
    private static final String CHANGES_SQL = """
            SELECT c.id, p.id AS product_id, p.name AS product_name, p.sku,
              (p.deleted_at IS NOT NULL) AS product_deleted, u.username, c.field,
              c.old_value, c.new_value, c.created_at
            FROM product_change_log c
            JOIN product p ON p.id = c.product_id
            JOIN app_user u ON u.id = c.user_id
            WHERE (CAST(:from AS date) IS NULL OR c.created_at >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR c.created_at < CAST(:to AS date) + INTERVAL '1 day')
            ORDER BY c.created_at DESC, c.id DESC
            LIMIT :limit
            """;

    private static final RowMapper<ChangeLogEntryResponse> CHANGES_MAPPER = (rs, rowNum) ->
            new ChangeLogEntryResponse(rs.getLong("id"), rs.getLong("product_id"),
                    rs.getString("product_name"), rs.getString("sku"), rs.getBoolean("product_deleted"),
                    rs.getString("username"), ChangedField.valueOf(rs.getString("field")),
                    rs.getString("old_value"), rs.getString("new_value"),
                    rs.getObject("created_at", LocalDateTime.class));

    private final ProductChangeLogRepository productChangeLogRepository;
    private final JdbcClient jdbcClient;

    /**
     * Returns every product change a user made, newest first.
     *
     * @param userId user identifier
     * @return that user's change log entries ordered by creation time descending
     */
    public List<ProductChangeLog> findChangesByUser(long userId) {
        return productChangeLogRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    /**
     * Returns the full change history of one product, newest first.
     *
     * @param productId product identifier
     * @return that product's change log entries ordered by creation time descending
     */
    public List<ProductChangeLog> findChangesByProduct(long productId) {
        return productChangeLogRepository.findByProductIdOrderByCreatedAtDesc(productId);
    }

    /**
     * Returns recent product changes across the system, newest first, enriched with the username and
     * the product's identity.
     *
     * <p>The period is a closed range of change dates, read as every other report reads its window.
     * At most {@value #CHANGES_LIMIT} rows come back.
     *
     * @param from first change date to include, or {@code null} for no lower bound
     * @param to last change date to include, or {@code null} for no upper bound
     * @return the newest changes in the window, ordered by change time descending
     */
    public List<ChangeLogEntryResponse> findChanges(LocalDate from, LocalDate to) {
        return jdbcClient.sql(CHANGES_SQL)
                .param("from", from)
                .param("to", to)
                .param("limit", CHANGES_LIMIT)
                .query(CHANGES_MAPPER)
                .list();
    }
}
