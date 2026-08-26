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
 * invoice lifecycle endpoints, Vercel preview deployments must be admitted by pattern, and unknown
 * origins must still be rejected.
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
    void preflight_vercelPreviewOrigin_allowed() throws Exception {
        // The host is generated per deployment, so this stands for a shape rather than a known origin.
        String preview = "https://stockease-abc123-carlos-keglevichs-projects.vercel.app";

        mockMvc.perform(options("/api/invoices/1/close")
                        .header("Origin", preview)
                        .header("Access-Control-Request-Method", "PATCH"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", preview));
    }

    @Test
    void preflight_foreignOriginImitatingThePreviewSuffix_rejected() throws Exception {
        // The pattern must bind to the project host, not merely end with vercel.app - otherwise
        // moving from exact origins to patterns would have opened the policy to anyone's deployment.
        mockMvc.perform(options("/api/invoices/1/close")
                        .header("Origin", "https://stockease-abc123-someone-elses-projects.vercel.app")
                        .header("Access-Control-Request-Method", "PATCH"))
                .andExpect(status().isForbidden());
    }

    @Test
    void preflight_successful_isCacheableForAnHour() throws Exception {
        mockMvc.perform(options("/api/reports/overdue")
                        .header("Origin", "https://bestandskontrolle.vercel.app")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Max-Age", "3600"));
    }

    @Test
    void preflight_unknownOrigin_rejected() throws Exception {
        mockMvc.perform(options("/api/invoices/1/close")
                        .header("Origin", "https://evil.example.com")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }
}
