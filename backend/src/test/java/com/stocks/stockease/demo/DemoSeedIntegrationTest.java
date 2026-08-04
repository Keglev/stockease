package com.stocks.stockease.demo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

import com.stocks.stockease.report.CashFlowReport;
import com.stocks.stockease.report.ProductProfitReport;
import com.stocks.stockease.report.ReportingService;
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

    @Autowired
    private ReportingService reportingService;

    @Autowired
    private DemoTemporalSpread temporalSpread;

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
    void cashFlow_afterSeeding_reportsMoneyInBothDirections() throws Exception {
        // the settled invoices are the whole point of seeding them: an all-unpaid baseline would leave
        // this report empty and prove nothing about it
        mockMvc.perform(get("/api/reports/cash-flow"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inflow", Matchers.greaterThan(0.0)))
                .andExpect(jsonPath("$.outflow", Matchers.greaterThan(0.0)))
                .andExpect(jsonPath("$.products", Matchers.hasSize(Matchers.greaterThanOrEqualTo(4))));
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
        // 14 carried the baseline before the cash-flow slice; the four settled invoices it added -
        // two purchases and two sales - are what give that report money in both directions (ADR 025)
        assertThat(count("invoice")).isEqualTo(18);
    }

    @Test
    void seededStock_afterSeeding_arrivesOnlyThroughPurchaseMovements() {
        // the vacuity guard for ADR 021: no movement may increase stock except a booked purchase
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stock_movement WHERE type = 'INCREASE' AND reason <> 'PURCHASE' "
                        + "AND reason <> 'RETURN_FROM_CUSTOMER'", Long.class)).isZero();
    }

    @Test
    void seededInvoices_afterSeeding_allCarryADistinctNonBlankNumber() {
        List<String> numbers = jdbcTemplate.queryForList(
                "SELECT invoice_number FROM invoice", String.class);

        assertThat(numbers).hasSize(18).doesNotContainNull().doesNotHaveDuplicates();
        assertThat(numbers).allSatisfy(number -> assertThat(number).isNotBlank());
    }

    @Test
    void seededProductPrice_afterSeeding_equalsItsLastClosedPurchaseLinePrice() {
        // product 0 is bought twice - 58.00 then 61.50 - so its price proves the derivation ran and
        // that the later close is the one that won
        BigDecimal price = jdbcTemplate.queryForObject(
                "SELECT purchase_price FROM product WHERE sku = 'WKZ-0001'", BigDecimal.class);

        assertThat(price).isEqualByComparingTo("61.50");
    }

    @Test
    void seed_always_spreadsMovementsAcrossPeriodBands() {
        long within30 = movementsWithinDays(30);
        long within90 = movementsWithinDays(90);
        long within180 = movementsWithinDays(180);

        // strictly widening, so a period preset selects a different set at each step rather than
        // three copies of one answer - which is the whole defect this spread exists to fix
        assertThat(within30).isPositive();
        assertThat(within90).isGreaterThan(within30);
        assertThat(within180).isGreaterThan(within90);
        assertThat(within180).isEqualTo(count("stock_movement"));
    }

    @Test
    void seed_always_spreadsPaidDatesAcrossBands() {
        // cash flow filters on the payment date, not the booking date (ADR 025), so its presets only
        // differ if the settlements are spread as well as the closes
        assertThat(paidBetweenDays(0, 30)).isPositive();
        assertThat(paidBetweenDays(30, 90)).isPositive();
        assertThat(paidBetweenDays(90, 365)).isPositive();
    }

    @Test
    void seed_always_preservesCausalOrdering() {
        assertThat(scalar("""
                SELECT COUNT(*) FROM stock_movement m JOIN product p ON p.id = m.product_id
                WHERE m.created_at < p.created_at
                """)).isZero();
        assertThat(scalar(
                "SELECT COUNT(*) FROM invoice WHERE paid_at IS NOT NULL AND paid_at < created_at")).isZero();
        assertThat(scalar("SELECT COUNT(*) FROM stock_movement WHERE created_at > now()")).isZero();
    }

    @Test
    void seed_periodWindows_yieldDifferentProfitAndCashFlow() {
        LocalDate from = LocalDate.now().minusDays(30);
        LocalDate today = LocalDate.now();

        List<ProductProfitReport> allTimeProfit = reportingService.profitPerProduct(null, null);
        List<ProductProfitReport> recentProfit = reportingService.profitPerProduct(from, today);
        CashFlowReport allTimeCash = reportingService.cashFlow(null, null);
        CashFlowReport recentCash = reportingService.cashFlow(from, today);

        // the user-visible fix: before the spread every window held everything, so these pairs were
        // equal and the presets looked broken
        assertThat(totalProfit(recentProfit)).isNotEqualByComparingTo(totalProfit(allTimeProfit));
        assertThat(recentCash.inflow()).isNotEqualByComparingTo(allTimeCash.inflow());
        assertThat(recentCash.outflow()).isNotEqualByComparingTo(allTimeCash.outflow());
        // still populated rather than merely different: an empty window would "differ" too
        assertThat(totalProfit(recentProfit)).isNotZero();
        assertThat(recentCash.inflow()).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void cashFlow_afterSeeding_netsThePaidSaleReturnOutOfInflow() {
        // Queried by invoice number and SKU rather than by id: the ids are whatever the sequence
        // hands out on this run, and naming the document is what makes a failure readable.
        assertThat(scalar("""
                SELECT ii.returned_qty FROM invoice_item ii
                JOIN invoice i ON i.id = ii.invoice_id
                JOIN product p ON p.id = ii.product_id
                WHERE i.invoice_number = 'AR-2026-0009' AND p.sku = 'BUE-0003'
                """)).isEqualTo(4L);

        CashFlowReport allTime = reportingService.cashFlow(null, null);

        // 2986.30 = 932.40 (AR-2026-0003) + 848.50 (AR-2026-0008) + 1205.40 (AR-2026-0009, whose
        // 20-unit line bills 16 after the return): the four returned units come off the inflow.
        assertThat(allTime.inflow()).isEqualByComparingTo(new BigDecimal("2986.30"));
        // Unchanged: the return sits on a sale, and no paid purchase line has a returned quantity.
        assertThat(allTime.outflow()).isEqualByComparingTo(new BigDecimal("4720.00"));
    }

    @Test
    void spread_withAPaymentBeforeItsInvoice_refusesTheHistory() {
        // AR-2026-0001 is placed by the age table but settled by nothing, so its payment date is the
        // one the spread will not move out from under this corruption
        jdbcTemplate.update("UPDATE invoice SET paid_at = created_at - INTERVAL '400 days'"
                + " WHERE invoice_number = 'AR-2026-0001'");

        assertThatThrownBy(temporalSpread::apply)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("1 payment(s) predate their invoice");
    }

    @Test
    void spread_withAMovementDatedAhead_refusesTheHistory() {
        // 100 days ahead outruns the 55 the LOST write-off is pulled back by, so the row is still in
        // the future once the spread has moved everything it moves
        jdbcTemplate.update("UPDATE stock_movement SET created_at = now() + INTERVAL '100 days'"
                + " WHERE reason = 'LOST' AND invoice_item_id IS NULL");

        assertThatThrownBy(temporalSpread::apply)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("1 movement(s) are dated in the future");
    }

    private static BigDecimal totalProfit(List<ProductProfitReport> rows) {
        return rows.stream().map(ProductProfitReport::grossProfit).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private long movementsWithinDays(int days) {
        return scalar("SELECT COUNT(*) FROM stock_movement WHERE created_at >= now() - INTERVAL '" + days + " days'");
    }

    private long paidBetweenDays(int fromDaysAgo, int toDaysAgo) {
        return scalar("SELECT COUNT(*) FROM invoice WHERE paid_at IS NOT NULL"
                + " AND paid_at <= now() - INTERVAL '" + fromDaysAgo + " days'"
                + " AND paid_at > now() - INTERVAL '" + toDaysAgo + " days'");
    }

    private long scalar(String sql) {
        Long rows = jdbcTemplate.queryForObject(sql, Long.class);
        return rows == null ? 0L : rows;
    }

    private long count(String table) {
        Long rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
        return rows == null ? 0L : rows;
    }
}
