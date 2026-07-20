package com.stocks.stockease;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.support.AbstractIntegrationTest;

/** Integration test verifying the full application context loads with the test profile. */
@SpringBootTest
@ActiveProfiles("test")
class StockEaseApplicationTests extends AbstractIntegrationTest {

    @Test
    void contextLoads_withTestProfile_applicationStartsSuccessfully() {
    }
}
