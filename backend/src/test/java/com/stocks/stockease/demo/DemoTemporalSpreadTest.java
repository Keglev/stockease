package com.stocks.stockease.demo;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Pins the two readings of the coherence check that no seeded database can produce.
 *
 * <p>{@link DemoSeedIntegrationTest} owns the rest against real data: it corrupts a real timestamp and
 * proves the spread refuses to hand the result back. Two arms of the check are out of its reach, and
 * both are out of reach for the same reason - the step immediately before the check derives the data
 * the arm looks at:
 * <ul>
 *   <li>a movement predating its product cannot survive {@code shiftProducts}, which sets every
 *       product's creation from the earliest movement that touches it, so no product with movements
 *       can end up younger than one;</li>
 *   <li>a count query that answers nothing cannot happen either - {@code SELECT COUNT(*)} always
 *       returns a row - yet the query is typed to allow it, and what the code does with that answer
 *       decides whether an unreadable database passes as coherent.</li>
 * </ul>
 * Stubbing the template is what makes both statable at all; it is not a substitute for the real proof.
 */
class DemoTemporalSpreadTest {

    /** Distinctive fragment of the first counting query, the only one this class raises. */
    private static final String MOVEMENTS_BEFORE_PRODUCT = "JOIN product p ON p.id = m.product_id";

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);

    private final DemoTemporalSpread temporalSpread = new DemoTemporalSpread(jdbcTemplate);

    /** Answers every count with zero, so a single arm can then be raised on its own. */
    private void allCountsCoherent() {
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);
    }

    @Test
    void apply_withMovementsPredatingTheirProduct_refusesTheHistory() {
        allCountsCoherent();
        when(jdbcTemplate.queryForObject(contains(MOVEMENTS_BEFORE_PRODUCT), eq(Long.class))).thenReturn(2L);

        assertThatThrownBy(temporalSpread::apply)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("2 movement(s) predate their product");
    }

    @Test
    void apply_withUnansweredCounts_treatsThemAsNoViolationRatherThanFailing() {
        // a null count is read as zero, not thrown on: the check reports violations it can see, and
        // an unanswerable query is not one of them
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(null);

        assertThatCode(temporalSpread::apply).doesNotThrowAnyException();
    }
}
