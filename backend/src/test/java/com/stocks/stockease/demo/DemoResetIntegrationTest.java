package com.stocks.stockease.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.stocks.stockease.demo.web.DemoResetController;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the reset endpoint: the token is the only thing standing between a caller and a full wipe, and
 * the wipe itself must stop at the domain tables. The {@code app_user} comparison is the load-bearing
 * assertion - accounts survive a reset byte for byte, or the demo would log people out of their own
 * application.
 */
@SpringBootTest(properties = "app.demo.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DemoResetIntegrationTest extends AbstractIntegrationTest {

    /** Matches the value in {@code src/test/resources/application.properties}. */
    private static final String VALID_TOKEN = "test-demo-reset-token";

    private static final String MARKER_PRODUCT = "Demo Reset Marker Product";

    /** Outside the baseline's SKU ranges, so it can only collide with itself. */
    private static final String MARKER_SKU = "MRK-9001";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DemoDataService demoDataService;

    @Autowired
    private ProductService productService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seedBaselineAndMarkProgress() {
        demoDataService.resetToBaseline();
        productService.create(MARKER_PRODUCT, MARKER_SKU, 12.50);
    }

    /** All of {@code app_user} rendered row by row, so any change to any column shows up. */
    private List<String> appUserRows() {
        return jdbcTemplate.query("SELECT id, username, password, role FROM app_user ORDER BY id",
                (rs, rowNum) -> rs.getLong("id") + "|" + rs.getString("username") + "|"
                        + rs.getString("password") + "|" + rs.getString("role"));
    }

    private boolean markerExists() {
        Long rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM product WHERE name = ?", Long.class,
                MARKER_PRODUCT);
        return rows != null && rows > 0;
    }

    @Test
    void reset_withWrongToken_returns403AndLeavesDataUntouched() throws Exception {
        mockMvc.perform(post("/api/demo/reset").header(DemoResetController.RESET_TOKEN_HEADER, "not-the-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid or missing demo reset token."));

        assertThat(markerExists()).isTrue();
    }

    @Test
    void reset_withoutToken_returns403AndLeavesDataUntouched() throws Exception {
        mockMvc.perform(post("/api/demo/reset"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        assertThat(markerExists()).isTrue();
    }

    @Test
    void reset_withValidToken_wipesAndReseedsTheBaseline() throws Exception {
        mockMvc.perform(post("/api/demo/reset").header(DemoResetController.RESET_TOKEN_HEADER, VALID_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Demo data reset to the seeded baseline."));

        assertThat(markerExists()).isFalse();
        assertThat(count("product")).isEqualTo(12);
        assertThat(count("supplier")).isEqualTo(5);
        assertThat(count("invoice")).isEqualTo(13);
    }

    @Test
    void reset_withValidToken_leavesAppUserRowsByteIdentical() throws Exception {
        List<String> before = appUserRows();

        mockMvc.perform(post("/api/demo/reset").header(DemoResetController.RESET_TOKEN_HEADER, VALID_TOKEN))
                .andExpect(status().isOk());

        assertThat(appUserRows()).containsExactlyElementsOf(before);
    }

    private long count(String table) {
        Long rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
        return rows == null ? 0L : rows;
    }
}
