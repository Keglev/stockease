package com.stocks.stockease.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the CORS policy enforced at the security-filter level. PATCH preflights must pass for the
 * invoice lifecycle endpoints and unknown origins must be rejected.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CorsPolicyTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void preflight_patchFromAllowedOrigin_allowed() throws Exception {
        mockMvc.perform(options("/api/invoices/1/close")
                        .header("Origin", "https://bestandskontrolle.vercel.app")
                        .header("Access-Control-Request-Method", "PATCH"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin",
                        "https://bestandskontrolle.vercel.app"));
    }

    @Test
    void preflight_unknownOrigin_rejected() throws Exception {
        mockMvc.perform(options("/api/invoices/1/close")
                        .header("Origin", "https://evil.example.com")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }
}
