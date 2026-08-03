package com.stocks.stockease.demo;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins what the startup seeder promises on either side of its emptiness check: a fresh deployment
 * comes up with a populated demo, and a restart of a running one changes nothing.
 *
 * <p>The readiness signal is published into the live context rather than the listener being called
 * directly, so the {@code @EventListener} wiring is part of what the test proves - a seeder the
 * container never dispatches to would leave a fresh deployment blank and still pass a direct call.
 *
 * <p>Both cases were previously only reachable by accident. Whether the shared container happened to
 * hold products when this module's context started decided which branch ran, so the seeding path -
 * the one a first deployment depends on - was the one that went unexercised.
 */
@SpringBootTest(properties = "app.demo.enabled=true")
@ActiveProfiles("test")
class DemoStartupSeedingIntegrationTest extends AbstractIntegrationTest {

    private static final String MARKER_PRODUCT = "Demo Startup Marker Product";

    /** Outside the baseline's SKU ranges and distinct from the reset test's, so it collides with nothing. */
    private static final String MARKER_SKU = "STA-9001";

    @Autowired
    private ConfigurableApplicationContext context;

    @Autowired
    private DemoDataService demoDataService;

    @Autowired
    private ProductService productService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void seedOnEmptyDatabase_emptyCatalogue_restoresTheBaseline() {
        demoDataService.wipe();

        publishReady();

        // the whole baseline, not merely non-empty: a partial seed would also clear an emptiness check
        assertThat(count("product")).isEqualTo(12);
        assertThat(count("supplier")).isEqualTo(5);
        assertThat(count("invoice")).isEqualTo(18);
    }

    @Test
    void seedOnEmptyDatabase_populatedCatalogue_leavesTheDataUntouched() {
        demoDataService.resetToBaseline();
        productService.create(MARKER_PRODUCT, MARKER_SKU, 12.50);

        publishReady();

        // seeding wipes first, so a guard that failed to hold would take the marker with it - this is
        // what makes a restart harmless to whatever the day's visitors have done to the demo
        assertThat(markerExists()).isTrue();
    }

    /** Publishes the real readiness signal, so the container dispatches it as it does in production. */
    private void publishReady() {
        context.publishEvent(new ApplicationReadyEvent(
                new SpringApplication(), new String[0], context, Duration.ZERO));
    }

    private boolean markerExists() {
        Long rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM product WHERE sku = ?", Long.class,
                MARKER_SKU);
        return rows != null && rows > 0;
    }

    private long count(String table) {
        Long rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
        return rows == null ? 0L : rows;
    }
}
