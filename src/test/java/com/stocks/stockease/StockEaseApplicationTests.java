package com.stocks.stockease;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Test class for the StockEaseApplication.
 * Verifies that the application context loads successfully.
 */
@SpringBootTest
@ActiveProfiles("test") // Ensures Spring loads application-test.properties
class StockEaseApplicationTests {

    /**
     * Test to verify that the Spring application context loads without issues.
     */
    @Test
    void contextLoads() {
        // This test ensures that the application context starts successfully.
    }
}
