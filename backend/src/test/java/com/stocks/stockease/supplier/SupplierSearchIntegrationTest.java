package com.stocks.stockease.supplier;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.shared.SearchLimits;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the supplier typeahead search against a real database, where the cap and the soft-delete
 * restriction actually apply. Every method commits into a shared database, so each one searches on a
 * token of its own rather than asserting on the whole table.
 */
@SpringBootTest
@ActiveProfiles("test")
class SupplierSearchIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private SupplierService supplierService;

    /** Names are shared across committing tests, so each run takes a token nothing else matches. */
    private static final AtomicInteger RUNS = new AtomicInteger();

    private static String token() {
        return "Zzsearch" + RUNS.incrementAndGet();
    }

    @Test
    void searchByName_partialNameInAnyCase_matchesSubstring() {
        String token = token();
        supplierService.create("North " + token + " Trading", null, null, "1 Main St", null);

        // lower-cased and mid-name: the match is a case-insensitive substring, not a prefix
        List<Supplier> found = supplierService.searchByName(token.toLowerCase());

        assertThat(found).extracting(Supplier::getName).containsExactly("North " + token + " Trading");
    }

    @Test
    void searchByName_moreMatchesThanTheCap_returnsTheCapAlphabetically() {
        String token = token();
        // one more than the cap, created out of order so the ordering asserted is the query's
        for (int i = SearchLimits.TYPEAHEAD_LIMIT; i >= 0; i--) {
            supplierService.create(token + " %02d".formatted(i), null, null, "1 Main St", null);
        }

        List<Supplier> found = supplierService.searchByName(token);

        assertThat(found).hasSize(SearchLimits.TYPEAHEAD_LIMIT);
        // alphabetical, so the capped window is the same one on every run rather than arbitrary
        assertThat(found.get(0).getName()).isEqualTo(token + " 00");
        assertThat(found.getLast().getName()).isEqualTo(token + " %02d".formatted(SearchLimits.TYPEAHEAD_LIMIT - 1));
    }

    @Test
    void searchByName_softDeletedSupplier_isExcluded() {
        String token = token();
        Supplier live = supplierService.create(token + " Live", null, null, "1 Main St", null);
        Supplier retired = supplierService.create(token + " Retired", null, null, "1 Main St", null);
        supplierService.deleteById(retired.getId());

        List<Supplier> found = supplierService.searchByName(token);

        // a picker offers what can still be acted on; the entity's @SQLRestriction is what enforces it
        assertThat(found).extracting(Supplier::getId).containsExactly(live.getId());
    }

    @Test
    void searchByName_nothingMatching_returnsEmpty() {
        assertThat(supplierService.searchByName(token() + " nothing matches this")).isEmpty();
    }
}
