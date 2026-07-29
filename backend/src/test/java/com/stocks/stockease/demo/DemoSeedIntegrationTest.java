package com.stocks.stockease.demo;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the coverage the seeded baseline promises: every reporting endpoint has something to show, and
 * the three views with an explicit threshold - low stock, overdue, due soon - are populated on purpose
 * rather than by accident.
 */
@SpringBootTest(properties = "app.demo.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "julia.brandt", roles = {"ADMIN"})
class DemoSeedIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DemoDataService demoDataService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seedBaseline() {
        demoDataService.resetToBaseline();
    }

    /** Asserts the endpoint answers 200 with a JSON array holding at least {@code minimum} entries. */
    private void expectAtLeast(String path, int minimum) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", Matchers.hasSize(Matchers.greaterThanOrEqualTo(minimum))));
    }

    @Test
    void profitReports_afterSeeding_returnRowsForProductsAndSuppliers() throws Exception {
        expectAtLeast("/api/reports/profit/products", 12);
        expectAtLeast("/api/reports/profit/suppliers", 5);
    }

    @Test
    void stockAndLossReports_afterSeeding_returnRows() throws Exception {
        expectAtLeast("/api/reports/stock-status", 12);
        // one LOST and one DESTROYED product, so the loss report can never be empty
        expectAtLeast("/api/reports/losses", 2);
    }

    @Test
    void dueDateBuckets_afterSeeding_spanSeveralDates() throws Exception {
        expectAtLeast("/api/reports/due-dates", 5);
    }

    @Test
    void overdue_afterSeeding_returnsAtLeastTwoRows() throws Exception {
        // CLOSED, unpaid and past due - the derived predicate the report uses
        expectAtLeast("/api/reports/overdue", 2);
    }

    @Test
    void dueSoon_afterSeeding_returnsAtLeastTwoRowsInTheDefaultWindow() throws Exception {
        // default window is seven days and has no lower bound, so the overdue rows qualify too
        expectAtLeast("/api/reports/due-soon", 2);
    }

    @Test
    void customerSummary_afterSeeding_reportsBookedSales() throws Exception {
        Long customerId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM customer", Long.class);

        mockMvc.perform(get("/api/reports/customers/" + customerId + "/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.saleInvoiceCount", Matchers.greaterThanOrEqualTo(1)));
    }

    @Test
    void lowStock_afterSeeding_returnsAtLeastOneProductUnderTheThreshold() throws Exception {
        // the threshold is a hardcoded, exclusive 5 in ProductController; one product is seeded at 3
        expectAtLeast("/api/products/low-stock", 1);
    }

    @Test
    void seededCatalogue_afterSeeding_holdsTheFullBaseline() {
        assertThat(count("product")).isEqualTo(12);
        assertThat(count("supplier")).isEqualTo(5);
        assertThat(count("customer")).isEqualTo(5);
        // 14, not 13: the copier paper's stock used to come from an opening-balance movement and now
        // needs a closed purchase invoice of its own (ADR 021)
        assertThat(count("invoice")).isEqualTo(14);
    }

    @Test
    void seededStock_afterSeeding_arrivesOnlyThroughPurchaseMovements() {
        // the vacuity guard for ADR 021: no movement may increase stock except a booked purchase
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stock_movement WHERE type = 'INCREASE' AND reason <> 'PURCHASE' "
                        + "AND reason <> 'RETURN_FROM_CUSTOMER'", Long.class)).isZero();
    }

    @Test
    void seededProductPrice_afterSeeding_equalsItsLastClosedPurchaseLinePrice() {
        // product 0 is bought twice - 58.00 then 61.50 - so its price proves the derivation ran and
        // that the later close is the one that won
        BigDecimal price = jdbcTemplate.queryForObject(
                "SELECT purchase_price FROM product WHERE sku = 'WKZ-0001'", BigDecimal.class);

        assertThat(price).isEqualByComparingTo("61.50");
    }

    private long count(String table) {
        Long rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
        return rows == null ? 0L : rows;
    }
}
