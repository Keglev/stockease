package com.stocks.stockease.demo;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Pins how the emptiness check reads an unanswered count.
 *
 * <p>{@link DemoStartupSeedingIntegrationTest} owns both real outcomes - an empty catalogue seeds, a
 * populated one does not - against a live context and the actual readiness event. What no live
 * database can produce is the third case: {@code SELECT COUNT(*)} always returns a row, so the null
 * the query is nonetheless typed to allow is only reachable with the template stubbed.
 */
class DemoStartupSeederTest {

    @Test
    void seedOnEmptyDatabase_withUnansweredCount_seedsRatherThanSkipping() {
        // an unreadable count must not be mistaken for a populated catalogue: skipping on it would
        // leave a fresh deployment blank, which is the one outcome the seeder exists to prevent
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        DemoDataService demoDataService = mock(DemoDataService.class);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(null);

        new DemoStartupSeeder(jdbcTemplate, demoDataService).seedOnEmptyDatabase(null);

        verify(demoDataService).resetToBaseline();
    }
}
