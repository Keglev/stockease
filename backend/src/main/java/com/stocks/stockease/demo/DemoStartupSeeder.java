package com.stocks.stockease.demo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * Seeds the baseline once at startup when the demo database is empty.
 *
 * <p>A fresh deployment must never present an empty demo: the first visitor would meet blank
 * dashboards and conclude the application does nothing. An emptiness check rather than an
 * unconditional reset is what makes a restart harmless - a running demo keeps whatever the day's
 * visitors have done to it until the nightly reset.
 */
@Component
@ConditionalOnDemoMode
@RequiredArgsConstructor
public class DemoStartupSeeder {

    private static final Logger log = LoggerFactory.getLogger(DemoStartupSeeder.class);

    private final JdbcTemplate jdbcTemplate;
    private final DemoDataService demoDataService;

    /**
     * Restores the baseline if no product exists yet.
     *
     * @param event the readiness signal; the context is fully started, so the domain services the
     *        seeding runs through are all available
     */
    @EventListener(ApplicationReadyEvent.class)
    public void seedOnEmptyDatabase(ApplicationReadyEvent event) {
        // counted in SQL, not through the product service: soft-deleted rows still make the demo
        // non-empty, and the service's queries hide them
        Long products = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM product", Long.class);
        if (products != null && products > 0) {
            log.info("Demo mode is on and the catalogue already holds {} products; skipping seeding.", products);
            return;
        }
        log.info("Demo mode is on and the catalogue is empty; seeding the baseline.");
        demoDataService.resetToBaseline();
    }
}
